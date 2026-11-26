import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { BetterSqlite3QueryRunner } from 'typeorm/driver/better-sqlite3/BetterSqlite3QueryRunner';
import type { BetterSqlite3Driver } from 'typeorm/driver/better-sqlite3/BetterSqlite3Driver';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

// Bounded by time, not by event-loop turns (see sqlite-transaction.ts).
const MAX_WAIT_MS = 5_000;

/**
 * Who currently owns the SQLite connection for a transaction. One owner at a time; the owner
 * (a query runner) may nest as many savepoints as it wants.
 */
class ConnectionGate {
  private owner: BetterSqlite3QueryRunner | null = null;
  private readonly waiting = new Set<() => void>();

  acquire(runner: BetterSqlite3QueryRunner): Promise<void> {
    // The ownership is taken in the same turn as the wake-up: two waiters cannot both get it.
    return this.waitUntil(
      () => this.owner === null || this.owner === runner,
      () => {
        this.owner = runner;
      },
    );
  }

  release(runner: BetterSqlite3QueryRunner): void {
    if (this.owner !== runner) return;
    this.owner = null;
    for (const wake of this.waiting) wake();
  }

  /** A query outside any transaction must not run inside someone else's transaction. */
  waitForOthers(runner: BetterSqlite3QueryRunner): Promise<void> {
    return this.waitUntil(() => this.owner === null || this.owner === runner);
  }

  private waitUntil(isFree: () => boolean, take?: () => void): Promise<void> {
    if (isFree()) {
      take?.();
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const wake = () => {
        if (!isFree()) return;
        take?.();
        cleanup();
        resolve();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            'The database stayed inside another transaction (or the queue of waiting requests is longer than 5 s)',
          ),
        );
      }, MAX_WAIT_MS);
      const cleanup = () => {
        clearTimeout(timer);
        this.waiting.delete(wake);
      };
      this.waiting.add(wake);
    });
  }
}

class SerializedQueryRunner extends BetterSqlite3QueryRunner {
  constructor(
    driver: BetterSqlite3Driver,
    private readonly gate: ConnectionGate,
  ) {
    super(driver);
  }

  // TypeORM always releases its runner in a finally, even when ROLLBACK itself failed (SQLite
  // already rolled back on disk-full / I/O errors): never keep the gate for a discarded runner.
  override async release(): Promise<void> {
    this.gate.release(this);
    return super.release();
  }

  override async startTransaction(
    isolationLevel?: IsolationLevel,
  ): Promise<void> {
    await this.gate.acquire(this);
    try {
      await super.startTransaction(isolationLevel);
    } finally {
      this.releaseIfIdle();
    }
  }

  override async commitTransaction(): Promise<void> {
    try {
      await super.commitTransaction();
    } finally {
      this.releaseIfIdle();
    }
  }

  override async rollbackTransaction(): Promise<void> {
    try {
      await super.rollbackTransaction();
    } finally {
      this.releaseIfIdle();
    }
  }

  override async query(
    query: string,
    parameters?: any[],
    useStructuredResult?: boolean,
  ): Promise<any> {
    await this.gate.waitForOthers(this);
    return super.query(query, parameters, useStructuredResult);
  }

  // After a failed COMMIT TypeORM still has to ROLLBACK: keep the connection until then.
  private releaseIfIdle(): void {
    if (!this.isTransactionActive) this.gate.release(this);
  }
}

/**
 * TypeORM's better-sqlite3 driver hands every caller the same query runner, so concurrent requests
 * share one `isTransactionActive` / savepoint depth on one connection: a `repository.save()` of
 * request B joins the transaction of request A (and is rolled back with it), or commits it
 * early (issue #57). This gives each caller its own query runner and lets only one of them hold a
 * transaction at a time; every other query waits for it to end. Call it before `initialize()`.
 *
 * Do not use the DataSource (or another runner) from inside a transaction callback: it would wait
 * for that very transaction. Use the callback's own `manager`.
 */
export function serializeConnection(dataSource: DataSource): void {
  const driver = dataSource.driver as BetterSqlite3Driver;
  const gate = new ConnectionGate();
  driver.createQueryRunner = () => new SerializedQueryRunner(driver, gate);
}

/** `dataSourceFactory` for TypeOrmModule: serialized before initialize(), so migrations too. */
export async function serializedDataSourceFactory(
  options?: DataSourceOptions,
): Promise<DataSource> {
  const dataSource = new DataSource(options!);
  serializeConnection(dataSource);
  return dataSource.initialize();
}
