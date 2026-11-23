import type { MockInstance } from 'vitest';
import { Logger } from '@nestjs/common';
import { FakeTelemetry } from '../../test-support/fake-telemetry';
import { RuntimeHealthMonitor } from './runtime-health.monitor';

function blockEventLoop(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait on purpose
  }
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RuntimeHealthMonitor', () => {
  let telemetry: FakeTelemetry;
  let monitor: RuntimeHealthMonitor;
  let warn: MockInstance;

  beforeEach(() => {
    telemetry = new FakeTelemetry();
    monitor = new RuntimeHealthMonitor(telemetry);
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    monitor.start();
  });

  afterEach(() => {
    monitor.stop();
    warn.mockRestore();
  });

  it('has no sample before the first one is taken', () => {
    expect(monitor.lastSample).toBeNull();
  });

  it('measures an event-loop block, reports it and warns on p99', async () => {
    await tick(50);
    blockEventLoop(500);
    await tick(50);

    const sample = monitor.sample();

    expect(sample.lag_max_ms).toBeGreaterThanOrEqual(400);
    expect(sample.elu).toBeGreaterThan(0);
    expect(sample.heap_used_mb).toBeGreaterThan(0);
    expect(sample.rss_mb).toBeGreaterThan(0);
    expect(monitor.lastSample).toEqual(sample);
    expect(telemetry.captured).toEqual([
      { event: { name: 'runtime_health', properties: sample } },
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Event loop lag'),
    );
  });

  it('resets the histogram between samples', async () => {
    await tick(50);
    blockEventLoop(500);
    await tick(50);
    const first = monitor.sample();

    await tick(200);
    const second = monitor.sample();

    expect(second.lag_max_ms).toBeLessThan(first.lag_max_ms / 2);
  });

  it('does not warn when the loop is healthy', async () => {
    await tick(50);

    monitor.sample();

    expect(warn).not.toHaveBeenCalled();
  });

  it('stops sampling: start is idempotent and stop releases the timer', () => {
    monitor.start();
    monitor.stop();

    expect(() => monitor.sample()).not.toThrow();
  });

  it('reports runtime_health with exactly the six shared properties, as numbers', () => {
    monitor.sample();

    const { event } = telemetry.captured[0] as {
      event: { name: string; properties: Record<string, unknown> };
    };
    expect(event.name).toBe('runtime_health');
    expect(Object.keys(event.properties).toSorted()).toEqual([
      'elu',
      'heap_used_mb',
      'lag_max_ms',
      'lag_p50_ms',
      'lag_p99_ms',
      'rss_mb',
    ]);
    expect(
      Object.values(event.properties).every((v) => typeof v === 'number'),
    ).toBe(true);
  });

  it('samples every 60 s from the start, once per period', () => {
    monitor.stop();
    vi.useFakeTimers();
    try {
      monitor.start();
      vi.advanceTimersByTime(59_999);
      expect(telemetry.captured).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(telemetry.captured).toHaveLength(1);
      vi.advanceTimersByTime(120_000);
      expect(telemetry.captured).toHaveLength(3);
    } finally {
      monitor.stop();
      vi.useRealTimers();
    }
  });

  it('stops sampling at application shutdown', () => {
    monitor.stop();
    vi.useFakeTimers();
    try {
      monitor.onApplicationBootstrap();
      monitor.onApplicationShutdown();
      vi.advanceTimersByTime(180_000);
      expect(telemetry.captured).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
