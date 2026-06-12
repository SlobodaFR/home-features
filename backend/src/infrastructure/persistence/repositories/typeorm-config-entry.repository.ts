import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigEntry } from '../../../domain/config-entry/config-entry';
import { ConfigEntryRepository } from '../../../domain/config-entry/config-entry.repository';
import { ConfigEntryOrmEntity } from '../entities/config-entry.orm-entity';

@Injectable()
export class TypeOrmConfigEntryRepository extends ConfigEntryRepository {
  constructor(
    @InjectRepository(ConfigEntryOrmEntity)
    private readonly repository: Repository<ConfigEntryOrmEntity>,
  ) {
    super();
  }

  async findAllByAppId(appId: string): Promise<ConfigEntry[]> {
    const rows = await this.repository.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<ConfigEntry | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByKey(appId: string, key: string): Promise<ConfigEntry | null> {
    const row = await this.repository.findOne({ where: { appId, key } });
    return row ? toDomain(row) : null;
  }

  async save(configEntry: ConfigEntry): Promise<void> {
    await this.repository.save({
      id: configEntry.id,
      appId: configEntry.appId,
      key: configEntry.key,
      name: configEntry.name,
      description: configEntry.description,
      type: configEntry.type,
      createdAt: configEntry.createdAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}

function toDomain(row: ConfigEntryOrmEntity): ConfigEntry {
  return ConfigEntry.create({
    id: row.id,
    appId: row.appId,
    key: row.key,
    name: row.name,
    description: row.description,
    type: row.type,
    createdAt: new Date(row.createdAt),
  });
}
