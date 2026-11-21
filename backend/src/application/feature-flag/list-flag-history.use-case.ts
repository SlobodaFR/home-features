import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueChangeRepository } from '../../domain/feature-flag/flag-value-change.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';
import { FlagValueChangeDto } from './feature-flag.dto';

/** Enough for the UI; the full journal stays in the database. */
export const FLAG_HISTORY_LIMIT = 200;

@Injectable()
export class ListFlagHistoryUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly changeRepository: FlagValueChangeRepository,
  ) {}

  async execute(flagId: string, userId: string): Promise<FlagValueChangeDto[]> {
    await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      flagId,
      userId,
    );
    const changes = await this.changeRepository.findLatestByFlagId(
      flagId,
      FLAG_HISTORY_LIMIT,
    );
    return changes.map((change) => ({
      id: change.id,
      environmentId: change.environmentId,
      oldEnabled: change.oldEnabled,
      newEnabled: change.newEnabled,
      actor: change.actor,
      source: change.source,
      at: change.at.toISOString(),
    }));
  }
}
