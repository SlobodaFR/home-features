import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { applySecurityHeaders } from './security-headers';

@Controller()
class StubController {
  @Get('ping')
  ping(): string {
    return 'pong';
  }
}

describe('security headers', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(publicDir, 'index.html'), '<html></html>');
    const moduleRef = await Test.createTestingModule({
      controllers: [StubController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    applySecurityHeaders(app);
    // Static files are served after the headers middleware, as the SPA is in production.
    app.useStaticAssets(publicDir);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectStrictHeaders = (headers: Record<string, string>) => {
    const csp = headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
  };

  it('protects API responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/ping')
      .expect(200);

    expectStrictHeaders(response.headers);
  });

  it('protects the SPA pages served as static files', async () => {
    const response = await request(app.getHttpServer())
      .get('/index.html')
      .expect(200);

    expectStrictHeaders(response.headers);
  });

  it('protects error responses too', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing')
      .expect(404);

    expectStrictHeaders(response.headers);
  });
});
