import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  RuntimeHealthMonitor,
  RuntimeHealthSample,
} from '../../../infrastructure/observability/runtime-health.monitor';
import { buildInfo } from '../../../infrastructure/observability/build-info';
import { Public } from '../decorators/public.decorator';

/**
 * Internal health check, outside the `api` prefix: blocked by Caddy in production, reachable only
 * from the VPS / the container (Docker HEALTHCHECK). Public: no session on a health probe.
 */
// Never rate limited: the Docker HEALTHCHECK must always get an answer.
@SkipThrottle()
@Public()
@Controller('healthz')
export class HealthController {
  constructor(private readonly monitor: RuntimeHealthMonitor) {}

  @Get()
  health(): {
    status: 'ok';
    version: string;
    commit: string;
    runtime: RuntimeHealthSample | null;
  } {
    return { status: 'ok', ...buildInfo(), runtime: this.monitor.lastSample };
  }
}
