import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FlagValueChange } from '../../domain/feature-flag/flag-value-change';

/**
 * Port: one structured log line per flag value change. The actor is logged as a pseudonym of
 * `actorIdentity` (the user id for the UI, `cli:<actor>` for the CLI, so the two never collide), never in clear.
 */
export abstract class FlagAuditLog {
  abstract valueChanged(
    flag: FeatureFlag,
    change: FlagValueChange,
    actorIdentity: string,
  ): void;
}
