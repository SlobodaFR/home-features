import type { Request } from 'express';

/**
 * Parameterized route of a request ('/api/apps/:appId'), never the raw URL: no ids, query string
 * or tokens. Requests that matched no Nest route have none (null).
 */
export function routeOf(req: Request): string | null {
  const path = (req.route as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' ? `${req.baseUrl}${path}` : null;
}
