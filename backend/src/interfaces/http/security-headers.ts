import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * Security headers for every response (API and SPA static files). The CSP only allows what the
 * built front really loads: its own scripts and styles, Google Fonts (CSS + font files) and
 * `data:` images. No inline script, no eval, no third-party script.
 */
export function applySecurityHeaders(app: NestExpressApplication): void {
  app.use(
    helmet({
      strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true }, // no preload: hard to undo
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );
}
