export interface ApiKey {
  id: string;
  appId: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Returned only once, at creation time. */
export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}
