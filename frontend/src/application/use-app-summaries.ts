import { useEffect, useState } from 'react';
import { App } from '../domain/app';
import { AppSummary, summarizeOverview } from '../domain/app-summary';
import { apiClient } from '../infrastructure/api-client';

/**
 * Per-app counts and last change, derived from the existing overview endpoint (one request per
 * app, in parallel). An app whose overview fails simply has no summary.
 */
export function useAppSummaries(apps: App[]): Record<string, AppSummary> {
  const [summaries, setSummaries] = useState<Record<string, AppSummary>>({});

  useEffect(() => {
    let cancelled = false;
    for (const app of apps) {
      apiClient
        .fetchAppOverview(app.id)
        .then((overview) => {
          if (!cancelled) {
            setSummaries((current) => ({
              ...current,
              [app.id]: summarizeOverview(overview),
            }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [apps]);

  return summaries;
}
