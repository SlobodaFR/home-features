export interface FlagValue {
  environmentId: string;
  enabled: boolean;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface FeatureFlagWithValues extends FeatureFlag {
  values: FlagValue[];
}
