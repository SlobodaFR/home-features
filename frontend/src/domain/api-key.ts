export const API_KEY_SCOPES = ['server', 'web'] as const;

/** `server`: a backend. `web`: a browser-facing proxy, sees only client-exposed flags. */
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKey {
  id: string;
  appId: string;
  environmentId: string;
  scope: ApiKeyScope;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Returned only once, at creation time. */
export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}

export function apiKeyScopeHint(scope: ApiKeyScope): string {
  return scope === 'server'
    ? 'Backend: every flag and config of the environment'
    : 'Browser proxy: only client-exposed flags';
}

export function environmentNameOf(
  environmentId: string,
  environments: { id: string; name: string }[],
): string {
  return (
    environments.find((environment) => environment.id === environmentId)
      ?.name ?? 'Unknown'
  );
}
