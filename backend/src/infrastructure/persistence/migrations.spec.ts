import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';
import { InitialSchema1794500000000 } from './migrations/1794500000000-InitialSchema';

function dataSource(database: string, synchronize = false): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize,
  });
}

interface TableStructure {
  columns: unknown[];
  indexes: unknown[];
  foreignKeys: unknown[];
}

/**
 * The schema as SQLite sees it: columns (type, NOT NULL, default, primary key), indexes (name,
 * uniqueness, columns) and foreign keys (target, ON DELETE). ALTER TABLE ADD COLUMN rewrites the
 * CREATE TABLE text differently from a fresh CREATE TABLE, so the DDL text cannot be compared.
 */
async function structureOf(
  ds: DataSource,
): Promise<Record<string, TableStructure>> {
  const tables: { name: string }[] = await ds.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'migrations' ORDER BY name",
  );
  const structure: Record<string, TableStructure> = {};
  for (const { name } of tables) {
    const columns: Record<string, unknown>[] = await ds.query(
      `PRAGMA table_info("${name}")`,
    );
    const indexList: { name: string; unique: number; origin: string }[] =
      await ds.query(`PRAGMA index_list("${name}")`);
    const indexes = [];
    for (const index of indexList.filter((i) => i.origin === 'c')) {
      const indexColumns: { name: string }[] = await ds.query(
        `PRAGMA index_info("${index.name}")`,
      );
      indexes.push({
        name: index.name,
        unique: index.unique,
        columns: indexColumns.map((column) => column.name),
      });
    }
    const foreignKeys: Record<string, unknown>[] = await ds.query(
      `PRAGMA foreign_key_list("${name}")`,
    );
    structure[name] = {
      columns: columns
        .map(({ name: column, type, notnull, dflt_value, pk }) => ({
          column,
          type,
          notnull,
          dflt_value,
          pk,
        }))
        .toSorted((a, b) => String(a.column).localeCompare(String(b.column))),
      indexes: indexes.toSorted((a, b) => a.name.localeCompare(b.name)),
      foreignKeys: foreignKeys
        .map(({ table, from, to, on_delete, on_update }) => ({
          table,
          from,
          to,
          on_delete,
          on_update,
        }))
        .toSorted((a, b) => String(a.from).localeCompare(String(b.from))),
    };
  }
  return structure;
}

/**
 * Production as it is today: the schema synchronize created from the initial entities, which is
 * exactly the InitialSchema DDL (checked byte-for-byte when that migration was introduced),
 * without any migrations table.
 */
async function legacyDatabase(file: string): Promise<DataSource> {
  const ds = new DataSource({ type: 'better-sqlite3', database: file });
  await ds.initialize();
  const runner = ds.createQueryRunner();
  await new InitialSchema1794500000000().up(runner);
  await runner.release();
  return ds;
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

  // The diff above ignores details such as defaults or index names: compare the structure itself.
  it('create column for column, index for index and key for key what synchronize creates', async () => {
    const migrated = dataSource(':memory:');
    await migrated.initialize();
    await migrated.runMigrations();
    const synchronized = dataSource(':memory:', true);
    await synchronized.initialize();

    expect(await structureOf(migrated)).toEqual(
      await structureOf(synchronized),
    );
    await migrated.destroy();
    await synchronized.destroy();
  });

  it('upgrade the production database without losing data, legacy API keys aside', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'prod.sqlite');
    const legacy = await legacyDatabase(file);
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
    // Legacy keys are bound to no environment: nobody consumes them, the migration deletes them.
    await legacy.query(
      "INSERT INTO api_keys (id, app_id, name, key_hash, created_at, last_used_at) VALUES ('k1', 'a1', 'Backend', 'hash-1', '2026-11-01 10:00:00', NULL)",
    );
    const before = await dumpData(legacy, KEPT_TABLES);
    await legacy.destroy();

    const migrated = dataSource(file);
    await migrated.initialize();
    const applied = await migrated.runMigrations();

    expect(applied.map((migration) => migration.name)).toEqual(
      MIGRATIONS.map((migration) => migration.name),
    );
    expect(await dumpData(migrated, KEPT_TABLES)).toEqual(before);
    expect(await migrated.query('SELECT * FROM api_keys')).toEqual([]);
    expect(await migrated.query('PRAGMA foreign_key_check')).toEqual([]);
    expect(
      (await migrated.driver.createSchemaBuilder().log()).upQueries,
    ).toEqual([]);
    await migrated.destroy();
  });

  it('bind API keys to an environment that cannot be deleted under them', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();
    await ds.query(
      "INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, '2026-11-01 10:00:00')",
    );
    await ds.query(
      "INSERT INTO environments (id, app_id, name, slug, \"order\", created_at) VALUES ('e1', 'a1', 'Production', 'production', 0, '2026-11-01 10:00:00')",
    );
    await ds.query(
      "INSERT INTO api_keys (id, app_id, name, key_hash, created_at, environment_id) VALUES ('k1', 'a1', 'Backend', 'hash-1', '2026-11-01 10:00:00', 'e1')",
    );

    expect(
      await ds.query("SELECT scope FROM api_keys WHERE id = 'k1'"),
    ).toEqual([{ scope: 'server' }]);
    await expect(
      ds.query("DELETE FROM environments WHERE id = 'e1'"),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
    await expect(
      ds.query(
        "INSERT INTO api_keys (id, app_id, name, key_hash, created_at, environment_id) VALUES ('k2', 'a1', 'Bad', 'hash-2', '2026-11-01 10:00:00', 'missing')",
      ),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/);
    expect(await ds.query('PRAGMA foreign_key_check')).toEqual([]);
    await ds.destroy();
  });

  it('run a second time without changing anything', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();

    expect(await ds.runMigrations()).toEqual([]);
    await ds.destroy();
  });
});

const KEPT_TABLES = [
  'users',
  'revoked_sessions',
  'apps',
  'environments',
  'feature_flags',
  'flag_values',
  'config_entries',
  'config_values',
];

async function dumpData(
  ds: DataSource,
  tables: string[],
): Promise<Record<string, unknown[]>> {
  const dump: Record<string, unknown[]> = {};
  for (const table of tables) {
    dump[table] = await ds.query(`SELECT * FROM "${table}" ORDER BY 1`);
  }
  return dump;
}
