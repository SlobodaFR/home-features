import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { normalizeIp, ThrottlerStorage } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  AuthenticateApiKeyUseCase,
  AuthenticatedApiKey,
} from '../../../application/api-key/authenticate-api-key.use-case';
import {
  API_KEY_AUTH_FAILURE_LIMIT,
  API_KEY_REQUEST_LIMIT,
  IPV6_SUBNET_PREFIX,
  THROTTLE_WINDOW_MS,
} from '../throttling';

export interface ApiKeyRequest extends Request {
  apiKey?: AuthenticatedApiKey;
}

export class TooManyRequestsException extends HttpException {
  constructor() {
    super('Too many requests, retry later', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Bearer API key authentication with its own rate limit, for routes marked @SkipThrottle():
 *
 * 1. Authenticates from `Authorization: Bearer hf_...` only. Cookies are never read: a browser
 *    session alone is a 401.
 * 2. Authenticated: counted per key (300/min), so services sharing the VPS IP do not share a
 *    budget. Failed: counted per client IP (20/min, then 429): an attacker cannot get a fresh
 *    bucket by sending random bearers. A valid key is never refused because of others' failures.
 * 3. Every 429 carries Retry-After in seconds.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authenticateApiKey: AuthenticateApiKeyUseCase,
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiKeyRequest>();
    const response = http.getResponse<Response>();

    const token = bearerToken(request.headers.authorization);
    const authenticated = token
      ? await this.authenticateApiKey.execute(token)
      : null;

    if (!authenticated) {
      await this.consume(
        response,
        `api-key-auth-failure:${normalizeIp(request.ip ?? '', IPV6_SUBNET_PREFIX)}`,
        API_KEY_AUTH_FAILURE_LIMIT,
        'api-key-auth-failure',
      );
      throw new UnauthorizedException('Missing or invalid API key');
    }

    await this.consume(
      response,
      `api-key:${authenticated.apiKey.id}`,
      API_KEY_REQUEST_LIMIT,
      'api-key',
    );
    request.apiKey = authenticated;
    return true;
  }

  private async consume(
    response: Response,
    key: string,
    limit: number,
    name: string,
  ): Promise<void> {
    const record = await this.storage.increment(
      key,
      THROTTLE_WINDOW_MS,
      limit,
      THROTTLE_WINDOW_MS,
      name,
    );
    if (record.isBlocked) {
      response.setHeader(
        'Retry-After',
        Math.max(1, record.timeToBlockExpire).toString(),
      );
      throw new TooManyRequestsException();
    }
  }
}

function bearerToken(header: string | undefined): string | null {
  const match = header ? /^Bearer ([^\s]+)$/i.exec(header) : null;
  return match ? match[1] : null;
}
