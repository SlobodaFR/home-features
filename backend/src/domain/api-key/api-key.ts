export interface ApiKeyProps {
  id: string;
  appId: string;
  name: string;
  /** sha256 hex digest of the plaintext key. The plaintext is never stored. */
  keyHash: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * ApiKey grants read-only access to an App's flags and config values via the
 * public exposure API. The plaintext token is generated once at creation
 * time and returned to the caller; only its sha256 hash is persisted.
 */
export class ApiKey {
  private constructor(private readonly props: ApiKeyProps) {
    if (!props.name.trim()) {
      throw new Error('API key name must not be empty');
    }
    if (!props.keyHash.trim()) {
      throw new Error('API key hash must not be empty');
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

  /** Returns a copy with `lastUsedAt` updated to `usedAt`. */
  withLastUsedAt(usedAt: Date): ApiKey {
    return new ApiKey({ ...this.props, lastUsedAt: usedAt });
  }
}
