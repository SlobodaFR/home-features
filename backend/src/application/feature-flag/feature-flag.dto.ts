import { FlagValueChangeSource } from '../../domain/feature-flag/flag-value-change';

export interface FlagValueDto {
  environmentId: string;
  enabled: boolean;
  updatedAt: string;
}

export interface FeatureFlagDto {
  id: string;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  clientExposed: boolean;
  lastEvaluatedAt: string | null;
  createdAt: string;
}

export interface FeatureFlagWithValuesDto extends FeatureFlagDto {
  values: FlagValueDto[];
}

export interface FlagValueChangeDto {
  id: string;
  environmentId: string;
  oldEnabled: boolean | null;
  newEnabled: boolean;
  actor: string;
  source: FlagValueChangeSource;
  at: string;
}
