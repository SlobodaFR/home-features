import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from '../../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../../domain/feature-flag/feature-flag.repository';
import { FeatureFlagOrmEntity } from '../entities/feature-flag.orm-entity';

@Injectable()
export class TypeOrmFeatureFlagRepository extends FeatureFlagRepository {
  constructor(
    @InjectRepository(FeatureFlagOrmEntity)
    private readonly repository: Repository<FeatureFlagOrmEntity>,
  ) {
    super();
  }

  async findAllByAppId(appId: string): Promise<FeatureFlag[]> {
    const rows = await this.repository.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<FeatureFlag | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByKey(appId: string, key: string): Promise<FeatureFlag | null> {
    const row = await this.repository.findOne({ where: { appId, key } });
    return row ? toDomain(row) : null;
  }

  async save(flag: FeatureFlag): Promise<void> {
    await this.repository.save({
      id: flag.id,
      appId: flag.appId,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      createdAt: flag.createdAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}

function toDomain(row: FeatureFlagOrmEntity): FeatureFlag {
  return FeatureFlag.create({
    id: row.id,
    appId: row.appId,
    key: row.key,
    name: row.name,
    description: row.description,
    createdAt: new Date(row.createdAt),
  });
}
