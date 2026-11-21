import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Binds every API key to one environment and a scope (`server` | `web`).
 *
 * ALTER TABLE ADD COLUMN only, never a table rebuild (Litestream would replicate the drop).
 * SQLite cannot add a NOT NULL foreign key column, so environment_id is nullable in SQL; the
 * ApiKey domain refuses an unbound key. The existing keys are bound to nothing and nobody consumes
 * them: they are deleted (their owners create new `hf_` keys).
 */
export class ApiKeyEnvironment1794600000000 implements MigrationInterface {
  name = 'ApiKeyEnvironment1794600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM's SQLite driver reads foreign key names from the stored CREATE TABLE text, and only
    // in the table-constraint form `CONSTRAINT "<name>" FOREIGN KEY (...) REFERENCES "<table>"`,
    // which ADD COLUMN cannot produce. SQLite keeps this comment verbatim in sqlite_master, so
    // the key keeps the name the entity expects and SchemaGuard sees no drift (the migrations
    // spec fails without it).
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN "environment_id" text NULL /* CONSTRAINT "FK_481ca7cc5ed7ece012152bef73c" FOREIGN KEY ("environment_id") REFERENCES "environments" */ REFERENCES "environments" ("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN "scope" text NOT NULL DEFAULT 'server'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_481ca7cc5ed7ece012152bef73" ON "api_keys" ("environment_id")`,
    );
    await queryRunner.query(
      `DELETE FROM "api_keys" WHERE "environment_id" IS NULL`,
    );
  }

  // SQLite refuses DROP COLUMN on a foreign key column and a table rebuild is not acceptable on
  // replicated production data: roll forward with a new migration instead.
  async down(): Promise<void> {
    throw new Error(
      'ApiKeyEnvironment cannot be reverted without rebuilding api_keys: write a new migration',
    );
  }
}
