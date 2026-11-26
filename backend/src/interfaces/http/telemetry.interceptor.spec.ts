import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import request from 'supertest';
import { EvaluateOfrepFlagsUseCase } from '../../application/ofrep/evaluate-ofrep-flags.use-case';
import { GetFlagsAndConfigsUseCase } from '../../application/public-api/get-flags-and-configs.use-case';
import { configureApp } from '../../configure-app';
import { Telemetry } from '../../domain/shared/telemetry';
import { RuntimeHealthMonitor } from '../../infrastructure/observability/runtime-health.monitor';
import { serveStaticOptions } from '../../static-assets';
import { FakeTelemetry } from '../../test-support/fake-telemetry';
import { HealthController } from './controllers/health.controller';
import { GetCurrentUserUseCase } from '../../application/auth/get-current-user.use-case';
import { MeController } from './controllers/me.controller';
import { PublicApiController } from './controllers/public-api.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { OfrepController } from './ofrep/ofrep.controller';
import { TelemetryInterceptor } from './telemetry.interceptor';

const API_KEY = `hf_${'ab'.repeat(32)}`;

/** Stand-in for JwtAuthGuard: every request is the same signed-in user. */
@Injectable()
class SignedInGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<{ user: unknown }>().user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User One',
    };
    return true;
  }
}

@Controller('items')
class ItemsController {
  @Get('boom')
  boom(): never {
    throw new TypeError('secret detail about alice@example.com');
  }

  @Get('missing')
  missing(): never {
    throw new NotFoundException('nope');
  }

  @Get(':id')
  find(@Param('id') id: string): { id: string } {
    return { id };
  }
}

describe('HTTP telemetry (real routes, stubbed use cases)', () => {
  let app: NestExpressApplication;
  let telemetry: FakeTelemetry;

  beforeEach(async () => {
    telemetry = new FakeTelemetry();
    const moduleRef = await Test.createTestingModule({
      controllers: [
        ItemsController,
        MeController,
        HealthController,
        OfrepController,
        PublicApiController,
      ],
      providers: [
        { provide: Telemetry, useValue: telemetry },
        {
          provide: GetCurrentUserUseCase,
          useValue: { execute: (user: object) => Promise.resolve(user) },
        },
        { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
        { provide: APP_GUARD, useClass: SignedInGuard },
        { provide: RuntimeHealthMonitor, useValue: { lastSample: null } },
        {
          provide: EvaluateOfrepFlagsUseCase,
          useValue: {
            evaluateOne: () =>
              Promise.resolve({
                key: 'on-flag',
                value: true,
                reason: 'STATIC',
              }),
            evaluateAll: () => Promise.resolve({ flags: [], etag: '"e"' }),
          },
        },
        {
          provide: GetFlagsAndConfigsUseCase,
          useValue: { execute: () => Promise.resolve({ flags: [] }) },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    // Same global prefix ('api', except /healthz) and OFREP body reader as main.ts.
    configureApp(app, {});
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reports each request with its parameterized route, never the raw URL or query', async () => {
    await request(app.getHttpServer())
      .get('/api/items/42?token=secret')
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(telemetry.captured[0].event).toEqual({
      name: 'http_request',
      properties: {
        route: '/api/items/:id',
        method: 'GET',
        status: 200,
        duration_ms: expect.any(Number) as number,
      },
    });
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/42|secret/);
  });

  it('reports an admin/UI route of the service', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(200);

    expect(telemetry.captured[0].event).toMatchObject({
      name: 'http_request',
      properties: { route: '/api/me', method: 'GET', status: 200 },
    });
  });

  it('reports client errors with their status', async () => {
    await request(app.getHttpServer()).get('/api/items/missing').expect(404);

    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/items/missing', status: 404 },
    });
  });

  it('reports a server error as a 500 without its message or class', async () => {
    await request(app.getHttpServer()).get('/api/items/boom').expect(500);

    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/items/boom', status: 500 },
    });
    expect(JSON.stringify(telemetry.captured)).not.toMatch(
      /alice|secret|TypeError/,
    );
  });

  it('does not report /healthz (polled by Docker)', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  // OFREP evaluation and the public flags API are polled by the other home-* services (11 services
  // x polling): reporting them would amplify the PostHog cost for no diagnostic value.
  it.each([
    [
      'OFREP evaluation of one flag',
      'post',
      '/api/ofrep/v1/evaluate/flags/on-flag',
    ],
    ['OFREP bulk evaluation', 'post', '/api/ofrep/v1/evaluate/flags'],
    [
      'the public flags-and-configs API',
      'get',
      '/api/v1/flags-and-configs?environment=production',
    ],
  ] as const)(
    'does not report %s (machine-polled)',
    async (_label, verb, url) => {
      const server = request(app.getHttpServer());
      const res = await (
        verb === 'post' ? server.post(url) : server.get(url)
      ).set('Authorization', `Bearer ${API_KEY}`);

      expect(res.status).toBe(200);
      expect(telemetry.captured).toEqual([]);
    },
  );

  it('reports nothing for a request that matches no route', async () => {
    await request(app.getHttpServer())
      .get('/api/nope/alice@example.com')
      .expect(404);

    expect(telemetry.captured).toEqual([]);
  });

  it('ignores non-HTTP contexts: a WebSocket handler sharing the global interceptor emits nothing', async () => {
    const interceptor = new TelemetryInterceptor(telemetry);
    const next = { handle: () => of('pong') };
    const wsContext = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('must not read an HTTP request on a ws context');
      },
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(wsContext, next));

    expect(telemetry.captured).toEqual([]);
  });

  it('never reports an email carried by a query string or a path parameter', async () => {
    await request(app.getHttpServer())
      .get('/api/items/alice@example.com?email=bob@example.com')
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/alice|bob|@/);
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/items/:id' },
    });
  });

  it('never reports a feature-flag API key, in a header, a query string or a path', async () => {
    await request(app.getHttpServer())
      .get(`/api/items/${API_KEY}?api_key=${API_KEY}`)
      .set('Authorization', `Bearer ${API_KEY}`)
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/hf_|ab{4}/);
  });
});

describe('HTTP telemetry (static assets and SPA)', () => {
  let root: string;
  let app: NestExpressApplication;
  let telemetry: FakeTelemetry;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(root, 'index.html'), '<html>SPA</html>');
    writeFileSync(join(root, 'app.js'), 'console.log(1)');
    telemetry = new FakeTelemetry();

    @Module({
      imports: [ServeStaticModule.forRoot(serveStaticOptions(root))],
      controllers: [ItemsController],
      providers: [
        { provide: Telemetry, useValue: telemetry },
        { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
      ],
    })
    class TestModule {}

    // NestFactory, like main.ts: ServeStaticModule only mounts its fallback this way.
    app = await NestFactory.create<NestExpressApplication>(TestModule, {
      logger: false,
    });
    configureApp(app, {});
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('emits nothing for a static asset or an SPA page (served outside Nest routes)', async () => {
    const asset = await request(app.getHttpServer()).get('/app.js');
    const page = await request(app.getHttpServer()).get(
      '/apps/alice@example.com',
    );

    expect(asset.status).toBe(200);
    expect(page.text).toContain('SPA');
    expect(telemetry.captured).toEqual([]);
  });

  it('still reports an API route on the same app', async () => {
    await request(app.getHttpServer()).get('/api/items/7').expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
  });
});
