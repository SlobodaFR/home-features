import { useCallback, useEffect, useState } from 'react';
import { App } from '../domain/app';
import { apiClient } from '../infrastructure/api-client';

export interface AppsState {
  loading: boolean;
  error: string | null;
  apps: App[];
  refresh: () => Promise<void>;
}

/**
 * Loads the apps owned by the current user.
 */
export function useApps(): AppsState {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.fetchApps();
      setApps(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, apps, refresh };
}
