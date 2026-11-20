import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema as created by `synchronize: true` until now. IF NOT EXISTS everywhere: on the existing
 * production database this migration creates nothing that already exists and only records itself;
 * on an empty database it creates the schema. A table that exists but differs from the entities
 * is not repaired here: SchemaGuard refuses to start instead.
 */
export class InitialSchema1794500000000 implements MigrationInterface {
  name = 'InitialSchema1794500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" text PRIMARY KEY NOT NULL, "email" text NOT NULL, "name" text NOT NULL, "avatar_url" text NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "revoked_sessions" ("user_id" text PRIMARY KEY NOT NULL, "revoked_at" datetime NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "apps" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "name" text NOT NULL, "slug" text NOT NULL, "description" text, "created_at" datetime NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "environments" ("id" text PRIMARY KEY NOT NULL, "app_id" text NOT NULL, "name" text NOT NULL, "slug" text NOT NULL, "order" integer NOT NULL, "created_at" datetime NOT NULL, CONSTRAINT "FK_bf519d075aa2055611f9857a112" FOREIGN KEY ("app_id") REFERENCES "apps" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "feature_flags" ("id" text PRIMARY KEY NOT NULL, "app_id" text NOT NULL, "key" text NOT NULL, "name" text NOT NULL, "description" text, "created_at" datetime NOT NULL, CONSTRAINT "FK_b6219cb3aef2ec8dc76fe4e9e46" FOREIGN KEY ("app_id") REFERENCES "apps" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "flag_values" ("id" text PRIMARY KEY NOT NULL, "flag_id" text NOT NULL, "environment_id" text NOT NULL, "enabled" boolean NOT NULL, "updated_at" datetime NOT NULL, CONSTRAINT "FK_b9a1a8a59e272b197872edcc039" FOREIGN KEY ("flag_id") REFERENCES "feature_flags" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cc22d94263e4715fb3943d367d2" FOREIGN KEY ("environment_id") REFERENCES "environments" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "config_entries" ("id" text PRIMARY KEY NOT NULL, "app_id" text NOT NULL, "key" text NOT NULL, "name" text NOT NULL, "description" text, "type" text NOT NULL, "created_at" datetime NOT NULL, CONSTRAINT "FK_0d982b3091209a1112beafdfcd2" FOREIGN KEY ("app_id") REFERENCES "apps" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "config_values" ("id" text PRIMARY KEY NOT NULL, "config_entry_id" text NOT NULL, "environment_id" text NOT NULL, "value" text NOT NULL, "updated_at" datetime NOT NULL, CONSTRAINT "FK_b8daab658bc3b8c5057bee07ee7" FOREIGN KEY ("config_entry_id") REFERENCES "config_entries" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_373963e4aed91a479ff425617ee" FOREIGN KEY ("environment_id") REFERENCES "environments" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "api_keys" ("id" text PRIMARY KEY NOT NULL, "app_id" text NOT NULL, "name" text NOT NULL, "key_hash" text NOT NULL, "created_at" datetime NOT NULL, "last_used_at" datetime, CONSTRAINT "FK_9a8bbd0dfa8388c61902c99aa8d" FOREIGN KEY ("app_id") REFERENCES "apps" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_57384430aa1959f4578046c9b8" ON "api_keys" ("key_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_9a8bbd0dfa8388c61902c99aa8" ON "api_keys" ("app_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_2432c5d52d527cf74f6cfe7a12" ON "apps" ("user_id", "slug")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_29a4e6c4b6a39215e95b2bd554" ON "apps" ("user_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_f941b1b6d148f527bfd4f20a1c" ON "apps" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_0d982b3091209a1112beafdfcd" ON "config_entries" ("app_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f44a7b7a2fc245f4cf18193411" ON "config_entries" ("app_id", "key")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_008a67b66e86ea7cf0dd629413" ON "config_values" ("config_entry_id", "environment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_373963e4aed91a479ff425617e" ON "config_values" ("environment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b8daab658bc3b8c5057bee07ee" ON "config_values" ("config_entry_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_4399c7ffc2550af745b07fe640" ON "environments" ("app_id", "slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bf519d075aa2055611f9857a11" ON "environments" ("app_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b6219cb3aef2ec8dc76fe4e9e4" ON "feature_flags" ("app_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f0cdbf841d0bb458e402f07a23" ON "feature_flags" ("app_id", "key")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_3b976fa64d13733a46049ab597" ON "flag_values" ("flag_id", "environment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b9a1a8a59e272b197872edcc03" ON "flag_values" ("flag_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cc22d94263e4715fb3943d367d" ON "flag_values" ("environment_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")`,
    );
  }

  // Destructive: drops every table, adopted production data included. Never run it on real data.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "config_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "config_entries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "flag_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "environments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "apps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "revoked_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
