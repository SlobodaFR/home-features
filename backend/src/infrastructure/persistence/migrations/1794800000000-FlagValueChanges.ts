import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Append-only journal of flag value changes. New table only (nothing existing is touched); the
 * triggers refuse any UPDATE or DELETE, so an entry can only be added. No foreign keys: deleting a
 * flag or an environment keeps its history.
 */
export class FlagValueChanges1794800000000 implements MigrationInterface {
  name = 'FlagValueChanges1794800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "flag_value_changes" ("id" text PRIMARY KEY NOT NULL, "flag_id" text NOT NULL, "environment_id" text NOT NULL, "old_enabled" boolean, "new_enabled" boolean NOT NULL, "actor" text NOT NULL, "source" text NOT NULL, "at" datetime NOT NULL, CONSTRAINT "CHK_flag_value_changes_source" CHECK ("source" IN ('ui', 'cli')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eaa9561dc658578958b8d715d6" ON "flag_value_changes" ("flag_id", "at")`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "flag_value_changes_no_update" BEFORE UPDATE ON "flag_value_changes" BEGIN SELECT RAISE(ABORT, 'flag_value_changes is append-only'); END`,
    );
    await queryRunner.query(
      `CREATE TRIGGER "flag_value_changes_no_delete" BEFORE DELETE ON "flag_value_changes" BEGIN SELECT RAISE(ABORT, 'flag_value_changes is append-only'); END`,
    );
  }

  // Drops the journal and its history: never on real data.
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "flag_value_changes"`);
  }
}
