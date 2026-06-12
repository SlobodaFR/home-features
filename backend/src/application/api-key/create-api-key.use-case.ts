import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { ApiKey } from '../../domain/api-key/api-key';
import {
  generateApiKeyToken,
  hashApiKeyToken,
} from '../../domain/api-key/api-key-token';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { ApiKeyWithSecretDto } from './api-key.dto';
import { toApiKeyDto } from './to-api-key-dto';

@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(
    appId: string,
    name: string,
    userId: string,
  ): Promise<ApiKeyWithSecretDto> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const token = generateApiKeyToken();

    let apiKey: ApiKey;
    try {
      apiKey = ApiKey.create({
        id: randomUUID(),
        appId,
        name,
        keyHash: hashApiKeyToken(token),
        createdAt: new Date(),
        lastUsedAt: null,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid API key',
      );
    }

    await this.apiKeyRepository.save(apiKey);

    return { ...toApiKeyDto(apiKey), key: token };
  }
}
