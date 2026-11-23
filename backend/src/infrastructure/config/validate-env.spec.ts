import { DEV_PSEUDONYM_SECRET, validateEnv } from './validate-env';

const STRONG = 'f'.repeat(64);
const PROD = {
  NODE_ENV: 'production',
  PSEUDONYM_SECRET: STRONG,
  AUTH_SERVICE_URL: 'https://auth.sloboda.fr',
  AUTH_CLIENT_ID: 'features',
  AUTH_CLIENT_SECRET: 'client-secret',
  AUTH_WEBHOOK_SECRET: 'webhook-secret',
  FRONTEND_URL: 'https://features.sloboda.fr',
};

describe('validateEnv', () => {
  describe('in production', () => {
    it('accepts a complete configuration and returns it untouched', () => {
      expect(validateEnv(PROD)).toEqual(PROD);
    });

    // Mirrors the .env written by .github/workflows/deploy-vps.yml: a stricter rule must not
    // break the deployment.
    it('accepts the environment the deploy workflow writes', () => {
      const deployed = {
        ...PROD,
        PORT: '3000',
        TRUST_PROXY_HOPS: '1',
        DATABASE_PATH: '/app/backend/data/features.sqlite',
        MINIO_ENDPOINT: '',
        MINIO_BUCKET: '',
        MINIO_REPLICA_PATH: '',
        MINIO_REGION: '',
        MINIO_ACCESS_KEY_ID: '',
        MINIO_SECRET_ACCESS_KEY: '',
      };
      expect(validateEnv(deployed)).toEqual(deployed);
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['shorter than 32 bytes', 'x'.repeat(31)],
      ['the development fallback', DEV_PSEUDONYM_SECRET],
    ])('rejects a PSEUDONYM_SECRET that is %s', (_label, secret) => {
      expect(() => validateEnv({ ...PROD, PSEUDONYM_SECRET: secret })).toThrow(
        'PSEUDONYM_SECRET',
      );
    });

    it.each(['AUTH_CLIENT_ID', 'AUTH_CLIENT_SECRET', 'AUTH_WEBHOOK_SECRET'])(
      'rejects a missing or blank %s',
      (variable) => {
        expect(() => validateEnv({ ...PROD, [variable]: undefined })).toThrow(
          variable,
        );
        expect(() => validateEnv({ ...PROD, [variable]: '  ' })).toThrow(
          variable,
        );
      },
    );

    it.each([
      [
        'AUTH_SERVICE_URL missing',
        { AUTH_SERVICE_URL: undefined },
        'AUTH_SERVICE_URL',
      ],
      ['FRONTEND_URL missing', { FRONTEND_URL: undefined }, 'FRONTEND_URL'],
      [
        'FRONTEND_URL over http',
        { FRONTEND_URL: 'http://features.sloboda.fr' },
        'FRONTEND_URL',
      ],
      [
        'AUTH_SERVICE_URL not a URL',
        { AUTH_SERVICE_URL: 'auth.sloboda.fr' },
        'AUTH_SERVICE_URL',
      ],
    ])('rejects %s', (_label, override, variable) => {
      expect(() => validateEnv({ ...PROD, ...override })).toThrow(variable);
    });

    // An empty DATABASE_PATH (empty 1Password field) makes SQLite use a throwaway temporary
    // database: the service would run and silently lose everything.
    it('lets the image default apply when DATABASE_PATH is unset', () => {
      expect(() => validateEnv(PROD)).not.toThrow();
      expect(() =>
        validateEnv({ ...PROD, DATABASE_PATH: '/app/backend/data/f.sqlite' }),
      ).not.toThrow();
    });
  });

  describe('in every environment', () => {
    it('rejects an empty DATABASE_PATH', () => {
      expect(() => validateEnv({ ...PROD, DATABASE_PATH: '' })).toThrow(
        'DATABASE_PATH',
      );
      expect(() =>
        validateEnv({ NODE_ENV: 'development', DATABASE_PATH: '' }),
      ).toThrow('DATABASE_PATH');
    });

    it('accepts a numeric PORT', () => {
      expect(() =>
        validateEnv({ NODE_ENV: 'development', PORT: '3000' }),
      ).not.toThrow();
    });

    it.each(['-1', '1.5', 'one', ''])('rejects TRUST_PROXY_HOPS=%j', (hops) => {
      expect(() => validateEnv({ ...PROD, TRUST_PROXY_HOPS: hops })).toThrow(
        'TRUST_PROXY_HOPS',
      );
      expect(() =>
        validateEnv({ NODE_ENV: 'development', TRUST_PROXY_HOPS: hops }),
      ).toThrow('TRUST_PROXY_HOPS');
    });

    it('accepts a number of hops, or none', () => {
      expect(() =>
        validateEnv({ ...PROD, TRUST_PROXY_HOPS: '1' }),
      ).not.toThrow();
      expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
    });

    it.each(['abc', '0', '70000', ''])('rejects PORT=%j', (port) => {
      expect(() =>
        validateEnv({ NODE_ENV: 'development', PORT: port }),
      ).toThrow('PORT');
    });
  });

  describe('outside production', () => {
    it('falls back to the development secret, keeps a provided one', () => {
      expect(validateEnv({ NODE_ENV: 'development' }).PSEUDONYM_SECRET).toBe(
        DEV_PSEUDONYM_SECRET,
      );
      expect(
        validateEnv({ NODE_ENV: 'test', PSEUDONYM_SECRET: 'mine' })
          .PSEUDONYM_SECRET,
      ).toBe('mine');
    });

    it('requires nothing, so local runs and tests need no setup', () => {
      expect(() => validateEnv({})).not.toThrow();
      expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
      expect(() => validateEnv({ NODE_ENV: 'test' })).not.toThrow();
    });

    it('accepts http URLs for a local setup', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'development',
          FRONTEND_URL: 'http://localhost:3002',
        }),
      ).not.toThrow();
    });
  });

  describe('AUTH_WEBHOOK_SIGNING_SECRET (optional)', () => {
    const hex = 'ab'.repeat(32);

    it('is not required, in production or outside', () => {
      expect(() => validateEnv(PROD)).not.toThrow();
      expect(() =>
        validateEnv({ ...PROD, AUTH_WEBHOOK_SIGNING_SECRET: '' }),
      ).not.toThrow();
      expect(() => validateEnv({})).not.toThrow();
    });

    it('accepts exactly 64 lowercase hexadecimal characters', () => {
      expect(() =>
        validateEnv({ ...PROD, AUTH_WEBHOOK_SIGNING_SECRET: hex }),
      ).not.toThrow();
      expect(() =>
        validateEnv({ AUTH_WEBHOOK_SIGNING_SECRET: hex }),
      ).not.toThrow();
    });

    it('refuses any other value, everywhere, instead of silently ignoring a bad secret', () => {
      for (const value of [
        'abc',
        'g'.repeat(64),
        hex.slice(2),
        `${hex}00`,
        'AB'.repeat(32),
        `${'ab'.repeat(31)}AB`,
        ` ${hex}`,
        `${hex} `,
        `${hex}\n`,
      ]) {
        expect(() =>
          validateEnv({ ...PROD, AUTH_WEBHOOK_SIGNING_SECRET: value }),
        ).toThrow('AUTH_WEBHOOK_SIGNING_SECRET');
        expect(() =>
          validateEnv({ AUTH_WEBHOOK_SIGNING_SECRET: value }),
        ).toThrow('AUTH_WEBHOOK_SIGNING_SECRET');
      }
    });

    it('never echoes the value', () => {
      let message = '';
      try {
        validateEnv({ AUTH_WEBHOOK_SIGNING_SECRET: 'very-secret' });
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }
      expect(message).toContain('AUTH_WEBHOOK_SIGNING_SECRET');
      expect(message).not.toContain('very-secret');
    });
  });
});
