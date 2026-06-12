import { Injectable, NotFoundException } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';

@Injectable()
export class DeleteApiKeyUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly apiKeyRepository: ApiKeyRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findById(id);
    if (!apiKey) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    const app = await this.appRepository.findById(apiKey.appId);
    if (!app || app.userId !== userId) {
      throw new NotFoundException(`API key ${id} not found`);
    }

    await this.apiKeyRepository.delete(id);
  }
}
