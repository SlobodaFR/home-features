import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { FeatureFlagWithValuesDto } from './feature-flag.dto';
import { toFeatureFlagWithValuesDto } from './to-feature-flag-dto';

@Injectable()
export class ListFeatureFlagsUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly flagValueRepository: FlagValueRepository,
  ) {}

  async execute(
    appId: string,
    userId: string,
  ): Promise<FeatureFlagWithValuesDto[]> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const flags = await this.flagRepository.findAllByAppId(appId);
    const values = await this.flagValueRepository.findAllByAppId(appId);

    return flags.map((flag) =>
      toFeatureFlagWithValuesDto(
        flag,
        values.filter((value) => value.flagId === flag.id),
      ),
    );
  }
}
