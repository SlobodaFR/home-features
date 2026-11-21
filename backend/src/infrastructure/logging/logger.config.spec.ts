import { Writable } from 'stream';
import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import type { AuthenticatedRequest } from '../../interfaces/http/auth-session';
import { loggerParams, REDACT_PATHS } from './logger.config';

const SECRET = 'f'.repeat(64);

type Serializer = (value: unknown) => unknown;

function pinoHttpOptions(): Record<string, unknown> {
  return loggerParams('production', SECRET).pinoHttp as Record<string, unknown>;
}

function serializers(): Record<'req' | 'res' | 'err', Serializer> {
  return pinoHttpOptions().serializers as Record<
    'req' | 'res' | 'err',
    Serializer
  >;
}

function capture(): { lines: string[]; stream: Writable } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  return { lines, stream };
}

// pino-http writes its line on the response 'finish' event, which can land after supertest resolves.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

function queryFailure(): QueryFailedError {
  return new QueryFailedError(
    'INSERT INTO users (email, name) VALUES (?, ?)',
    ['alice@example.com', 'Alice Martin'],
    Object.assign(new Error('SQLITE_BUSY: database is locked'), {
      code: 'SQLITE_BUSY',
    }),
  );
}

describe('err serializer', () => {
  it('keeps only type, message, stack and code of an error', () => {
    const error = Object.assign(new Error('boom'), {
      code: 'E_BOOM',
      response: { body: 'secret' },
      config: { headers: { authorization: 'Bearer x' } },
      cause: { email: 'alice@example.com' },
    });

    const serialized = serializers().err(error) as Record<string, unknown>;

    expect(Object.keys(serialized).toSorted()).toEqual([
      'code',
      'message',
      'stack',
      'type',
    ]);
    expect(serialized.type).toBe('Error');
    expect(serialized.message).toBe('boom');
    expect(serialized.code).toBe('E_BOOM');
  });

  // TypeORM's QueryFailedError carries query, parameters and driverError: with pino's default
  // serializer, a failing write would log the user's email and name.
  it('never logs the parameters of a failed query', () => {
    const { lines, stream } = capture();
    const logger = pino(
      {
        redact: REDACT_PATHS,
        serializers: { err: serializers().err },
      },
      stream,
    );

    logger.error({ err: queryFailure() }, 'request errored');

    const output = lines.join('');
    expect(output).toContain('QueryFailedError');
    expect(output).toContain('SQLITE_BUSY');
    expect(output).not.toContain('alice@example.com');
    expect(output).not.toContain('Alice Martin');
    expect(output).not.toContain('parameters');
    expect(output).not.toContain('INSERT INTO');
  });

  // pino-http passes custom serializers an error already serialized by pino-std-serializers.
  it('unwraps the original error pino-http hands over in .raw', () => {
    const wrapped = { type: 'Error', message: 'x', raw: queryFailure() };

    const serialized = serializers().err(wrapped) as Record<string, unknown>;

    expect(serialized.type).toBe('QueryFailedError');
    expect(serialized.code).toBe('SQLITE_BUSY');
    expect(JSON.stringify(serialized)).not.toContain('alice@example.com');
  });

  it('does not choke on a thrown value that is not an Error', () => {
    expect(serializers().err('plain string')).toEqual({ type: 'string' });
  });
});

describe('request and response serializers', () => {
  it('logs requests as method and path only: no query string, headers, body or IP', () => {
    const serialized = serializers().req({
      method: 'GET',
      url: '/api/auth/callback?code=abc',
      headers: { cookie: 'access_token=x', authorization: 'Bearer y' },
      body: { email: 'alice@example.com' },
      remoteAddress: '203.0.113.7',
    });

    expect(serialized).toEqual({ method: 'GET', url: '/api/auth/callback' });
  });

  it('logs responses as status code only: no Location or Set-Cookie header', () => {
    const serialized = serializers().res({
      statusCode: 302,
      headers: {
        location: 'https://features.example/cb?code=secret',
        'set-cookie': 'access_token=jwt',
      },
    });

    expect(serialized).toEqual({ statusCode: 302 });
  });

  it('redacts personal and secret fields in structured log objects', () => {
    const { lines, stream } = capture();
    const logger = pino({ redact: REDACT_PATHS }, stream);

    logger.info(
      {
        user: { email: 'a@b.c', token: 't0k3n' },
        req: {
          headers: { authorization: 'Bearer abc', cookie: 'access_token=jwt' },
          body: { name: 'Alice Martin' },
        },
        err: { code: 'SQLITE_BUSY' },
      },
      'event',
    );

    const output = lines.join('');
    expect(output).not.toContain('a@b.c');
    expect(output).not.toContain('t0k3n');
    expect(output).not.toContain('Bearer abc');
    expect(output).not.toContain('access_token=jwt');
    expect(output).not.toContain('Alice Martin');
    expect(output).toContain('SQLITE_BUSY');
  });
});

class FakeSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.headers['x-test-user']) {
      req.user = {
        id: 'user-42',
        email: 'alice@example.com',
        name: 'Alice Martin',
      };
    }
    return true;
  }
}

@UseGuards(FakeSessionGuard)
@Controller('probe')
class ProbeController {
  @Get('ok')
  ok(@Req() req: AuthenticatedRequest) {
    return { user: req.user?.id };
  }

  @Post('write')
  write(): never {
    throw queryFailure();
  }
}

// nestjs-pino keeps its root logger in a static: the first stream wins for the whole file, so one
// shared capture is reset between tests.
const shared = capture();

describe('logging through the real NestJS stack', () => {
  beforeEach(() => {
    shared.lines.length = 0;
  });

  async function appLoggingTo(
    stream: Writable,
  ): Promise<NestExpressApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({ pinoHttp: [pinoHttpOptions(), stream] }),
      ],
      controllers: [ProbeController],
    }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({
      bufferLogs: true,
    });
    app.useLogger(app.get(Logger));
    await app.init();
    return app;
  }

  // Nest's exception filter logs unhandled errors with logger.error(exception).
  it('does not leak query parameters when a write fails with a 500', async () => {
    const { lines, stream } = shared;
    const app = await appLoggingTo(stream);

    await request(app.getHttpServer())
      .post('/probe/write')
      .set('Cookie', 'access_token=jwt-value')
      .set('Authorization', 'Bearer bearer-value')
      .send({ email: 'alice@example.com', name: 'Alice Martin' })
      .expect(500);
    await settle();
    await app.close();

    const output = lines.join('');
    const logged = lines
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const withError = logged.filter((line) => line.err !== undefined);
    const err = (line: Record<string, unknown>) =>
      line.err as Record<string, unknown>;
    // Nest's exception filter line: the thrown error, whitelisted.
    const filterLine = withError.find(
      (line) => line.context === 'ExceptionsHandler',
    );
    expect(filterLine).toBeDefined();
    expect(Object.keys(err(filterLine!)).toSorted()).toEqual([
      'code',
      'message',
      'stack',
      'type',
    ]);
    expect(err(filterLine!).type).toBe('QueryFailedError');
    expect(err(filterLine!).code).toBe('SQLITE_BUSY');
    expect(err(filterLine!).stack).toEqual(
      expect.stringContaining('QueryFailedError'),
    );
    // pino-http's own "request errored" line: still type, message and stack, nothing else.
    const requestLine = withError.find(
      (line) => line.msg === 'request errored',
    );
    expect(requestLine).toBeDefined();
    expect(
      Object.keys(err(requestLine!))
        .filter((key) => key !== 'code')
        .toSorted(),
    ).toEqual(['message', 'stack', 'type']);
    for (const secret of [
      'alice@example.com',
      'Alice Martin',
      'jwt-value',
      'bearer-value',
      'INSERT INTO',
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it('logs an authenticated request with a pseudonym, never the user id, email or name', async () => {
    const { lines, stream } = shared;
    const app = await appLoggingTo(stream);

    await request(app.getHttpServer())
      .get('/probe/ok?token=query-secret')
      .set('X-Test-User', '1')
      .expect(200);
    await settle();
    await app.close();

    const output = lines.join('');
    expect(output).toContain(pseudonymize('user-42', SECRET));
    for (const secret of [
      'user-42',
      'alice@example.com',
      'Alice Martin',
      'query-secret',
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it('logs nothing for static assets, but still logs API requests', async () => {
    const { lines, stream } = shared;
    const app = await appLoggingTo(stream);

    await request(app.getHttpServer()).get('/assets/app.js');
    await request(app.getHttpServer()).get('/probe/ok').expect(200);
    await settle();
    await app.close();

    const output = lines.join('');
    expect(output).toContain('/probe/ok');
    expect(output).not.toContain('/assets/');
  });
});
