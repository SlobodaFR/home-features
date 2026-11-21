export const API_KEY_SCOPES = ['server', 'web'] as const;

/**
 * `server`: a backend, sees every flag of its environment. `web`: a browser-facing proxy, sees
 * only the flags marked client-exposed.
 */
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKeyProps {
  id: string;
  appId: string;
  /** The single environment this key reads. Never chosen by the caller. */
  environmentId: string;
  scope: ApiKeyScope;
  name: string;
  /** sha256 hex digest of the plaintext key. The plaintext is never stored. */
  keyHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * ApiKey grants read-only access to the flags (and, for server keys, the configs) of one App in
 * one Environment. The plaintext token is generated once at creation time and returned to the
 * caller; only its sha256 hash is persisted.
 */
export class ApiKey {
  private constructor(private readonly props: ApiKeyProps) {
    if (!props.name.trim()) {
      throw new Error('API key name must not be empty');
    }
    if (!props.keyHash.trim()) {
      throw new Error('API key hash must not be empty');
    }
    if (
      typeof props.environmentId !== 'string' ||
      !props.environmentId.trim()
    ) {
      throw new Error('API key must be bound to an environment');
    }
    if (!(API_KEY_SCOPES as readonly string[]).includes(props.scope)) {
      throw new Error('API key scope must be "server" or "web"');
    }
  }

  static create(props: ApiKeyProps): ApiKey {
    return new ApiKey(props);
  }

  get id(): string {
    return this.props.id;
  }

  get appId(): string {
    return this.props.appId;
  }

  get environmentId(): string {
    return this.props.environmentId;
  }

  get scope(): ApiKeyScope {
    return this.props.scope;
  }

  get name(): string {
    return this.props.name;
  }

  get keyHash(): string {
    return this.props.keyHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }
}
