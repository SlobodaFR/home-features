import { Injectable } from '@nestjs/common';
import { ApiKey } from '../../domain/api-key/api-key';
import {
  hashApiKeyToken,
  isWellFormedApiKeyToken,
} from '../../domain/api-key/api-key-token';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { WriteDebouncer } from '../shared/write-debouncer';

export interface AuthenticatedApiKey {
  apiKey: ApiKey;
  app: App;
  /** Always the key's own environment: callers never choose it. */
  environment: Environment;
}

/**
 * Resolves a bearer token to its key, app and environment, or null. A token that does not have
 * the `hf_` format is refused without touching the database. Records the use (debounced).
 */
@Injectable()
export class AuthenticateApiKeyUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly debouncer: WriteDebouncer,
  ) {}

  async execute(token: string): Promise<AuthenticatedApiKey | null> {
    if (!isWellFormedApiKeyToken(token)) {
      return null;
    }
    const apiKey = await this.apiKeyRepository.findByKeyHash(
      hashApiKeyToken(token),
    );
    if (!apiKey) {
      return null;
    }
    const [app, environment] = await Promise.all([
      this.appRepository.findById(apiKey.appId),
      this.environmentRepository.findById(apiKey.environmentId),
    ]);
    if (!app || !environment || environment.appId !== app.id) {
      return null;
    }

    await this.recordUse(apiKey);
    return { apiKey, app, environment };
  }

  private async recordUse(apiKey: ApiKey): Promise<void> {
    const now = new Date();
    if (
      !this.debouncer.shouldWrite(
        `api-key:${apiKey.id}`,
        apiKey.lastUsedAt,
        now,
      )
    ) {
      return;
    }
    // Best effort: a failed usage write never fails the request.
    try {
      await this.apiKeyRepository.touchLastUsedAt(apiKey.id, now);
    } catch {
      // ignore
    }
  }
}
