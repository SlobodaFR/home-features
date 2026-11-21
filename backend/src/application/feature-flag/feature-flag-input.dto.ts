export interface FeatureFlagInput {
  key: string;
  name: string;
  description: string | null;
  clientExposed?: boolean;
}

/** Every field optional; `key`, when sent, must be the current key (keys are immutable). */
export interface FeatureFlagUpdate {
  key?: string;
  name?: string;
  description?: string | null;
  clientExposed?: boolean;
}
