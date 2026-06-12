import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FlagValue } from '../../domain/feature-flag/flag-value';
import {
  FeatureFlagDto,
  FeatureFlagWithValuesDto,
  FlagValueDto,
} from './feature-flag.dto';

export function toFeatureFlagDto(flag: FeatureFlag): FeatureFlagDto {
  return {
    id: flag.id,
    appId: flag.appId,
    key: flag.key,
    name: flag.name,
    description: flag.description,
    createdAt: flag.createdAt.toISOString(),
  };
}

export function toFlagValueDto(value: FlagValue): FlagValueDto {
  return {
    environmentId: value.environmentId,
    enabled: value.enabled,
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function toFeatureFlagWithValuesDto(
  flag: FeatureFlag,
  values: FlagValue[],
): FeatureFlagWithValuesDto {
  return {
    ...toFeatureFlagDto(flag),
    values: values.map(toFlagValueDto),
  };
}
