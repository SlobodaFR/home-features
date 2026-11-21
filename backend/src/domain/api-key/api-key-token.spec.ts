import { createHash } from 'crypto';
import {
  generateApiKeyToken,
  hashApiKeyToken,
  isWellFormedApiKeyToken,
} from './api-key-token';

describe('api-key-token', () => {
  describe('generateApiKeyToken', () => {
    it('returns hf_ followed by 64 hex characters (32 random bytes)', () => {
      const token = generateApiKeyToken();
      expect(token).toMatch(/^hf_[0-9a-f]{64}$/);
    });

    it('returns a different token on each call', () => {
      expect(generateApiKeyToken()).not.toBe(generateApiKeyToken());
    });
  });

  describe('isWellFormedApiKeyToken', () => {
    it('accepts a generated token', () => {
      expect(isWellFormedApiKeyToken(generateApiKeyToken())).toBe(true);
    });

    it.each([
      ['a legacy key without prefix', 'a'.repeat(64)],
      ['uppercase hex', `hf_${'A'.repeat(64)}`],
      ['a short key', `hf_${'a'.repeat(63)}`],
      ['a long key', `hf_${'a'.repeat(65)}`],
      ['trailing garbage', `hf_${'a'.repeat(64)}\n`],
      ['an empty string', ''],
    ])('rejects %s', (_label, token) => {
      expect(isWellFormedApiKeyToken(token)).toBe(false);
    });
  });

  describe('hashApiKeyToken', () => {
    it('returns the sha256 hex digest of the whole token, prefix included', () => {
      const token = generateApiKeyToken();
      const expected = createHash('sha256').update(token).digest('hex');
      expect(hashApiKeyToken(token)).toBe(expected);
    });

    it('produces different hashes for different tokens', () => {
      expect(hashApiKeyToken(generateApiKeyToken())).not.toBe(
        hashApiKeyToken(generateApiKeyToken()),
      );
    });
  });
});
