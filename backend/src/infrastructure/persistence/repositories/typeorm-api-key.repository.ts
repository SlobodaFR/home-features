import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../../../domain/api-key/api-key';
import { ApiKeyRepository } from '../../../domain/api-key/api-key.repository';
import { ApiKeyOrmEntity } from '../entities/api-key.orm-entity';

@Injectable()
export class TypeOrmApiKeyRepository extends ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKeyOrmEntity)
    private readonly repository: Repository<ApiKeyOrmEntity>,
  ) {
    super();
  }

  async findAllByAppId(appId: string): Promise<ApiKey[]> {
    const rows = await this.repository.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const row = await this.repository.findOne({ where: { keyHash } });
    return row ? toDomain(row) : null;
  }

  async save(apiKey: ApiKey): Promise<void> {
    await this.repository.save({
      id: apiKey.id,
      appId: apiKey.appId,
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}

function toDomain(row: ApiKeyOrmEntity): ApiKey {
  return ApiKey.create({
    id: row.id,
    appId: row.appId,
    name: row.name,
    keyHash: row.keyHash,
    createdAt: new Date(row.createdAt),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
  });
}
