import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FlagValue } from '../../../domain/feature-flag/flag-value';
import { FlagValueChange } from '../../../domain/feature-flag/flag-value-change';
import {
  FlagValueChangeAuthor,
  FlagValueRepository,
  RecordedFlagValue,
} from '../../../domain/feature-flag/flag-value.repository';
import { FlagValueChangeOrmEntity } from '../entities/flag-value-change.orm-entity';
import { FlagValueOrmEntity } from '../entities/flag-value.orm-entity';
import { runSqliteTransaction } from '../sqlite-transaction';

@Injectable()
export class TypeOrmFlagValueRepository extends FlagValueRepository {
  constructor(
    @InjectRepository(FlagValueOrmEntity)
    private readonly repository: Repository<FlagValueOrmEntity>,
  ) {
    super();
  }

  async findAllByFlagId(flagId: string): Promise<FlagValue[]> {
    const rows = await this.repository.find({ where: { flagId } });
    return rows.map(toDomain);
  }

  async findAllByAppId(appId: string): Promise<FlagValue[]> {
    const rows = await this.repository
      .createQueryBuilder('value')
      .innerJoin('feature_flags', 'flag', 'flag.id = value.flag_id')
      .where('flag.app_id = :appId', { appId })
      .getMany();
    return rows.map(toDomain);
  }

  async findOne(
    flagId: string,
    environmentId: string,
  ): Promise<FlagValue | null> {
    const row = await this.repository.findOne({
      where: { flagId, environmentId },
    });
    return row ? toDomain(row) : null;
  }

  /** One synchronous SQLite transaction: see runSqliteTransaction for why not TypeORM's. */
  upsertRecordingChange(
    flagValue: FlagValue,
    author: FlagValueChangeAuthor,
  ): Promise<RecordedFlagValue> {
    const connection = this.repository.manager.connection;
    const values = this.repository.metadata;
    const changes = connection.getMetadata(FlagValueChangeOrmEntity);
    // TypeORM's own conversions, so the rows look exactly like the ones it writes and reads.
    const persist = (
      metadata: typeof values,
      property: string,
      value: unknown,
    ): unknown =>
      connection.driver.preparePersistentValue(
        value,
        metadata.findColumnWithPropertyName(property)!,
      );
    const hydrate = (property: string, value: unknown): unknown =>
      connection.driver.prepareHydratedValue(
        value,
        values.findColumnWithPropertyName(property)!,
      );

    return runSqliteTransaction(connection, (db) => {
      const existing = db
        .prepare(
          'SELECT "id", "enabled", "updated_at" FROM "flag_values" WHERE "flag_id" = ? AND "environment_id" = ?',
        )
        .get(flagValue.flagId, flagValue.environmentId) as
        | { id: string; enabled: number; updated_at: string }
        | undefined;
      const existingEnabled = existing
        ? (hydrate('enabled', existing.enabled) as boolean)
        : null;
      if (existing && existingEnabled === flagValue.enabled) {
        return {
          value: FlagValue.create({
            id: existing.id,
            flagId: flagValue.flagId,
            environmentId: flagValue.environmentId,
            enabled: flagValue.enabled,
            updatedAt: hydrate('updatedAt', existing.updated_at) as Date,
          }),
          change: null,
        };
      }

      const id = existing?.id ?? flagValue.id;
      const enabled = persist(values, 'enabled', flagValue.enabled);
      const updatedAt = persist(values, 'updatedAt', flagValue.updatedAt);
      if (existing) {
        db.prepare(
          'UPDATE "flag_values" SET "enabled" = ?, "updated_at" = ? WHERE "id" = ?',
        ).run(enabled, updatedAt, id);
      } else {
        db.prepare(
          'INSERT INTO "flag_values" ("id", "flag_id", "environment_id", "enabled", "updated_at") VALUES (?, ?, ?, ?, ?)',
        ).run(
          id,
          flagValue.flagId,
          flagValue.environmentId,
          enabled,
          updatedAt,
        );
      }

      const change = FlagValueChange.create({
        id: randomUUID(),
        flagId: flagValue.flagId,
        environmentId: flagValue.environmentId,
        oldEnabled: existingEnabled,
        newEnabled: flagValue.enabled,
        actor: author.actor,
        source: author.source,
        at: flagValue.updatedAt,
      });
      db.prepare(
        'INSERT INTO "flag_value_changes" ("id", "flag_id", "environment_id", "old_enabled", "new_enabled", "actor", "source", "at") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        change.id,
        change.flagId,
        change.environmentId,
        persist(changes, 'oldEnabled', change.oldEnabled) ?? null,
        persist(changes, 'newEnabled', change.newEnabled),
        change.actor,
        change.source,
        persist(changes, 'at', change.at),
      );

      return {
        value: FlagValue.create({
          id,
          flagId: flagValue.flagId,
          environmentId: flagValue.environmentId,
          enabled: flagValue.enabled,
          updatedAt: flagValue.updatedAt,
        }),
        change,
      };
    });
  }

  async deleteByFlagId(flagId: string): Promise<void> {
    await this.repository.delete({ flagId });
  }

  async deleteByEnvironmentId(environmentId: string): Promise<void> {
    await this.repository.delete({ environmentId });
  }
}

function toDomain(row: FlagValueOrmEntity): FlagValue {
  return FlagValue.create({
    id: row.id,
    flagId: row.flagId,
    environmentId: row.environmentId,
    enabled: row.enabled,
    updatedAt: new Date(row.updatedAt),
  });
}
