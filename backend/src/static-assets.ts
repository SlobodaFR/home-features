import type { ServeStaticModuleOptions } from '@nestjs/serve-static';

/**
 * Fallback SPA : tout ce qui n'est pas une route API renvoie index.html.
 * Syntaxe Express 5 (path-to-regexp 8) : `{*path}` remplace l'ancien `*`.
 */
export function serveStaticOptions(rootPath: string): ServeStaticModuleOptions {
  return { rootPath, exclude: ['/api/{*path}'] };
}
