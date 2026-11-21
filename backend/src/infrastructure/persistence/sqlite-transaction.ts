import type { Database } from 'better-sqlite3';
import { DataSource } from 'typeorm';
import type { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';

const MAX_WAIT_TICKS = 10_000;

/**
 * Runs `work` as one synchronous better-sqlite3 transaction.
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
  for (let tick = 0; db.inTransaction; tick += 1) {
    if (tick >= MAX_WAIT_TICKS) {
      throw new Error('The database stayed inside another transaction');
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  return db.transaction(() => work(db))();
}
