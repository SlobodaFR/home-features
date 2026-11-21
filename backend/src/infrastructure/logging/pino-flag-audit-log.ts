import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlagAuditLog } from '../../application/feature-flag/flag-audit-log';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FlagValueChange } from '../../domain/feature-flag/flag-value-change';
import { pseudonymize } from '../../domain/shared/pseudonymize';

@Injectable()
export class PinoFlagAuditLog extends FlagAuditLog {
  private readonly logger = new Logger('FlagAudit');

  constructor(private readonly config: ConfigService) {
    super();
  }

  valueChanged(
    flag: FeatureFlag,
    change: FlagValueChange,
    actorIdentity: string,
  ): void {
    // validateEnv guarantees PSEUDONYM_SECRET (a development fallback outside production).
    const secret = this.config.getOrThrow<string>('PSEUDONYM_SECRET');
    this.logger.log({
      msg: 'flag value changed',
      event: 'flag_value_changed',
      flagId: flag.id,
      flagKey: flag.key,
      environmentId: change.environmentId,
      oldEnabled: change.oldEnabled,
      newEnabled: change.newEnabled,
      source: change.source,
      actorRef: pseudonymize(actorIdentity, secret),
    });
  }
}
