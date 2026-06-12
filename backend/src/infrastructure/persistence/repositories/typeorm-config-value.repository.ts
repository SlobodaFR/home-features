import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigValue } from '../../../domain/config-entry/config-value';
import { ConfigValueType } from '../../../domain/config-entry/config-value-type.enum';
import { ConfigValueRepository } from '../../../domain/config-entry/config-value.repository';
import { ConfigEntryOrmEntity } from '../entities/config-entry.orm-entity';
import { ConfigValueOrmEntity } from '../entities/config-value.orm-entity';

@Injectable()
export class TypeOrmConfigValueRepository extends ConfigValueRepository {
  constructor(
    @InjectRepository(ConfigValueOrmEntity)
    private readonly repository: Repository<ConfigValueOrmEntity>,
    @InjectRepository(ConfigEntryOrmEntity)
    private readonly configEntryRepository: Repository<ConfigEntryOrmEntity>,
  ) {
    super();
  }

  async findAllByConfigEntryId(configEntryId: string): Promise<ConfigValue[]> {
    const configEntry = await this.configEntryRepository.findOne({
      where: { id: configEntryId },
    });
    if (!configEntry) {
      return [];
    }
    const rows = await this.repository.find({ where: { configEntryId } });
    return rows.map((row) => toDomain(row, configEntry.type));
  }

  async findAllByAppId(appId: string): Promise<ConfigValue[]> {
    const configEntries = await this.configEntryRepository.find({
      where: { appId },
    });
    if (configEntries.length === 0) {
      return [];
    }

    const typeByConfigEntryId = new Map(
      configEntries.map((entry) => [entry.id, entry.type]),
    );
    const rows = await this.repository
      .createQueryBuilder('value')
      .where('value.config_entry_id IN (:...ids)', {
        ids: configEntries.map((entry) => entry.id),
      })
      .getMany();

    return rows.map((row) =>
      toDomain(row, typeByConfigEntryId.get(row.configEntryId)!),
    );
  }

  async findOne(
    configEntryId: string,
    environmentId: string,
  ): Promise<ConfigValue | null> {
    const configEntry = await this.configEntryRepository.findOne({
      where: { id: configEntryId },
    });
    if (!configEntry) {
      return null;
    }
    const row = await this.repository.findOne({
      where: { configEntryId, environmentId },
    });
    return row ? toDomain(row, configEntry.type) : null;
  }

  async upsert(configValue: ConfigValue): Promise<ConfigValue> {
    const existing = await this.repository.findOne({
      where: {
        configEntryId: configValue.configEntryId,
        environmentId: configValue.environmentId,
      },
    });

    const saved = await this.repository.save({
      id: existing?.id ?? configValue.id,
      configEntryId: configValue.configEntryId,
      environmentId: configValue.environmentId,
      value: configValue.value,
      updatedAt: configValue.updatedAt,
    });

    return toDomain(saved, configValue.type);
  }

  async deleteByConfigEntryId(configEntryId: string): Promise<void> {
    await this.repository.delete({ configEntryId });
  }

  async deleteByEnvironmentId(environmentId: string): Promise<void> {
    await this.repository.delete({ environmentId });
  }
}

function toDomain(
  row: ConfigValueOrmEntity,
  type: ConfigValueType,
): ConfigValue {
  return ConfigValue.create({
    id: row.id,
    configEntryId: row.configEntryId,
    environmentId: row.environmentId,
    value: row.value,
    type,
    updatedAt: new Date(row.updatedAt),
  });
}
