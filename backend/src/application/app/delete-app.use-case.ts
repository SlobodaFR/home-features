import { Injectable } from '@nestjs/common';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { AppRepository } from '../../domain/app/app.repository';
import { assertAppOwnership } from './assert-app-ownership';

/**
 * Deleting an App cascades to its environments, feature flags, flag values,
 * config entries and config values via SQLite FK `ON DELETE CASCADE`
 * (foreign_keys is enabled by the better-sqlite3 driver). Its API keys are
 * deleted first: `api_keys.environment_id` is `ON DELETE RESTRICT`, checked
 * immediately, so the result must not depend on the order SQLite cascades in.
 */
@Injectable()
export class DeleteAppUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    await assertAppOwnership(this.appRepository, id, userId);
    await this.apiKeyRepository.deleteAllByAppId(id);
    await this.appRepository.delete(id);
  }
}
