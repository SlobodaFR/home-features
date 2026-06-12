import { useCallback, useEffect, useState } from 'react';
import { ApiKey, ApiKeyWithSecret } from '../domain/api-key';
import { apiClient } from '../infrastructure/api-client';

export interface ApiKeysState {
  loading: boolean;
  error: string | null;
  apiKeys: ApiKey[];
  refresh: () => Promise<void>;
  createApiKey: (name: string) => Promise<ApiKeyWithSecret>;
  deleteApiKey: (id: string) => Promise<void>;
}

/**
 * Manages the list of public-API keys for an App: list, create (returns the
 * plaintext key once), and revoke.
 */
export function useApiKeys(appId: string): ApiKeysState {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.fetchApiKeys(appId);
      setApiKeys(result);
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

  const createApiKey = useCallback(
    async (name: string) => {
      const created = await apiClient.createApiKey(appId, { name });
      await refresh();
      return created;
    },
    [appId, refresh],
  );

  const deleteApiKey = useCallback(
    async (id: string) => {
      await apiClient.deleteApiKey(id);
      await refresh();
    },
    [refresh],
  );

  return { loading, error, apiKeys, refresh, createApiKey, deleteApiKey };
}
