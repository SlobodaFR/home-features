import { useCallback, useEffect, useState } from 'react';
import { AppOverview } from '../domain/overview';
import { apiClient } from '../infrastructure/api-client';

export interface AppOverviewState {
  loading: boolean;
  error: string | null;
  overview: AppOverview | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the combined "Flags & Configs" dashboard data for an app:
 * environments, feature flags with per-environment values, and config
 * entries with per-environment values.
 */
export function useAppOverview(appId: string): AppOverviewState {
  const [overview, setOverview] = useState<AppOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.fetchAppOverview(appId);
      setOverview(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, overview, refresh };
}
