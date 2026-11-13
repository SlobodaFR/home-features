import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { serveStaticOptions } from './static-assets';

@Controller('api')
class ApiStub {
  @Get('ping')
  ping() {
    return { pong: true };
  }
}

// Même option d'exclusion que AppModule : syntaxe Express 5 (path-to-regexp 8).
describe('SPA fallback (ServeStatic, Express 5)', () => {
  let root: string;
  let app: NestExpressApplication;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(root, 'index.html'), '<html>SPA</html>');

    @Module({
      imports: [ServeStaticModule.forRoot(serveStaticOptions(root))],
      controllers: [ApiStub],
    })
    class TestModule {}

    app = await NestFactory.create<NestExpressApplication>(TestModule, {
      logger: false,
    });
    app.setGlobalPrefix('');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('serves index.html for a client-side route', async () => {
    const response = await request(app.getHttpServer()).get('/apps/1');
    expect(response.status).toBe(200);
    expect(response.text).toContain('SPA');
  });

  it('serves the API routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/ping');
    expect(response.body).toEqual({ pong: true });
  });

  it('answers 404 on an unknown API route instead of the SPA', async () => {
    const response = await request(app.getHttpServer()).get('/api/unknown');
    expect(response.status).toBe(404);
  });
});
