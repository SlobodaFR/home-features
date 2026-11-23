import { Global, Module } from '@nestjs/common';
import { Telemetry, TelemetryEvent } from '../domain/shared/telemetry';

/** Records what would leave the system. */
export class FakeTelemetry extends Telemetry {
  readonly captured: { event: TelemetryEvent }[] = [];

  capture(event: TelemetryEvent): void {
    this.captured.push({ event });
  }

  names(): string[] {
    return this.captured.map(({ event }) => event.name);
  }
}

/** What TelemetryModule is in the application: the global Telemetry port, recording. */
@Global()
@Module({
  providers: [{ provide: Telemetry, useClass: FakeTelemetry }],
  exports: [Telemetry],
})
export class FakeTelemetryModule {}
