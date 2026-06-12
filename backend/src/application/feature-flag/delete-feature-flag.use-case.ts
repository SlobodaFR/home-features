import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';

/**
 * Deleting a FeatureFlag cascades to its flag values via SQLite FK
 * `ON DELETE CASCADE`.
 */
@Injectable()
export class DeleteFeatureFlagUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      id,
      userId,
    );
    await this.flagRepository.delete(id);
  }
}
