import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { ConfigValueRepository } from '../../domain/config-entry/config-value.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { toAppDto } from '../app/to-app-dto';
import { toConfigEntryWithValuesDto } from '../config-entry/to-config-entry-dto';
import { toEnvironmentDto } from '../environment/to-environment-dto';
import { toFeatureFlagWithValuesDto } from '../feature-flag/to-feature-flag-dto';
import { AppOverviewDto } from './app-overview.dto';

/**
 * Returns everything needed to render the "Flags & Configs" dashboard for
 * an app in one shape: environments (ordered), feature flags with their
 * per-environment values, and config entries with their per-environment
 * values.
 */
@Injectable()
export class GetAppOverviewUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly flagValueRepository: FlagValueRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
    private readonly configValueRepository: ConfigValueRepository,
  ) {}

  async execute(appId: string, userId: string): Promise<AppOverviewDto> {
    const app = await assertAppOwnership(this.appRepository, appId, userId);

    const [environments, flags, flagValues, configEntries, configValues] =
      await Promise.all([
        this.environmentRepository.findAllByAppId(appId),
        this.flagRepository.findAllByAppId(appId),
        this.flagValueRepository.findAllByAppId(appId),
        this.configEntryRepository.findAllByAppId(appId),
        this.configValueRepository.findAllByAppId(appId),
      ]);

    return {
      app: toAppDto(app),
      environments: environments.map(toEnvironmentDto),
      flags: flags.map((flag) =>
        toFeatureFlagWithValuesDto(
          flag,
          flagValues.filter((value) => value.flagId === flag.id),
        ),
      ),
      configs: configEntries.map((configEntry) =>
        toConfigEntryWithValuesDto(
          configEntry,
          configValues.filter(
            (value) => value.configEntryId === configEntry.id,
          ),
        ),
      ),
    };
  }
}
