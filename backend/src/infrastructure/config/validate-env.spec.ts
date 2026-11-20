import { validateEnv } from './validate-env';

const PROD = {
  NODE_ENV: 'production',
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
    it('rejects an empty DATABASE_PATH but lets the image default apply when unset', () => {
      expect(() => validateEnv({ ...PROD, DATABASE_PATH: '' })).toThrow(
        'DATABASE_PATH',
      );
      expect(() => validateEnv(PROD)).not.toThrow();
      expect(() =>
        validateEnv({ ...PROD, DATABASE_PATH: '/app/backend/data/f.sqlite' }),
      ).not.toThrow();
    });
  });

  describe('in every environment', () => {
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
});
