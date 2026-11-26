export interface FlagValue {
  environmentId: string;
  enabled: boolean;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  appId: string;
  /** Immutable after creation. */
  key: string;
  name: string;
  description: string | null;
  /** Visible to `web` API keys (browser-facing). */
  clientExposed: boolean;
  /** Last read by a consumer, updated at most every ten minutes. */
  lastEvaluatedAt: string | null;
  createdAt: string;
}

export interface FeatureFlagWithValues extends FeatureFlag {
  values: FlagValue[];
}

export function enabledEnvironmentNames(
  flag: FeatureFlagWithValues,
  environments: { id: string; name: string }[],
): string[] {
  return environments
    .filter((environment) =>
      flag.values.some(
        (value) => value.environmentId === environment.id && value.enabled,
      ),
    )
    .map((environment) => environment.name);
}

export function lastEvaluatedLabel(lastEvaluatedAt: string | null): string {
  return lastEvaluatedAt
    ? `last evaluated ${new Date(lastEvaluatedAt).toLocaleString()}`
    : 'never evaluated';
}

/**
 * The confirmation text for deleting a flag that is on somewhere (the server refuses the deletion
 * without `{ confirm: key }`), or null when the flag is off everywhere.
 */
export function deletionWarning(
  flag: FeatureFlagWithValues,
  environments: { id: string; name: string }[],
): string | null {
  const enabledIn = enabledEnvironmentNames(flag, environments);
  if (enabledIn.length === 0) {
    return null;
  }
  return (
    `Flag "${flag.key}" is ON in ${enabledIn.join(', ')} (${lastEvaluatedLabel(flag.lastEvaluatedAt)}). ` +
    `Deleting it makes its consumers fall back to their code default: the feature turns off. ` +
    `Type the key "${flag.key}" to confirm.`
  );
}

export type FlagFilter = 'all' | 'client' | 'never-evaluated';

/** Search by name or key, then narrow by an attribute. */
export function filterFlags(
  flags: FeatureFlagWithValues[],
  query: string,
  filter: FlagFilter,
): FeatureFlagWithValues[] {
  const needle = query.trim().toLowerCase();
  return flags.filter((flag) => {
    if (
      needle !== '' &&
      !`${flag.name} ${flag.key}`.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (filter === 'client') return flag.clientExposed;
    if (filter === 'never-evaluated') return flag.lastEvaluatedAt === null;
    return true;
  });
}

/** Overview patch: the flag's value in one environment, as the server would store it. */
export function withFlagValue(
  flag: FeatureFlagWithValues,
  environmentId: string,
  enabled: boolean,
  now: string,
): FeatureFlagWithValues {
  const exists = flag.values.some((v) => v.environmentId === environmentId);
  const values = exists
    ? flag.values.map((v) =>
        v.environmentId === environmentId
          ? { ...v, enabled, updatedAt: now }
          : v,
      )
    : [...flag.values, { environmentId, enabled, updatedAt: now }];
  return { ...flag, values };
}
