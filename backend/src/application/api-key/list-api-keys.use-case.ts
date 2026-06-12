import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { ApiKeyDto } from './api-key.dto';
import { toApiKeyDto } from './to-api-key-dto';

@Injectable()
export class ListApiKeysUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(appId: string, userId: string): Promise<ApiKeyDto[]> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const apiKeys = await this.apiKeyRepository.findAllByAppId(appId);
    return apiKeys.map(toApiKeyDto);
  }
}
