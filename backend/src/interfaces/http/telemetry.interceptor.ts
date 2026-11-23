import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { Telemetry } from '../../domain/shared/telemetry';
import { routeOf } from './route-of';

/**
 * Not reported as http_request: polled, high volume, no debugging value. Route templates as Nest
 * registers them (global prefix 'api', except healthz).
 */
const UNREPORTED_ROUTES = new Set([
  // Probed by the Docker HEALTHCHECK every 30 s.
  '/healthz',
  // OFREP flag evaluation and the legacy flags-and-configs API: polled by the other home-*
  // services' providers (11 services x polling), never by a person. A cost amplifier with no
  // diagnostic value; the admin/UI routes stay reported.
  '/api/ofrep/v1/evaluate/flags',
  '/api/ofrep/v1/evaluate/flags/:key',
  '/api/v1/flags-and-configs',
]);

/**
 * Reports every request handled by a Nest route (http_request). Reads only the matched route
 * template, the method and the status: never the URL, query, params, headers, body, IP or user.
 */
@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: Telemetry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // A global interceptor also runs on WebSocket handlers: no route, no method, one event per message.
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const route = routeOf(req);
    if (route === null || UNREPORTED_ROUTES.has(route)) {
      return next.handle();
    }
    const startedAt = performance.now();
    const report = (status: number) => {
      this.telemetry.capture({
        name: 'http_request',
        properties: {
          route,
          method: req.method,
          status,
          duration_ms: Math.round(performance.now() - startedAt),
        },
      });
    };

    return next.handle().pipe(
      tap({
        next: () => {
          report(res.statusCode);
        },
        // The exception filter writes the response later: derive the status from the error.
        error: (error: unknown) => {
          report(error instanceof HttpException ? error.getStatus() : 500);
        },
      }),
    );
  }
}
