import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Environment } from '../../domain/environment/environment';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FlagValue } from '../../domain/feature-flag/flag-value';
import { FlagValueChangeSource } from '../../domain/feature-flag/flag-value-change';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { FlagAuditLog } from './flag-audit-log';

export interface FlagValueActor {
  /** Stored in the journal and shown in the UI. */
  name: string;
  /** Pseudonymized in the log line: the user id (UI) or `cli:<name>` (CLI). */
  identity: string;
  source: FlagValueChangeSource;
}

/**
 * The single way to change a flag value (UI and CLI): value and journal entry in one
 * transaction, then a structured log line. Callers check ownership / resolve slugs first.
 */
@Injectable()
export class ChangeFlagValueService {
  constructor(
    private readonly flagValueRepository: FlagValueRepository,
    private readonly auditLog: FlagAuditLog,
  ) {}

  async execute(
    flag: FeatureFlag,
    environment: Environment,
    enabled: boolean,
    actor: FlagValueActor,
  ): Promise<FlagValue> {
    const { value, change } =
      await this.flagValueRepository.upsertRecordingChange(
        FlagValue.create({
          id: randomUUID(),
          flagId: flag.id,
          environmentId: environment.id,
          enabled,
          updatedAt: new Date(),
        }),
        { actor: actor.name, source: actor.source },
      );
    if (change) {
      this.auditLog.valueChanged(flag, change, actor.identity);
    }
    return value;
  }
}
