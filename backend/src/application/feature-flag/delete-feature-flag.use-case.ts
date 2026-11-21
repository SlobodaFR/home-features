import { ConflictException, Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';

/**
 * Deleting a FeatureFlag cascades to its flag values via SQLite FK
 * `ON DELETE CASCADE`. A flag that is on in at least one environment is only
 * deleted when the request confirms it by naming its key: its consumers fall
 * back to their code default, i.e. the feature turns off.
 */
@Injectable()
export class DeleteFeatureFlagUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly flagValueRepository: FlagValueRepository,
  ) {}

  async execute(
    id: string,
    confirm: string | undefined,
    userId: string,
  ): Promise<void> {
    const flag = await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      id,
      userId,
    );
    const values = await this.flagValueRepository.findAllByFlagId(id);
    if (
      flag.deletionNeedsConfirmation(values) &&
      !flag.isDeletionConfirmedBy(confirm)
    ) {
      throw new ConflictException(
        `Flag "${flag.key}" is on in at least one environment: deleting it makes its consumers fall back to their code default (the feature turns off). Confirm with {"confirm": "${flag.key}"}.`,
      );
    }
    await this.flagRepository.delete(id);
  }
}
