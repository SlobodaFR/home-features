import { createHash, randomBytes } from 'crypto';

/** `hf_` + 64 lowercase hex characters (32 random bytes). Older unprefixed keys are refused. */
export const API_KEY_TOKEN_PATTERN = /^hf_[0-9a-f]{64}$/;

/**
 * Generates a new opaque API key plaintext token. Only its hash (see
 * {@link hashApiKeyToken}) is ever persisted - the plaintext is shown to the user
 * exactly once, at creation time.
 */
export function generateApiKeyToken(): string {
  return `hf_${randomBytes(32).toString('hex')}`;
}

/** True when the token has the current format: anything else is refused without a lookup. */
export function isWellFormedApiKeyToken(token: string): boolean {
  return API_KEY_TOKEN_PATTERN.test(token);
}

/**
 * sha256 hex digest of the whole plaintext token, prefix included. No salt: the token carries 256
 * random bits, a lookup table is out of reach.
 */
export function hashApiKeyToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
