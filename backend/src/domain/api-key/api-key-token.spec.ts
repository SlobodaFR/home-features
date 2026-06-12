import { createHash } from 'crypto';
import { generateApiKeyToken, hashApiKeyToken } from './api-key-token';

describe('api-key-token', () => {
  describe('generateApiKeyToken', () => {
    it('returns a 64-character hex string (32 random bytes)', () => {
      const token = generateApiKeyToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different token on each call', () => {
      expect(generateApiKeyToken()).not.toBe(generateApiKeyToken());
    });
  });

  describe('hashApiKeyToken', () => {
    it('returns the sha256 hex digest of the token', () => {
      const token = 'my-plaintext-token';
      const expected = createHash('sha256').update(token).digest('hex');
      expect(hashApiKeyToken(token)).toBe(expected);
    });

    it('is deterministic', () => {
      const token = generateApiKeyToken();
      expect(hashApiKeyToken(token)).toBe(hashApiKeyToken(token));
    });

    it('produces different hashes for different tokens', () => {
      const a = generateApiKeyToken();
      const b = generateApiKeyToken();
      expect(hashApiKeyToken(a)).not.toBe(hashApiKeyToken(b));
    });
  });
});
