import type { MockInstance } from 'vitest';
import { Logger } from '@nestjs/common';
import { RuntimeHealthMonitor } from './runtime-health.monitor';

function blockEventLoop(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait on purpose
  }
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('RuntimeHealthMonitor', () => {
  let monitor: RuntimeHealthMonitor;
  let warn: MockInstance;

  beforeEach(() => {
    monitor = new RuntimeHealthMonitor();
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

  it('measures an event-loop block, keeps it and warns on p99', async () => {
    await tick(50);
    blockEventLoop(500);
    await tick(50);

    const sample = monitor.sample();

    expect(sample.lag_max_ms).toBeGreaterThanOrEqual(400);
    expect(sample.elu).toBeGreaterThan(0);
    expect(sample.heap_used_mb).toBeGreaterThan(0);
    expect(sample.rss_mb).toBeGreaterThan(0);
    expect(monitor.lastSample).toEqual(sample);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Event loop lag'),
    );
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
});
