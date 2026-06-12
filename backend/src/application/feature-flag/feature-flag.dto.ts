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
  createdAt: string;
}

export interface FeatureFlagWithValuesDto extends FeatureFlagDto {
  values: FlagValueDto[];
}
