import { DataSource } from 'typeorm';
import { ApiKey } from '../../../domain/api-key/api-key';
import { ENTITIES } from '../entities';
import { ApiKeyOrmEntity } from '../entities/api-key.orm-entity';
import { MIGRATIONS } from '../migrations';
import { TypeOrmApiKeyRepository } from './typeorm-api-key.repository';

describe('TypeOrmApiKeyRepository', () => {
  let ds: DataSource;
  let repository: TypeOrmApiKeyRepository;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: ENTITIES,
      migrations: MIGRATIONS,
      migrationsRun: true,
    });
    await ds.initialize();
    await ds.query(
      "INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, '2026-11-01 10:00:00')",
    );
    await ds.query(
      "INSERT INTO environments (id, app_id, name, slug, \"order\", created_at) VALUES ('e1', 'a1', 'Production', 'production', 0, '2026-11-01 10:00:00'), ('e2', 'a1', 'Staging', 'staging', 1, '2026-11-01 10:00:00')",
    );
    repository = new TypeOrmApiKeyRepository(ds.getRepository(ApiKeyOrmEntity));
    await repository.save(
      ApiKey.create({
        id: 'k1',
        appId: 'a1',
        environmentId: 'e1',
        scope: 'web',
        name: 'SPA',
        keyHash: 'hash-1',
        createdAt: new Date('2026-11-01T10:00:00Z'),
        lastUsedAt: null,
      }),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('round-trips the environment and the scope', async () => {
    const key = await repository.findByKeyHash('hash-1');

    expect(key?.environmentId).toBe('e1');
    expect(key?.scope).toBe('web');
  });

  it('updates lastUsedAt and keeps environment_id and scope', async () => {
    const usedAt = new Date('2026-11-21T10:00:00Z');

    await repository.touchLastUsedAt('k1', usedAt);

    const row: {
      environment_id: string;
      scope: string;
      last_used_at: string;
    }[] = await ds.query(
      "SELECT environment_id, scope, last_used_at FROM api_keys WHERE id = 'k1'",
    );
    expect(row[0].environment_id).toBe('e1');
    expect(row[0].scope).toBe('web');
    expect((await repository.findById('k1'))?.lastUsedAt).toEqual(usedAt);
  });

  it('counts the keys bound to an environment', async () => {
    expect(await repository.countByEnvironmentId('e1')).toBe(1);
    expect(await repository.countByEnvironmentId('e2')).toBe(0);
  });

  // Defence in depth: the migration deleted them and the domain refuses them.
  it('never authenticates a row without environment', async () => {
    await ds.query('PRAGMA foreign_keys = OFF');
    await ds.query(
      "INSERT INTO api_keys (id, app_id, name, key_hash, created_at) VALUES ('legacy', 'a1', 'Old', 'hash-legacy', '2026-11-01 10:00:00')",
    );

    expect(await repository.findByKeyHash('hash-legacy')).toBeNull();
    expect((await repository.findAllByAppId('a1')).map((k) => k.id)).toEqual([
      'k1',
    ]);
  });
});
