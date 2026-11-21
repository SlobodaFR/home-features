import type { Database } from 'better-sqlite3';
import { DataSource } from 'typeorm';
import type { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';

// Bounded by time, not by event-loop turns: a turn lasts microseconds on a fast machine, so a
// turn count would give up long before a legitimate transaction (a few ms) has finished.
const MAX_WAIT_MS = 5_000;

/**
 * Runs `work` as one synchronous better-sqlite3 transaction. `work` must be synchronous: the
 * transaction commits as soon as it returns.
 *
 * TypeORM's better-sqlite3 driver shares a single connection and does not serialize its async
 * transactions (repository.save() opens one): queries of concurrent requests interleave at the
 * microtask level and join whatever transaction is open, so a rollback could undo another
 * request's write, or commit a write without its companion. A synchronous transaction cannot be
 * interleaved; it only waits until no other transaction is open, so it is never nested inside
 * (and rolled back with) someone else's.
 */
export async function runSqliteTransaction<T>(
  dataSource: DataSource,
  work: (db: Database) => T,
): Promise<T> {
  const db = (dataSource.driver as BetterSqlite3Driver)
    .databaseConnection as Database;
  const deadline = performance.now() + MAX_WAIT_MS;
  for (let turn = 0; db.inTransaction; turn += 1) {
    if (performance.now() >= deadline) {
      throw new Error('The database stayed inside another transaction');
    }
    // Yield on the next turn at first (TypeORM transactions last a few ms), then back off to 1 ms
    // so a leaked transaction does not turn every waiter into a hot loop for MAX_WAIT_MS.
    await new Promise((resolve) =>
      turn < 100 ? setImmediate(resolve) : setTimeout(resolve, 1),
    );
  }
  // BEGIN IMMEDIATE: take the write lock up front. A deferred transaction that reads then writes
  // fails at once with "database is locked" when another process (the CLI, the server) writes,
  // because SQLite skips the busy handler on a lock upgrade; IMMEDIATE waits for the busy timeout.
  return db.transaction(() => work(db)).immediate();
}
