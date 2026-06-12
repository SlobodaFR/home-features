import { createHash, randomBytes } from 'crypto';

/**
 * Generates a new opaque API key plaintext token. Only its hash (see
 * {@link hashApiKey}) is ever persisted - the plaintext is shown to the user
 * exactly once, at creation time.
 */
export function generateApiKeyToken(): string {
  return randomBytes(32).toString('hex');
}

/** Computes the sha256 hex digest of a plaintext API key token. */
export function hashApiKeyToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
