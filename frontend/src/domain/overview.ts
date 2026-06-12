import { App } from './app';
import { ConfigEntryWithValues } from './config-entry';
import { Environment } from './environment';
import { FeatureFlagWithValues } from './feature-flag';

export interface AppOverview {
  app: App;
  environments: Environment[];
  flags: FeatureFlagWithValues[];
  configs: ConfigEntryWithValues[];
}
