import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlagValue } from '../../../domain/feature-flag/flag-value';
import { FlagValueRepository } from '../../../domain/feature-flag/flag-value.repository';
import { FlagValueOrmEntity } from '../entities/flag-value.orm-entity';

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

  async upsert(flagValue: FlagValue): Promise<FlagValue> {
    const existing = await this.repository.findOne({
      where: {
        flagId: flagValue.flagId,
        environmentId: flagValue.environmentId,
      },
    });

    const saved = await this.repository.save({
      id: existing?.id ?? flagValue.id,
      flagId: flagValue.flagId,
      environmentId: flagValue.environmentId,
      enabled: flagValue.enabled,
      updatedAt: flagValue.updatedAt,
    });

    return toDomain(saved);
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
