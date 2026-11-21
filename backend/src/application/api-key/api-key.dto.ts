import { ApiKeyScope } from '../../domain/api-key/api-key';

export interface ApiKeyDto {
  id: string;
  appId: string;
  environmentId: string;
  scope: ApiKeyScope;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Returned only once, at creation time. */
export interface ApiKeyWithSecretDto extends ApiKeyDto {
  key: string;
}

export interface ApiKeyInput {
  name: string;
  environmentId: string;
  scope: ApiKeyScope;
}
