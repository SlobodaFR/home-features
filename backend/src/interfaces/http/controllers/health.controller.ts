import { Controller, Get } from '@nestjs/common';
import {
  RuntimeHealthMonitor,
  RuntimeHealthSample,
} from '../../../infrastructure/observability/runtime-health.monitor';
import { Public } from '../decorators/public.decorator';

/**
 * Internal health check, outside the `api` prefix: blocked by Caddy in production, reachable only
 * from the VPS / the container (Docker HEALTHCHECK). Public: no session on a health probe.
 */
@Public()
@Controller('healthz')
export class HealthController {
  constructor(private readonly monitor: RuntimeHealthMonitor) {}

  @Get()
  health(): { status: 'ok'; runtime: RuntimeHealthSample | null } {
    return { status: 'ok', runtime: this.monitor.lastSample };
  }
}
