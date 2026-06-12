import { AppDto } from '../app/app.dto';
import { ConfigEntryWithValuesDto } from '../config-entry/config-entry.dto';
import { EnvironmentDto } from '../environment/environment.dto';
import { FeatureFlagWithValuesDto } from '../feature-flag/feature-flag.dto';

export interface AppOverviewDto {
  app: AppDto;
  environments: EnvironmentDto[];
  flags: FeatureFlagWithValuesDto[];
  configs: ConfigEntryWithValuesDto[];
}
