import { SetMetadata } from '@nestjs/common';

export const SKIP_SAME_ORIGIN_KEY = 'skipSameOrigin';

/**
 * Exempts a route (or a whole controller) from SameOriginGuard. Only for server-to-server routes
 * that carry no session cookie and authenticate themselves (webhook secret, API key, bearer):
 * a browser never calls them, so there is no CSRF to defend against.
 */
export const SkipSameOrigin = () => SetMetadata(SKIP_SAME_ORIGIN_KEY, true);
