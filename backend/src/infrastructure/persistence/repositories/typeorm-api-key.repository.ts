import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ApiKey, ApiKeyScope } from '../../../domain/api-key/api-key';
import { ApiKeyRepository } from '../../../domain/api-key/api-key.repository';
import { ApiKeyOrmEntity } from '../entities/api-key.orm-entity';

// Rows without environment cannot exist after the ApiKeyEnvironment migration; never load one.
const BOUND = { environmentId: Not(IsNull()) };

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
      where: { appId, ...BOUND },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.repository.findOne({ where: { id, ...BOUND } });
    return row ? toDomain(row) : null;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKey | null> {
    const row = await this.repository.findOne({
      where: { keyHash, ...BOUND },
    });
    return row ? toDomain(row) : null;
  }

  countByEnvironmentId(environmentId: string): Promise<number> {
    return this.repository.count({ where: { environmentId } });
  }

  async save(apiKey: ApiKey): Promise<void> {
    await this.repository.save({
      id: apiKey.id,
      appId: apiKey.appId,
      environmentId: apiKey.environmentId,
      scope: apiKey.scope,
      name: apiKey.name,
      keyHash: apiKey.keyHash,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
    });
  }

  async touchLastUsedAt(id: string, usedAt: Date): Promise<void> {
    await this.repository.update({ id }, { lastUsedAt: usedAt });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async deleteAllByAppId(appId: string): Promise<void> {
    await this.repository.delete({ appId });
  }
}

function toDomain(row: ApiKeyOrmEntity): ApiKey {
  return ApiKey.create({
    id: row.id,
    appId: row.appId,
    environmentId: row.environmentId as string,
    scope: row.scope as ApiKeyScope,
    name: row.name,
    keyHash: row.keyHash,
    createdAt: new Date(row.createdAt),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : null,
  });
}
