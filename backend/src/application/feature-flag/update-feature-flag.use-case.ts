import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';
import { FeatureFlagDto } from './feature-flag.dto';
import { FeatureFlagInput } from './feature-flag-input.dto';
import { toFeatureFlagDto } from './to-feature-flag-dto';

@Injectable()
export class UpdateFeatureFlagUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
  ) {}

  async execute(
    id: string,
    input: FeatureFlagInput,
    userId: string,
  ): Promise<FeatureFlagDto> {
    const existing = await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      id,
      userId,
    );

    const conflict = await this.flagRepository.findByKey(
      existing.appId,
      input.key,
    );
    if (conflict && conflict.id !== id) {
      throw new ConflictException(
        'A feature flag with this key already exists for this app',
      );
    }

    let flag: FeatureFlag;
    try {
      flag = FeatureFlag.create({
        id: existing.id,
        appId: existing.appId,
        key: input.key,
        name: input.name,
        description: input.description,
        createdAt: existing.createdAt,
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
