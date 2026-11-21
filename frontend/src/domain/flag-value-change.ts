/** One entry of a flag's append-only value history. */
export interface FlagValueChange {
  id: string;
  environmentId: string;
  oldEnabled: boolean | null;
  newEnabled: boolean;
  actor: string;
  source: 'ui' | 'cli';
  at: string;
}

function state(enabled: boolean | null): string {
  if (enabled === null) {
    return 'unset';
  }
  return enabled ? 'on' : 'off';
}

export function describeChange(
  change: FlagValueChange,
  environments: { id: string; name: string }[],
): string {
  const environment =
    environments.find((env) => env.id === change.environmentId)?.name ??
    'Deleted environment';
  return `${environment}: ${state(change.oldEnabled)} → ${state(change.newEnabled)}, by ${change.actor} (${change.source})`;
}
