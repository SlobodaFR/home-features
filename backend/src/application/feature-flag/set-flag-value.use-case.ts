import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValue } from '../../domain/feature-flag/flag-value';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';
import { FlagValueDto } from './feature-flag.dto';
import { toFlagValueDto } from './to-feature-flag-dto';

@Injectable()
export class SetFlagValueUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly flagValueRepository: FlagValueRepository,
  ) {}

  async execute(
    flagId: string,
    environmentId: string,
    enabled: boolean,
    userId: string,
  ): Promise<FlagValueDto> {
    const flag = await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      flagId,
      userId,
    );

    const environment =
      await this.environmentRepository.findById(environmentId);
    if (!environment || environment.appId !== flag.appId) {
      throw new NotFoundException(`Environment ${environmentId} not found`);
    }

    let flagValue: FlagValue;
    try {
      flagValue = FlagValue.create({
        id: randomUUID(),
        flagId,
        environmentId,
        enabled,
        updatedAt: new Date(),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid flag value',
      );
    }

    const saved = await this.flagValueRepository.upsert(flagValue);

    return toFlagValueDto(saved);
  }
}
