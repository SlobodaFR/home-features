import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

function dataSource(database: string, synchronize = false): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize,
  });
}

async function schemaOf(ds: DataSource): Promise<string[]> {
  const rows: { sql: string }[] = await ds.query(
    "SELECT sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name <> 'migrations' ORDER BY type, name",
  );
  return rows.map((row) => row.sql.replace(/\s+/g, ' ').trim());
}

describe('database migrations', () => {
  // Any entity change without its migration makes this fail.
  it('produce exactly the schema the entities describe', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();

    const pending = await ds.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
    await ds.destroy();
  });

  // The diff above ignores details such as defaults or index names: compare the DDL itself.
  it('create byte-for-byte what synchronize creates', async () => {
    const migrated = dataSource(':memory:');
    await migrated.initialize();
    await migrated.runMigrations();
    const synchronized = dataSource(':memory:', true);
    await synchronized.initialize();

    expect(await schemaOf(migrated)).toEqual(await schemaOf(synchronized));
    await migrated.destroy();
    await synchronized.destroy();
  });

  // Production was created by synchronize: true; the first migration must adopt it untouched.
  it('adopt a database created by synchronize without losing data', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'prod.sqlite');
    const legacy = dataSource(file, true);
    await legacy.initialize();
    await legacy.query(
      "INSERT INTO users (id, email, name, avatar_url) VALUES ('u1', 'a@example.com', 'Alice', 'https://example.com/a.png')",
    );
    await legacy.query(
      "INSERT INTO revoked_sessions (user_id, revoked_at) VALUES ('u1', '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', 'Home budget', '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO environments (id, app_id, name, slug, \"order\", created_at) VALUES ('e1', 'a1', 'Production', 'production', 0, '2026-11-01 10:00:00'), ('e2', 'a1', 'Staging', 'staging', 1, '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO feature_flags (id, app_id, key, name, description, created_at) VALUES ('f1', 'a1', 'new-ui', 'New UI', NULL, '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO flag_values (id, flag_id, environment_id, enabled, updated_at) VALUES ('fv1', 'f1', 'e1', 1, '2026-11-01 10:00:00'), ('fv2', 'f1', 'e2', 0, '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO config_entries (id, app_id, key, name, description, type, created_at) VALUES ('c1', 'a1', 'page-size', 'Page size', NULL, 'number', '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO config_values (id, config_entry_id, environment_id, value, updated_at) VALUES ('cv1', 'c1', 'e1', '50', '2026-11-01 10:00:00')",
    );
    await legacy.query(
      "INSERT INTO api_keys (id, app_id, name, key_hash, created_at, last_used_at) VALUES ('k1', 'a1', 'Backend', 'hash-1', '2026-11-01 10:00:00', NULL)",
    );
    const before = await dumpData(legacy);
    const schemaBefore = await schemaOf(legacy);
    await legacy.destroy();

    const migrated = dataSource(file);
    await migrated.initialize();
    const applied = await migrated.runMigrations();

    expect(applied.map((migration) => migration.name)).toEqual(
      MIGRATIONS.map((migration) => migration.name),
    );
    expect(await dumpData(migrated)).toEqual(before);
    expect(await schemaOf(migrated)).toEqual(schemaBefore);
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toEqual([]);
    await migrated.destroy();
  });

  it('run a second time without changing anything', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();

    expect(await ds.runMigrations()).toEqual([]);
    await ds.destroy();
  });
});

const DATA_TABLES = [
  'users',
  'revoked_sessions',
  'apps',
  'environments',
  'feature_flags',
  'flag_values',
  'config_entries',
  'config_values',
  'api_keys',
];

async function dumpData(ds: DataSource): Promise<Record<string, unknown[]>> {
  const dump: Record<string, unknown[]> = {};
  for (const table of DATA_TABLES) {
    dump[table] = await ds.query(`SELECT * FROM "${table}" ORDER BY 1`);
  }
  return dump;
}
