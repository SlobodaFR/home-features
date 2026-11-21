import { Injectable } from '@nestjs/common';

/** Usage timestamps (API key last use, flag last evaluation) are written at most this often. */
export const WRITE_DEBOUNCE_MS = 10 * 60 * 1000;

/**
 * Per-process memory of the last usage write per id, so a busy key or flag costs one SQLite write
 * every ten minutes instead of one per request. The persisted timestamp also counts, so a restart
 * does not cause a burst of writes. Lost on restart by design: it is an optimisation, not a record.
 */
@Injectable()
export class WriteDebouncer {
  private readonly lastWrites = new Map<string, number>();

  /** True (and remembered) when `id` was not written in the last ten minutes. */
  shouldWrite(id: string, persistedAt: Date | null, now: Date): boolean {
    const last = Math.max(
      this.lastWrites.get(id) ?? Number.NEGATIVE_INFINITY,
      persistedAt?.getTime() ?? Number.NEGATIVE_INFINITY,
    );
    if (now.getTime() - last < WRITE_DEBOUNCE_MS) {
      return false;
    }
    this.lastWrites.set(id, now.getTime());
    return true;
  }
}
