import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

/**
 * HTTP setup shared by main.ts and the tests. There is deliberately no CORS: the SPA is served by
 * this service (same origin) and the other apps call the public API server-to-server.
 */
export function configureApp(
  app: NestExpressApplication,
  env: Record<string, string | undefined> = process.env,
): void {
  // Number of reverse-proxy hops to trust for X-Forwarded-For (req.ip). Production: 1 (Caddy,
  // which drops client-sent X-Forwarded-For since no trusted_proxies is configured). Unset in
  // local dev, otherwise any client could spoof its IP.
  const trustProxyHops = Number(env.TRUST_PROXY_HOPS ?? 0);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
}
