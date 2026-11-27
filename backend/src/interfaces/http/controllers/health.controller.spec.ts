import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import request from 'supertest';
import { configureApp } from '../../../configure-app';
import { RuntimeHealthMonitor } from '../../../infrastructure/observability/runtime-health.monitor';
import { serveStaticOptions } from '../../../static-assets';
import { FakeTelemetryModule } from '../../../test-support/fake-telemetry';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { HealthModule } from '../modules/health.module';

// Stand-in for JwtAuthGuard: everything needs a session unless @Public().
@Injectable()
class SessionRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

describe('GET /healthz', () => {
  let root: string;
  let app: NestExpressApplication;
  let monitor: RuntimeHealthMonitor;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(root, 'index.html'), '<html>SPA</html>');
    @Module({
      imports: [
        FakeTelemetryModule,
        ServeStaticModule.forRoot(serveStaticOptions(root)),
        HealthModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: SessionRequiredGuard }],
    })
    class TestModule {}

    // NestFactory, like main.ts: ServeStaticModule only mounts its fallback this way.
    app = await NestFactory.create<NestExpressApplication>(TestModule, {
      logger: false,
    });
    configureApp(app, {});
    await app.init();
    monitor = app.get(RuntimeHealthMonitor);
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('answers ok without a session, at the root (no /api prefix)', async () => {
    const response = await request(app.getHttpServer())
      .get('/healthz')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: 'dev',
      commit: 'dev',
      runtime: null,
    });
  });

  it('exposes the last runtime sample', async () => {
    const sample = monitor.sample();

    const response = await request(app.getHttpServer())
      .get('/healthz')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: 'dev',
      commit: 'dev',
      runtime: sample,
    });
  });

  it('is not served under the api prefix', async () => {
    const response = await request(app.getHttpServer()).get('/api/healthz');

    expect(response.status).toBe(404);
    expect(response.text).not.toContain('SPA');
  });

  it('is not shadowed by the SPA fallback, nor does it swallow sub-paths', async () => {
    const sub = await request(app.getHttpServer()).get('/healthz/anything');

    expect(sub.status).toBe(404);
    expect(sub.text).not.toContain('SPA');
    const page = await request(app.getHttpServer()).get('/apps/1');
    expect(page.status).toBe(200);
    expect(page.text).toContain('SPA');
  });

  it('answers GET /version without a session, never cached, at the root (not the SPA, not under /api)', async () => {
    const response = await request(app.getHttpServer())
      .get('/version')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ version: 'dev', commit: 'dev' });
    const api = await request(app.getHttpServer()).get('/api/version');
    expect(api.text).not.toContain('SPA');
    const sub = await request(app.getHttpServer()).get('/version/anything');
    expect(sub.status).toBe(404);
    expect(sub.text).not.toContain('SPA');
  });
});
