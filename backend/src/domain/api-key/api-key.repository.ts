import { ApiKey } from './api-key';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class ApiKeyRepository {
  abstract findAllByAppId(appId: string): Promise<ApiKey[]>;
  abstract findById(id: string): Promise<ApiKey | null>;
  abstract findByKeyHash(keyHash: string): Promise<ApiKey | null>;
  abstract countByEnvironmentId(environmentId: string): Promise<number>;
  abstract save(apiKey: ApiKey): Promise<void>;
  /** Updates last_used_at only: never rewrites the environment or the scope. */
  abstract touchLastUsedAt(id: string, usedAt: Date): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract deleteAllByAppId(appId: string): Promise<void>;
}
