import { Controller, Get, Module, Req } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { configureApp } from './configure-app';

@Controller('probe')
class ProbeController {
  @Get()
  probe(@Req() req: Request) {
    return { ip: req.ip };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

async function appWith(
  env: Record<string, string | undefined>,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ProbeModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, env);
  await app.init();
  return app;
}

describe('configureApp', () => {
  it('sends no CORS header, even to an allowed-looking origin', async () => {
    const app = await appWith({ FRONTEND_URL: 'https://features.sloboda.fr' });

    const res = await request(app.getHttpServer())
      .get('/api/probe')
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    await app.close();
  });

  it('applies the security headers to every response', async () => {
    const app = await appWith({});

    const res = await request(app.getHttpServer()).get('/api/probe');

    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    await app.close();
  });

  it('does not answer a CORS preflight with permissions', async () => {
    const app = await appWith({});

    const res = await request(app.getHttpServer())
      .options('/api/probe')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('ignores X-Forwarded-For when TRUST_PROXY_HOPS is unset', async () => {
    const app = await appWith({});

    const res = await request(app.getHttpServer())
      .get('/api/probe')
      .set('X-Forwarded-For', '203.0.113.9');

    expect((res.body as { ip: string }).ip).not.toBe('203.0.113.9');
    await app.close();
  });

  it('trusts one proxy hop when TRUST_PROXY_HOPS=1: the client IP is the last X-Forwarded-For entry', async () => {
    const app = await appWith({ TRUST_PROXY_HOPS: '1' });

    const res = await request(app.getHttpServer())
      .get('/api/probe')
      .set('X-Forwarded-For', '198.51.100.7, 203.0.113.9');

    expect((res.body as { ip: string }).ip).toBe('203.0.113.9');
    await app.close();
  });
});
