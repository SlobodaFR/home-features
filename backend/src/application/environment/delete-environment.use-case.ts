import { ConflictException, Injectable } from '@nestjs/common';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { AppRepository } from '../../domain/app/app.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertEnvironmentOwnership } from './assert-environment-ownership';

/**
 * Deleting an Environment cascades to its flag values and config values via SQLite FK
 * `ON DELETE CASCADE`. It is refused (409) while API keys are bound to it: a consumer would
 * silently lose its flags. The FK `api_keys.environment_id ... ON DELETE RESTRICT` backs this up.
 */
@Injectable()
export class DeleteEnvironmentUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    await assertEnvironmentOwnership(
      this.environmentRepository,
      this.appRepository,
      id,
      userId,
    );
    if ((await this.apiKeyRepository.countByEnvironmentId(id)) > 0) {
      throw new ConflictException(
        'API keys are bound to this environment: revoke them first',
      );
    }
    await this.environmentRepository.delete(id);
  }
}
