import { App } from '../domain/app';
import { ConfigEntryWithValues, ConfigValueType } from '../domain/config-entry';
import { Environment } from '../domain/environment';
import { FeatureFlagWithValues } from '../domain/feature-flag';
import { AppOverview } from '../domain/overview';
import { CurrentUser } from '../domain/user';

const BASE_URL = '/api';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function sendJson(path: string, method: string, body: unknown): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message ? String(errorBody.message) : `Request failed (${response.status})`);
  }
  return response;
}

export interface SaveAppPayload {
  name: string;
  slug: string;
  description?: string | null;
}

export interface SaveEnvironmentPayload {
  name: string;
  slug: string;
}

export interface SaveFeatureFlagPayload {
  key: string;
  name: string;
  description?: string | null;
}

export interface SaveConfigEntryPayload {
  key: string;
  name: string;
  description?: string | null;
  type: ConfigValueType;
}

export const apiClient = {
  async fetchCurrentUser(): Promise<CurrentUser | null> {
    const response = await fetch(`${BASE_URL}/me`, { credentials: 'include' });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { user: CurrentUser };
    return body.user;
  },
  async logout(): Promise<void> {
    await sendJson('/auth/logout', 'POST', undefined);
  },

  // Apps
  fetchApps(): Promise<App[]> {
    return getJson<App[]>('/apps');
  },
  fetchApp(appId: string): Promise<App> {
    return getJson<App>(`/apps/${appId}`);
  },
  fetchAppOverview(appId: string): Promise<AppOverview> {
    return getJson<AppOverview>(`/apps/${appId}/overview`);
  },
  async createApp(payload: SaveAppPayload): Promise<App> {
    const response = await sendJson('/apps', 'POST', payload);
    return response.json() as Promise<App>;
  },
  async updateApp(appId: string, payload: SaveAppPayload): Promise<App> {
    const response = await sendJson(`/apps/${appId}`, 'PATCH', payload);
    return response.json() as Promise<App>;
  },
  async deleteApp(appId: string): Promise<void> {
    await sendJson(`/apps/${appId}`, 'DELETE', undefined);
  },

  // Environments
  fetchEnvironments(appId: string): Promise<Environment[]> {
    return getJson<Environment[]>(`/apps/${appId}/environments`);
  },
  async createEnvironment(appId: string, payload: SaveEnvironmentPayload): Promise<Environment> {
    const response = await sendJson(`/apps/${appId}/environments`, 'POST', payload);
    return response.json() as Promise<Environment>;
  },
  async updateEnvironment(id: string, payload: SaveEnvironmentPayload): Promise<Environment> {
    const response = await sendJson(`/environments/${id}`, 'PATCH', payload);
    return response.json() as Promise<Environment>;
  },
  async deleteEnvironment(id: string): Promise<void> {
    await sendJson(`/environments/${id}`, 'DELETE', undefined);
  },
  async reorderEnvironments(appId: string, environmentIds: string[]): Promise<Environment[]> {
    const response = await sendJson(`/apps/${appId}/environments/reorder`, 'PUT', { environmentIds });
    return response.json() as Promise<Environment[]>;
  },

  // Feature flags
  fetchFeatureFlags(appId: string): Promise<FeatureFlagWithValues[]> {
    return getJson<FeatureFlagWithValues[]>(`/apps/${appId}/flags`);
  },
  async createFeatureFlag(appId: string, payload: SaveFeatureFlagPayload): Promise<FeatureFlagWithValues> {
    const response = await sendJson(`/apps/${appId}/flags`, 'POST', payload);
    return response.json() as Promise<FeatureFlagWithValues>;
  },
  async updateFeatureFlag(id: string, payload: SaveFeatureFlagPayload): Promise<FeatureFlagWithValues> {
    const response = await sendJson(`/flags/${id}`, 'PATCH', payload);
    return response.json() as Promise<FeatureFlagWithValues>;
  },
  async deleteFeatureFlag(id: string): Promise<void> {
    await sendJson(`/flags/${id}`, 'DELETE', undefined);
  },
  async setFlagValue(flagId: string, environmentId: string, enabled: boolean): Promise<void> {
    await sendJson(`/flags/${flagId}/values/${environmentId}`, 'PUT', { enabled });
  },

  // Config entries
  fetchConfigEntries(appId: string): Promise<ConfigEntryWithValues[]> {
    return getJson<ConfigEntryWithValues[]>(`/apps/${appId}/configs`);
  },
  async createConfigEntry(appId: string, payload: SaveConfigEntryPayload): Promise<ConfigEntryWithValues> {
    const response = await sendJson(`/apps/${appId}/configs`, 'POST', payload);
    return response.json() as Promise<ConfigEntryWithValues>;
  },
  async updateConfigEntry(id: string, payload: SaveConfigEntryPayload): Promise<ConfigEntryWithValues> {
    const response = await sendJson(`/configs/${id}`, 'PATCH', payload);
    return response.json() as Promise<ConfigEntryWithValues>;
  },
  async deleteConfigEntry(id: string): Promise<void> {
    await sendJson(`/configs/${id}`, 'DELETE', undefined);
  },
  async setConfigValue(configEntryId: string, environmentId: string, value: string): Promise<void> {
    await sendJson(`/configs/${configEntryId}/values/${environmentId}`, 'PUT', { value });
  },
};
