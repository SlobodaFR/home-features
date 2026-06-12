import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { FeatureFlagDto } from './feature-flag.dto';
import { FeatureFlagInput } from './feature-flag-input.dto';
import { toFeatureFlagDto } from './to-feature-flag-dto';

@Injectable()
export class CreateFeatureFlagUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
  ) {}

  async execute(
    appId: string,
    input: FeatureFlagInput,
    userId: string,
  ): Promise<FeatureFlagDto> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const existing = await this.flagRepository.findByKey(appId, input.key);
    if (existing) {
      throw new ConflictException(
        'A feature flag with this key already exists for this app',
      );
    }

    let flag: FeatureFlag;
    try {
      flag = FeatureFlag.create({
        id: randomUUID(),
        appId,
        key: input.key,
        name: input.name,
        description: input.description,
        createdAt: new Date(),
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
