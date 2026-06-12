import { ApiKey } from '../../domain/api-key/api-key';
import { ApiKeyDto } from './api-key.dto';

export function toApiKeyDto(apiKey: ApiKey): ApiKeyDto {
  return {
    id: apiKey.id,
    appId: apiKey.appId,
    name: apiKey.name,
    createdAt: apiKey.createdAt.toISOString(),
    lastUsedAt: apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : null,
  };
}
