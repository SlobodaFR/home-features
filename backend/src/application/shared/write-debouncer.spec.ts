import { WRITE_DEBOUNCE_MS, WriteDebouncer } from './write-debouncer';

const T0 = new Date('2026-11-21T10:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

describe('WriteDebouncer', () => {
  it('debounces for ten minutes', () => {
    expect(WRITE_DEBOUNCE_MS).toBe(10 * 60 * 1000);
  });

  it('allows the first write of a never-written id', () => {
    expect(new WriteDebouncer().shouldWrite('k1', null, T0)).toBe(true);
  });

  it('allows at most one write per id within ten minutes', () => {
    const debouncer = new WriteDebouncer();

    expect(debouncer.shouldWrite('k1', null, T0)).toBe(true);
    expect(debouncer.shouldWrite('k1', null, at(1_000))).toBe(false);
    expect(debouncer.shouldWrite('k1', null, at(WRITE_DEBOUNCE_MS - 1))).toBe(
      false,
    );
    expect(debouncer.shouldWrite('k1', null, at(WRITE_DEBOUNCE_MS))).toBe(true);
  });

  it('keeps ids independent', () => {
    const debouncer = new WriteDebouncer();

    expect(debouncer.shouldWrite('k1', null, T0)).toBe(true);
    expect(debouncer.shouldWrite('k2', null, T0)).toBe(true);
  });

  // After a restart the memory is empty: the persisted timestamp still counts.
  it('skips the write when the persisted timestamp is recent', () => {
    const debouncer = new WriteDebouncer();

    expect(debouncer.shouldWrite('k1', at(-60_000), T0)).toBe(false);
    expect(debouncer.shouldWrite('k1', at(-WRITE_DEBOUNCE_MS), T0)).toBe(true);
  });
});
