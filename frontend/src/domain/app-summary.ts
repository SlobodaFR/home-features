import { AppOverview } from './overview';

export interface AppSummary {
  environmentCount: number;
  flagCount: number;
  configCount: number;
  /** Most recent value change across flags and configs, or null when nothing was ever set. */
  lastChangeAt: string | null;
}

export function summarizeOverview(overview: AppOverview): AppSummary {
  const timestamps = [
    ...overview.flags.flatMap((flag) =>
      flag.values.map((value) => value.updatedAt),
    ),
    ...overview.configs.flatMap((config) =>
      config.values.map((value) => value.updatedAt),
    ),
  ];
  const lastChangeAt = timestamps.reduce<string | null>(
    (latest, current) =>
      latest === null || new Date(current) > new Date(latest)
        ? current
        : latest,
    null,
  );
  return {
    environmentCount: overview.environments.length,
    flagCount: overview.flags.length,
    configCount: overview.configs.length,
    lastChangeAt,
  };
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
