import { NotFoundException } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';

/**
 * Loads the FeatureFlag by id and verifies its parent App belongs to
 * `userId`. Throws NotFoundException (404) otherwise.
 */
export async function assertFeatureFlagOwnership(
  flagRepository: FeatureFlagRepository,
  appRepository: AppRepository,
  flagId: string,
  userId: string,
): Promise<FeatureFlag> {
  const flag = await flagRepository.findById(flagId);
  if (!flag) {
    throw new NotFoundException(`Feature flag ${flagId} not found`);
  }

  const app = await appRepository.findById(flag.appId);
  if (!app || app.userId !== userId) {
    throw new NotFoundException(`Feature flag ${flagId} not found`);
  }

  return flag;
}
