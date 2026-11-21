import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import type { AuthenticatedRequest } from '../../interfaces/http/auth-session';

/**
 * Defense in depth only: pino redaction matches object keys (one level per `*`) and never looks
 * inside message strings. The real controls are that log messages never interpolate personal data
 * (use pseudonymize()), that request/response serializers keep no headers, query or body, and
 * that errors are logged through the whitelist serializer below.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body',
  'res.headers["set-cookie"]',
  'res.headers.location',
  '*.email',
  '*.token',
  '*.client_secret',
  '*.refresh_token',
];

// Express routing is case-insensitive: so are these.
const QUIET_PATHS = [/^\/assets\//i, /^\/healthz\/?$/i];

function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0];
}

/**
 * Errors are logged as { type, message, stack, code } and nothing else. Pino's standard `err`
 * serializer copies every enumerable property, and TypeORM's QueryFailedError carries `query`,
 * `parameters` and `driverError`: a failing write would log the user's email and name.
 */
function serializeError(input: unknown): Record<string, unknown> {
  // pino-http hands custom serializers an error already serialized by pino-std-serializers,
  // with the original in `.raw`: unwrap it, or type, stack and code would be lost.
  const value = (input as { raw?: unknown } | null)?.raw ?? input;
  if (!(value instanceof Error)) {
    return { type: typeof value };
  }
  const { code } = value as { code?: unknown };
  return {
    type: value.constructor.name,
    message: value.message,
    stack: value.stack,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
  };
}

export function loggerParams(
  nodeEnv: string | undefined,
  pseudonymSecret: string,
): Params {
  // Who made the request, without saying who: a stable pseudonym of the user id.
  const userRef = (req: IncomingMessage) => {
    const userId = (req as AuthenticatedRequest).user?.id;
    return userId ? { userRef: pseudonymize(userId, pseudonymSecret) } : {};
  };
  return {
    pinoHttp: {
      level: nodeEnv === 'test' ? 'silent' : 'info',
      redact: REDACT_PATHS,
      serializers: {
        // No headers (cookies, tokens), no query string (OAuth code), no IP, no body.
        req: (req: IncomingMessage) => ({
          method: req.method,
          url: pathOf(req.url),
        }),
        // No headers: Location carries authorization codes, Set-Cookie the session token.
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        err: serializeError,
      },
      customSuccessObject: (
        req: IncomingMessage,
        _res: ServerResponse,
        value: object,
      ) => ({ ...value, ...userRef(req) }),
      customErrorObject: (
        req: IncomingMessage,
        _res: ServerResponse,
        _err: Error,
        value: object,
      ) => ({ ...value, ...userRef(req) }),
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          QUIET_PATHS.some((pattern) => pattern.test(pathOf(req.url))),
      },
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },
      transport:
        nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  };
}
