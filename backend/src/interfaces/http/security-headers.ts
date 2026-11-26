import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}

/**
 * Security headers for every response (API and SPA static files). The CSP only allows what the
 * built front really loads: its own scripts and styles, Google Fonts (CSS + font files), `data:`
 * images and the user's avatar (home-auth origin, ui-avatars). No inline script, no eval, no
 * third-party script.
 */
export function applySecurityHeaders(
  app: NestExpressApplication,
  authServiceUrl?: string,
): void {
  const authOrigin = originOf(authServiceUrl);
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
          // The user's avatar is served by home-auth, which redirects generated ones to ui-avatars.
          imgSrc: [
            "'self'",
            'data:',
            ...(authOrigin ? [authOrigin] : []),
            'https://ui-avatars.com',
          ],
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
