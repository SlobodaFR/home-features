export interface ApiKeyDto {
  id: string;
  appId: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Returned only once, at creation time. */
export interface ApiKeyWithSecretDto extends ApiKeyDto {
  key: string;
}
