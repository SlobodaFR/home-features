import { Controller, Get, Module, Req, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SkipThrottle,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { configureApp } from '../../configure-app';
import {
  generateApiKeyToken,
  hashApiKeyToken,
} from '../../domain/api-key/api-key-token';
import { ENTITIES } from '../../infrastructure/persistence/entities';
import { MIGRATIONS } from '../../infrastructure/persistence/migrations';
import { FakeTelemetryModule } from '../../test-support/fake-telemetry';
import { testConfigModule } from '../../test-support/test-config.module';
import { HealthController } from './controllers/health.controller';
import { ApiKeyGuard, type ApiKeyRequest } from './guards/api-key.guard';
import { FeatureFlagModule } from './modules/feature-flag.module';
import { HealthModule } from './modules/health.module';
import {
  API_KEY_AUTH_FAILURE_LIMIT,
  API_KEY_REQUEST_LIMIT,
  DEFAULT_REQUEST_LIMIT,
  throttlerOptions,
} from './throttling';

@Controller('probe')
class ProbeController {
  @Get('a')
  a() {
    return { ok: true };
  }

  @Get('b')
  b() {
    return { ok: true };
  }
}

// Shaped like the OFREP controller: authenticated by API key, budgets per key.
@SkipThrottle()
@UseGuards(ApiKeyGuard)
@Controller('keyed')
class KeyedController {
  @Get()
  read(@Req() req: ApiKeyRequest) {
    return { key: req.apiKey?.apiKey.id };
  }
}

@Module({
  imports: [FeatureFlagModule],
  controllers: [ProbeController, KeyedController],
})
class ProbeModule {}

describe('rate limiting', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testConfigModule(),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
        }),
        ThrottlerModule.forRoot(throttlerOptions),
        FakeTelemetryModule,
        ProbeModule,
        HealthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, { TRUST_PROXY_HOPS: '1' });
    await app.init();
    dataSource = moduleRef.get(DataSource);
    await dataSource.query(
      "INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, '2026-11-01 10:00:00')",
    );
    await dataSource.query(
      "INSERT INTO environments (id, app_id, name, slug, \"order\", created_at) VALUES ('e1', 'a1', 'Production', 'production', 0, '2026-11-01 10:00:00')",
    );
  });

  afterAll(async () => {
    await app.close();
  });

  let ipCounter = 0;
  /** A fresh client IP per test, seen through one trusted proxy hop (Caddy). */
  function freshIp(): string {
    ipCounter += 1;
    return `198.51.100.${ipCounter.toString()}`;
  }

  async function createKey(id: string): Promise<string> {
    const token = generateApiKeyToken();
    await dataSource.query(
      "INSERT INTO api_keys (id, app_id, name, key_hash, created_at, environment_id, scope) VALUES (?, 'a1', ?, ?, '2026-11-01 10:00:00', 'e1', 'server')",
      [id, id, hashApiKeyToken(token)],
    );
    return token;
  }

  async function hit(
    path: string,
    ip: string,
    times: number,
    authorization?: string,
  ): Promise<number[]> {
    const statuses: number[] = [];
    for (let i = 0; i < times; i += 1) {
      const req = request(app.getHttpServer())
        .get(path)
        .set('X-Forwarded-For', ip);
      if (authorization) {
        void req.set('Authorization', authorization);
      }
      statuses.push((await req).status);
    }
    return statuses;
  }

  function expectRetryAfter(res: request.Response): void {
    const retryAfter = Number(res.headers['retry-after']);
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  }

  it('limits each route to 100 requests per minute per client IP, with Retry-After', async () => {
    expect(DEFAULT_REQUEST_LIMIT).toBe(100);
    const ip = freshIp();

    const statuses = await hit('/api/probe/a', ip, DEFAULT_REQUEST_LIMIT);
    const refused = await request(app.getHttpServer())
      .get('/api/probe/a')
      .set('X-Forwarded-For', ip);

    expect(new Set(statuses)).toEqual(new Set([200]));
    expect(refused.status).toBe(429);
    expectRetryAfter(refused);
    // Budgets are per route and per IP.
    expect(await hit('/api/probe/b', ip, 1)).toEqual([200]);
    expect(await hit('/api/probe/a', freshIp(), 1)).toEqual([200]);
  });

  it('never limits /healthz', async () => {
    const ip = freshIp();

    const statuses = await hit('/healthz', ip, DEFAULT_REQUEST_LIMIT + 20);

    expect(new Set(statuses)).toEqual(new Set([200]));
  });

  it('gives each API key its own budget of 300 requests per minute, whatever the IP', async () => {
    expect(API_KEY_REQUEST_LIMIT).toBe(300);
    const first = await createKey('k-first');
    const second = await createKey('k-second');
    const ip = freshIp();

    const statuses = await hit(
      '/api/keyed',
      ip,
      API_KEY_REQUEST_LIMIT,
      `Bearer ${first}`,
    );
    const refused = await request(app.getHttpServer())
      .get('/api/keyed')
      .set('X-Forwarded-For', freshIp())
      .set('Authorization', `Bearer ${first}`);

    expect(new Set(statuses)).toEqual(new Set([200]));
    expect(refused.status).toBe(429);
    expectRetryAfter(refused);
    expect(await hit('/api/keyed', ip, 1, `Bearer ${second}`)).toEqual([200]);
  });

  it('limits failed authentications to 20 per minute per IP: random bearers get no fresh bucket', async () => {
    expect(API_KEY_AUTH_FAILURE_LIMIT).toBe(20);
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < API_KEY_AUTH_FAILURE_LIMIT; i += 1) {
      statuses.push(
        ...(await hit('/api/keyed', ip, 1, `Bearer ${generateApiKeyToken()}`)),
      );
    }

    const refused = await request(app.getHttpServer())
      .get('/api/keyed')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${generateApiKeyToken()}`);

    expect(new Set(statuses)).toEqual(new Set([401]));
    expect(refused.status).toBe(429);
    expectRetryAfter(refused);
    // Missing and malformed headers count too.
    expect(await hit('/api/keyed', ip, 1)).toEqual([429]);
    // Every service on the VPS shares that IP: a valid key still gets through.
    const valid = await createKey('k-behind-same-ip');
    expect(await hit('/api/keyed', ip, 1, `Bearer ${valid}`)).toEqual([200]);
    // Another IP is not affected.
    expect(
      await hit('/api/keyed', freshIp(), 1, `Bearer ${generateApiKeyToken()}`),
    ).toEqual([401]);
  });

  it('never authenticates with a session cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/keyed')
      .set('X-Forwarded-For', freshIp())
      .set('Cookie', 'access_token=whatever; refresh_token=whatever');

    expect(res.status).toBe(401);
  });
});

describe('rate limiting wiring of the real application', () => {
  it('imports ThrottlerModule and registers ThrottlerGuard globally', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    const providers = Reflect.getMetadata('providers', AppModule) as {
      provide?: unknown;
      useClass?: unknown;
    }[];

    expect(
      imports.some(
        (entry) =>
          (entry as { module?: unknown } | null)?.module === ThrottlerModule,
      ),
    ).toBe(true);
    expect(
      providers.some(
        (provider) =>
          provider.provide === APP_GUARD &&
          provider.useClass === ThrottlerGuard,
      ),
    ).toBe(true);
  });

  it('skips the health check', () => {
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', HealthController)).toBe(
      true,
    );
  });
});
