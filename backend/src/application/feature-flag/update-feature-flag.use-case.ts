import { BadRequestException, Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';
import { FeatureFlagDto } from './feature-flag.dto';
import { FeatureFlagUpdate } from './feature-flag-input.dto';
import { toFeatureFlagDto } from './to-feature-flag-dto';

@Injectable()
export class UpdateFeatureFlagUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
  ) {}

  async execute(
    id: string,
    input: FeatureFlagUpdate,
    userId: string,
  ): Promise<FeatureFlagDto> {
    const existing = await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      id,
      userId,
    );

    // Consumers reference the key in code: a rename would silently send them to their defaults.
    if (input.key !== undefined && input.key !== existing.key) {
      throw new BadRequestException(
        'A feature flag key cannot be changed: create a new flag instead',
      );
    }

    let flag: FeatureFlag;
    try {
      flag = existing.withDetails({
        name: input.name,
        description: input.description,
        clientExposed: input.clientExposed,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid feature flag',
      );
    }

    await this.flagRepository.save(flag);

    return toFeatureFlagDto(flag);
  }
}
