import { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runSqliteTransaction } from './sqlite-transaction';

describe('runSqliteTransaction', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
    });
    await dataSource.initialize();
    await dataSource.query('CREATE TABLE t (v INTEGER)');
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('waits for a transaction held longer than many event-loop turns', async () => {
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    const pending = runSqliteTransaction(dataSource, (db) =>
      db.prepare('INSERT INTO t (v) VALUES (1)').run(),
    );

    await new Promise((resolve) => setTimeout(resolve, 300));
    await runner.rollbackTransaction();
    await runner.release();
    await pending;

    expect(await dataSource.query('SELECT v FROM t')).toEqual([{ v: 1 }]);
  });
});
