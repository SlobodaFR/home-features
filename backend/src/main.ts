import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildInfo } from './infrastructure/observability/build-info';
import { configureApp, nestApplicationOptions } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    ...nestApplicationOptions,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);
  // SIGTERM (every deploy) flushes the telemetry queue: PostHogTelemetry.onApplicationShutdown.
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 3002;
  await app.listen(port);
  const { version, commit } = buildInfo();
  app
    .get(Logger)
    .log(`home-features started version=${version} commit=${commit}`);
}

void bootstrap();
