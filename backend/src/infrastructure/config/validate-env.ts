/** Used outside production only, so local runs and tests need no setup. Rejected in production. */
export const DEV_PSEUDONYM_SECRET =
  'dev-only-pseudonym-secret-not-for-production';

const MIN_SECRET_BYTES = 32;

/** Variables the code cannot run without in production (read with getOrThrow). */
const REQUIRED_IN_PRODUCTION = [
  'AUTH_CLIENT_ID',
  'AUTH_CLIENT_SECRET',
  'AUTH_WEBHOOK_SECRET',
];

/** Public URLs: OAuth redirect_uri, post-login redirect, token verification. https only. */
const HTTPS_URLS_IN_PRODUCTION = ['AUTH_SERVICE_URL', 'FRONTEND_URL'];

/**
 * Environment validation, run once at startup by ConfigModule. Throwing here stops the service
 * before it serves anything with an unsafe configuration. Outside production nothing is required,
 * so local runs and tests need no setup.
 */
export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  assertCount(env.TRUST_PROXY_HOPS, 'TRUST_PROXY_HOPS', 0);
  if (env.PORT !== undefined) {
    assertCount(env.PORT, 'PORT', 1, 65_535);
  }

  // Unset is fine (the image sets a default); empty would make SQLite use a throwaway database,
  // in development as much as in production.
  if (
    env.DATABASE_PATH !== undefined &&
    (typeof env.DATABASE_PATH !== 'string' || env.DATABASE_PATH.trim() === '')
  ) {
    throw new Error('DATABASE_PATH must not be empty');
  }

  const secret =
    typeof env.PSEUDONYM_SECRET === 'string' ? env.PSEUDONYM_SECRET : '';
  if (env.NODE_ENV !== 'production') {
    return { ...env, PSEUDONYM_SECRET: secret || DEV_PSEUDONYM_SECRET };
  }
  if (
    Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES ||
    secret === DEV_PSEUDONYM_SECRET
  ) {
    throw new Error(
      `PSEUDONYM_SECRET must be set in production to a random value of at least ${MIN_SECRET_BYTES.toString()} bytes (openssl rand -base64 48)`,
    );
  }
  for (const variable of REQUIRED_IN_PRODUCTION) {
    if (typeof env[variable] !== 'string' || env[variable].trim() === '') {
      throw new Error(`${variable} must be set in production`);
    }
  }
  for (const variable of HTTPS_URLS_IN_PRODUCTION) {
    assertHttpsUrl(env[variable], variable);
  }
  return env;
}

function assertCount(
  value: unknown,
  variable: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): void {
  if (value === undefined) {
    return;
  }
  const text = typeof value === 'string' ? value.trim() : '';
  const parsed = Number(text);
  if (
    text === '' ||
    !Number.isInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `${variable} must be an integer between ${min.toString()} and ${max.toString()}`,
    );
  }
}

function assertHttpsUrl(value: unknown, variable: string): void {
  let url: URL | null = null;
  try {
    url = typeof value === 'string' ? new URL(value) : null;
  } catch {
    url = null;
  }
  if (url?.protocol !== 'https:') {
    throw new Error(`${variable} must be set in production to an https:// URL`);
  }
}
