import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * feature_flags.client_exposed (default false: every existing flag stays server-only) and
 * feature_flags.last_evaluated_at (never evaluated yet). ADD COLUMN only, no rebuild.
 */
export class FlagExposure1794700000000 implements MigrationInterface {
  name = 'FlagExposure1794700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feature_flags" ADD COLUMN "client_exposed" boolean NOT NULL DEFAULT (0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature_flags" ADD COLUMN "last_evaluated_at" datetime`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "feature_flags" DROP COLUMN "last_evaluated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "feature_flags" DROP COLUMN "client_exposed"`,
    );
  }
}
