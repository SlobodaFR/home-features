import { describe, expect, it } from 'vitest';
import { formatRelative } from './relative-time';

const now = new Date('2026-11-26T12:00:00Z').getTime();
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('formatRelative', () => {
  it('rounds down to the largest unit', () => {
    expect(formatRelative(ago(10_000), now)).toBe('just now');
    expect(formatRelative(ago(5 * 60_000 + 5), now)).toBe('5 min ago');
    expect(formatRelative(ago(3 * 3_600_000), now)).toBe('3 h ago');
    expect(formatRelative(ago(2 * 86_400_000), now)).toBe('2 d ago');
  });

  it('falls back to the date after a month', () => {
    expect(formatRelative(ago(40 * 86_400_000), now)).not.toContain('ago');
  });
});
