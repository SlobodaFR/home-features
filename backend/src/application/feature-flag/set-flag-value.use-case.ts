import { Injectable, NotFoundException } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { assertFeatureFlagOwnership } from './assert-feature-flag-ownership';
import { ChangeFlagValueService } from './change-flag-value.service';
import { FlagValueDto } from './feature-flag.dto';
import { toFlagValueDto } from './to-feature-flag-dto';

export interface FlagValueUser {
  id: string;
  name: string;
}

@Injectable()
export class SetFlagValueUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly changeFlagValue: ChangeFlagValueService,
  ) {}

  async execute(
    flagId: string,
    environmentId: string,
    enabled: boolean,
    user: FlagValueUser,
  ): Promise<FlagValueDto> {
    const flag = await assertFeatureFlagOwnership(
      this.flagRepository,
      this.appRepository,
      flagId,
      user.id,
    );

    const environment =
      await this.environmentRepository.findById(environmentId);
    if (!environment || environment.appId !== flag.appId) {
      throw new NotFoundException(`Environment ${environmentId} not found`);
    }

    const { value } = await this.changeFlagValue.execute(
      flag,
      environment,
      enabled,
      { name: user.name.trim() || user.id, identity: user.id, source: 'ui' },
    );

    return toFlagValueDto(value);
  }
}
