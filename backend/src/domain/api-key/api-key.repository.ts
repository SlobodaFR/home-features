import { ApiKey } from './api-key';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class ApiKeyRepository {
  abstract findAllByAppId(appId: string): Promise<ApiKey[]>;
  abstract findById(id: string): Promise<ApiKey | null>;
  abstract findByKeyHash(keyHash: string): Promise<ApiKey | null>;
  abstract save(apiKey: ApiKey): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
