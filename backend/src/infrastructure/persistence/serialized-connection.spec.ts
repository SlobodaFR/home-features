import { DataSource } from 'typeorm';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { ENTITIES } from './entities';
import { FeatureFlagOrmEntity } from './entities/feature-flag.orm-entity';
import { MIGRATIONS } from './migrations';
import { serializeConnection } from './serialized-connection';
import { TypeOrmFeatureFlagRepository } from './repositories/typeorm-feature-flag.repository';

const flag = (id: string, appId = 'a1') =>
  FeatureFlag.create({
    id,
    appId,
    key: id,
    name: id,
    description: null,
    clientExposed: false,
    lastEvaluatedAt: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
  });

async function open(serialize: boolean) {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsRun: true,
  });
  if (serialize) serializeConnection(ds);
  await ds.initialize();
  await ds.query(
    "INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, '2026-11-01 10:00:00')",
  );
  const repository = new TypeOrmFeatureFlagRepository(
    ds.getRepository(FeatureFlagOrmEntity),
  );
  return { ds, repository };
}

const insertSql = (id: string) =>
  `INSERT INTO feature_flags (id, app_id, key, name, client_exposed, created_at) VALUES ('${id}', 'a1', '${id}', '${id}', 0, '2026-11-01 10:00:00')`;

const ids = async (ds: DataSource) => {
  const rows: { id: string }[] = await ds.query(
    'SELECT id FROM feature_flags ORDER BY id',
  );
  return rows.map((row) => row.id);
};

/** Three concurrent requests: one that fails (bad FK) next to two valid writes. */
const concurrentWrites = (repository: TypeOrmFeatureFlagRepository) =>
  Promise.allSettled([
    repository.save(flag('bad', 'missing-app')),
    repository.save(flag('f1')),
    repository.save(flag('f2')),
  ]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Request A runs a transaction that waits on I/O and then fails; request B saves a flag while A
 * is waiting. B's save() resolves: its row must survive A's rollback.
 */
async function savedWhileAnotherRequestRollsBack(
  ds: DataSource,
  repository: TypeOrmFeatureFlagRepository,
) {
  const requestA = ds
    .transaction(async (manager) => {
      await manager.query(insertSql('from-a'));
      await sleep(30);
      throw new Error('request A fails');
    })
    .catch(() => undefined);
  await sleep(5);
  await repository.save(flag('from-b'));
  await requestA;
}

describe('serializeConnection (issue #57)', () => {
  describe('with the serialized connection', () => {
    it('does not roll back a concurrent request write along with the failing transaction', async () => {
      const { ds, repository } = await open(true);

      await savedWhileAnotherRequestRollsBack(ds, repository);

      expect(await ids(ds)).toEqual(['from-b']);
      await ds.destroy();
    });

    it('keeps the writes of concurrent requests apart: only the failing one rolls back', async () => {
      const { ds, repository } = await open(true);

      const results = await concurrentWrites(repository);

      expect(results.map((r) => r.status)).toEqual([
        'rejected',
        'fulfilled',
        'fulfilled',
      ]);
      expect(await ids(ds)).toEqual(['f1', 'f2']);
      await ds.destroy();
    });

    it('does not let a plain write join, then lose, another request transaction', async () => {
      const { ds } = await open(true);
      const runner = ds.createQueryRunner();
      await runner.startTransaction();
      await runner.query(insertSql('tx'));

      // A write made outside the transaction waits for it...
      const plain = ds.query(insertSql('plain'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await runner.rollbackTransaction();
      await runner.release();
      await plain;

      // ...so the rollback does not undo it.
      expect(await ids(ds)).toEqual(['plain']);
      await ds.destroy();
    });

    it('does not keep the connection when SQLite rolled back by itself and ROLLBACK fails', async () => {
      const { ds } = await open(true);
      const runner = ds.createQueryRunner();
      await runner.startTransaction();
      // What disk-full or I/O errors do: the transaction is gone, COMMIT then ROLLBACK fail.
      (
        ds.driver as unknown as {
          databaseConnection: { exec(sql: string): void };
        }
      ).databaseConnection.exec('ROLLBACK');
      await expect(runner.commitTransaction()).rejects.toThrow(
        /no transaction is active/,
      );
      await expect(runner.rollbackTransaction()).rejects.toThrow(
        /no transaction is active/,
      );
      await runner.release();

      expect(await ds.query('SELECT 1 AS one')).toEqual([{ one: 1 }]);
      await ds.destroy();
    });

    it('lets a transaction run several statements and nest', async () => {
      const { ds } = await open(true);

      await ds.transaction(async (manager) => {
        await manager.query(insertSql('n1'));
        await manager.transaction((inner) => inner.query(insertSql('n2')));
      });

      expect(await ids(ds)).toEqual(['n1', 'n2']);
      await ds.destroy();
    });

    it('fails instead of hanging when a transaction is never closed', async () => {
      const { ds, repository } = await open(true);
      const runner = ds.createQueryRunner();
      await runner.startTransaction();

      await expect(repository.save(flag('late'))).rejects.toThrow(
        /stayed inside another transaction/,
      );

      await runner.rollbackTransaction();
      await ds.destroy();
    }, 15_000);
  });

  describe('without it (documents the root cause)', () => {
    it('loses a write that save() reported as done', async () => {
      const { ds, repository } = await open(false);

      await savedWhileAnotherRequestRollsBack(ds, repository);

      // TypeORM's better-sqlite3 driver shares ONE query runner: B's save() sees the transaction
      // of A as its own, joins it, and A's rollback takes B's committed-looking row with it.
      expect(await ids(ds)).toEqual([]);
      await ds.destroy();
    });
  });
});
