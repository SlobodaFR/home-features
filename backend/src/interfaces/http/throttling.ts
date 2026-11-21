import { minutes, ThrottlerModuleOptions } from '@nestjs/throttler';

/** Window of every budget below. */
export const THROTTLE_WINDOW_MS = minutes(1);
/** Default: per route and per client IP (home-auth default). */
export const DEFAULT_REQUEST_LIMIT = 100;
/** API-key routes (OFREP): per authenticated key, whatever the IP. */
export const API_KEY_REQUEST_LIMIT = 300;
/** API-key routes: failed authentications per client IP. */
export const API_KEY_AUTH_FAILURE_LIMIT = 20;
/** IPv6 clients are grouped by /64 so rotating inside one allocation does not help. */
export const IPV6_SUBNET_PREFIX = 64;

/**
 * Global rate limit, applied by ThrottlerGuard (APP_GUARD) to every route not marked
 * @SkipThrottle():
 *
 * - Keyed on req.ip, resolved through `trust proxy` (TRUST_PROXY_HOPS=1 behind Caddy). Every
 *   service on the VPS reaches us from the same IP, hence per-key budgets on API-key routes.
 * - Budgets are per route and per IP (the default key includes controller and handler).
 * - In-memory storage: counters reset on restart, fine for a single instance.
 * - A 429 always carries Retry-After in seconds.
 *
 * API-key routes skip this throttler and use ApiKeyGuard, which authenticates first, then counts
 * per key (authenticated) or per IP (failed authentication).
 */
export const throttlerOptions: ThrottlerModuleOptions = {
  errorMessage: 'Too many requests, retry later',
  ipv6SubnetPrefix: IPV6_SUBNET_PREFIX,
  throttlers: [{ ttl: THROTTLE_WINDOW_MS, limit: DEFAULT_REQUEST_LIMIT }],
};
