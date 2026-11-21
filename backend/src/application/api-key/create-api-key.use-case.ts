import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { ApiKey } from '../../domain/api-key/api-key';
import {
  generateApiKeyToken,
  hashApiKeyToken,
} from '../../domain/api-key/api-key-token';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { ApiKeyInput, ApiKeyWithSecretDto } from './api-key.dto';
import { toApiKeyDto } from './to-api-key-dto';

@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(
    appId: string,
    input: ApiKeyInput,
    userId: string,
  ): Promise<ApiKeyWithSecretDto> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const environment = await this.environmentRepository.findById(
      input.environmentId,
    );
    if (!environment || environment.appId !== appId) {
      throw new NotFoundException(
        `Environment ${input.environmentId} not found`,
      );
    }

    const token = generateApiKeyToken();

    let apiKey: ApiKey;
    try {
      apiKey = ApiKey.create({
        id: randomUUID(),
        appId,
        environmentId: environment.id,
        scope: input.scope,
        name: input.name,
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
