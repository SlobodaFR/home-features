import type { WebhookClock } from '../domain/auth/webhook-signature';

/** Test clock: fixed until moved. */
export class FakeClock implements WebhookClock {
  constructor(private current: Date) {}

  static at(iso: string): FakeClock {
    return new FakeClock(new Date(iso));
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(iso: string): void {
    this.current = new Date(iso);
  }
}
