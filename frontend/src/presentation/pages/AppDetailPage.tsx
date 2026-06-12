import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApiKeys } from '../../application/use-api-keys';
import { useAppOverview } from '../../application/use-app-overview';
import { ApiKeyWithSecret } from '../../domain/api-key';
import { ConfigValueType } from '../../domain/config-entry';
import { slugify } from '../../domain/slugify';
import { apiClient } from '../../infrastructure/api-client';

export function AppDetailPage() {
  const { appId } = useParams<{ appId: string }>();
  const { loading, error, overview, refresh } = useAppOverview(appId ?? '');
  const apiKeys = useApiKeys(appId ?? '');

  const [envName, setEnvName] = useState('');
  const [envSlug, setEnvSlug] = useState('');

  const [flagKey, setFlagKey] = useState('');
  const [flagName, setFlagName] = useState('');

  const [configKey, setConfigKey] = useState('');
  const [configName, setConfigName] = useState('');
  const [configType, setConfigType] = useState<ConfigValueType>(ConfigValueType.STRING);

  const [apiKeyName, setApiKeyName] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<ApiKeyWithSecret | null>(null);

  if (!appId) {
    return <p className="text-error px-margin-mobile py-section">Missing app id.</p>;
  }

  if (loading && !overview) {
    return <div className="px-margin-mobile py-section text-center text-mute">Loading...</div>;
  }

  if (error || !overview) {
    return <div className="px-margin-mobile py-section text-center text-error">Error: {error}</div>;
  }

  const { app, environments, flags, configs } = overview;

  async function handleCreateEnvironment(event: FormEvent) {
    event.preventDefault();
    await apiClient.createEnvironment(appId!, {
      name: envName,
      slug: envSlug.trim() === '' ? slugify(envName) : envSlug,
    });
    setEnvName('');
    setEnvSlug('');
    await refresh();
  }

  async function handleDeleteEnvironment(id: string, name: string) {
    if (!window.confirm(`Delete environment "${name}"?`)) return;
    await apiClient.deleteEnvironment(id);
    await refresh();
  }

  async function handleCreateFlag(event: FormEvent) {
    event.preventDefault();
    await apiClient.createFeatureFlag(appId!, {
      key: flagKey.trim() === '' ? slugify(flagName) : flagKey,
      name: flagName,
    });
    setFlagKey('');
    setFlagName('');
    await refresh();
  }

  async function handleDeleteFlag(id: string, name: string) {
    if (!window.confirm(`Delete flag "${name}"?`)) return;
    await apiClient.deleteFeatureFlag(id);
    await refresh();
  }

  async function handleToggleFlag(flagId: string, environmentId: string, enabled: boolean) {
    await apiClient.setFlagValue(flagId, environmentId, enabled);
    await refresh();
  }

  async function handleCreateConfig(event: FormEvent) {
    event.preventDefault();
    await apiClient.createConfigEntry(appId!, {
      key: configKey.trim() === '' ? slugify(configName) : configKey,
      name: configName,
      type: configType,
    });
    setConfigKey('');
    setConfigName('');
    setConfigType(ConfigValueType.STRING);
    await refresh();
  }

  async function handleDeleteConfig(id: string, name: string) {
    if (!window.confirm(`Delete config "${name}"?`)) return;
    await apiClient.deleteConfigEntry(id);
    await refresh();
  }

  async function handleSetConfigValue(configEntryId: string, environmentId: string, value: string) {
    try {
      await apiClient.setConfigValue(configEntryId, environmentId, value);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to set value');
    }
  }

  async function handleCreateApiKey(event: FormEvent) {
    event.preventDefault();
    const created = await apiKeys.createApiKey(apiKeyName);
    setCreatedApiKey(created);
    setApiKeyName('');
  }

  async function handleDeleteApiKey(id: string, name: string) {
    if (!window.confirm(`Revoke API key "${name}"? Apps using it will lose access.`)) return;
    await apiKeys.deleteApiKey(id);
    if (createdApiKey?.id === id) {
      setCreatedApiKey(null);
    }
  }

  async function handleCopyApiKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      // Clipboard API unavailable - the user can still select and copy manually.
    }
  }

  return (
    <main className="min-h-screen px-margin-mobile py-section max-w-5xl mx-auto">
      <Link to="/" className="font-label-caps text-label-caps text-mute border-b border-mute uppercase">
        Back to apps
      </Link>
      <h1 className="font-heading-xl text-heading-xl text-ink mt-md mb-xl">{app.name}</h1>

      <section className="mb-xl">
        <h2 className="font-heading-md text-heading-md text-ink mb-md">Environments</h2>
        <div className="flex flex-wrap gap-sm mb-md">
          {environments.map((env) => (
            <span key={env.id} className="border border-hairline rounded px-md py-sm flex items-center gap-sm">
              {env.name}
              <button
                type="button"
                onClick={() => void handleDeleteEnvironment(env.id, env.name)}
                className="text-error text-label-caps font-label-caps uppercase"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={(e) => void handleCreateEnvironment(e)} className="flex gap-sm">
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder="Environment name (e.g. production)"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            required
          />
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder={`Slug (default: ${slugify(envName) || 'auto'})`}
            value={envSlug}
            onChange={(e) => setEnvSlug(e.target.value)}
          />
          <button type="submit" className="bg-ink text-surface px-xl py-md rounded-full font-button-md">
            Add
          </button>
        </form>
      </section>

      <section className="mb-xl">
        <h2 className="font-heading-md text-heading-md text-ink mb-md">Feature flags</h2>
        {environments.length === 0 ? (
          <p className="text-mute mb-md">Add an environment first.</p>
        ) : (
          <table className="w-full border-collapse mb-md">
            <thead>
              <tr>
                <th className="text-left font-label-caps text-label-caps text-mute uppercase py-sm">Flag</th>
                {environments.map((env) => (
                  <th key={env.id} className="text-left font-label-caps text-label-caps text-mute uppercase py-sm px-md">
                    {env.name}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-t border-hairline">
                  <td className="py-sm">
                    <div className="font-body-md text-body-md text-ink">{flag.name}</div>
                    <div className="font-body-sm text-body-sm text-mute">{flag.key}</div>
                  </td>
                  {environments.map((env) => {
                    const value = flag.values.find((v) => v.environmentId === env.id);
                    return (
                      <td key={env.id} className="py-sm px-md">
                        <input
                          type="checkbox"
                          checked={value?.enabled ?? false}
                          onChange={(e) => void handleToggleFlag(flag.id, env.id, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                  <td className="py-sm">
                    <button
                      type="button"
                      onClick={() => void handleDeleteFlag(flag.id, flag.name)}
                      className="font-label-caps text-label-caps text-error border-b border-error uppercase"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={(e) => void handleCreateFlag(e)} className="flex gap-sm">
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder="Flag name"
            value={flagName}
            onChange={(e) => setFlagName(e.target.value)}
            required
          />
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder={`Key (default: ${slugify(flagName) || 'auto'})`}
            value={flagKey}
            onChange={(e) => setFlagKey(e.target.value)}
          />
          <button type="submit" className="bg-ink text-surface px-xl py-md rounded-full font-button-md">
            Add flag
          </button>
        </form>
      </section>

      <section className="mb-xl">
        <h2 className="font-heading-md text-heading-md text-ink mb-md">Configs</h2>
        {environments.length === 0 ? (
          <p className="text-mute mb-md">Add an environment first.</p>
        ) : (
          <table className="w-full border-collapse mb-md">
            <thead>
              <tr>
                <th className="text-left font-label-caps text-label-caps text-mute uppercase py-sm">Config</th>
                {environments.map((env) => (
                  <th key={env.id} className="text-left font-label-caps text-label-caps text-mute uppercase py-sm px-md">
                    {env.name}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.id} className="border-t border-hairline">
                  <td className="py-sm">
                    <div className="font-body-md text-body-md text-ink">{config.name}</div>
                    <div className="font-body-sm text-body-sm text-mute">
                      {config.key} ({config.type})
                    </div>
                  </td>
                  {environments.map((env) => {
                    const value = config.values.find((v) => v.environmentId === env.id);
                    return (
                      <td key={env.id} className="py-sm px-md">
                        <ConfigValueEditor
                          value={value?.value ?? ''}
                          onSave={(newValue) => void handleSetConfigValue(config.id, env.id, newValue)}
                        />
                      </td>
                    );
                  })}
                  <td className="py-sm">
                    <button
                      type="button"
                      onClick={() => void handleDeleteConfig(config.id, config.name)}
                      className="font-label-caps text-label-caps text-error border-b border-error uppercase"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={(e) => void handleCreateConfig(e)} className="flex gap-sm">
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder="Config name"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            required
          />
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder={`Key (default: ${slugify(configName) || 'auto'})`}
            value={configKey}
            onChange={(e) => setConfigKey(e.target.value)}
          />
          <select
            className="border border-hairline rounded px-md py-sm"
            value={configType}
            onChange={(e) => setConfigType(e.target.value as ConfigValueType)}
          >
            {Object.values(ConfigValueType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-ink text-surface px-xl py-md rounded-full font-button-md">
            Add config
          </button>
        </form>
      </section>

      <section className="mb-xl">
        <h2 className="font-heading-md text-heading-md text-ink mb-md">API keys</h2>
        <p className="font-body-sm text-body-sm text-mute mb-md">
          Use an API key to fetch this app's flags and configs from other services via{' '}
          <code>GET /api/v1/flags-and-configs?environment=&lt;slug&gt;</code> with an{' '}
          <code>Authorization: Bearer &lt;key&gt;</code> header.
        </p>

        {createdApiKey && (
          <div className="border border-hairline rounded px-md py-md mb-md bg-surface">
            <p className="font-body-sm text-body-sm text-ink mb-sm">
              New key <strong>{createdApiKey.name}</strong> created. Copy it now - it won't be shown again.
            </p>
            <div className="flex gap-sm items-center">
              <code className="font-body-sm text-body-sm break-all border border-hairline rounded px-sm py-xs flex-1">
                {createdApiKey.key}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyApiKey(createdApiKey.key)}
                className="bg-ink text-surface px-md py-sm rounded-full font-button-md"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {apiKeys.error && <p className="text-error mb-md">Error: {apiKeys.error}</p>}

        {apiKeys.apiKeys.length === 0 ? (
          <p className="text-mute mb-md">No API keys yet.</p>
        ) : (
          <table className="w-full border-collapse mb-md">
            <thead>
              <tr>
                <th className="text-left font-label-caps text-label-caps text-mute uppercase py-sm">Name</th>
                <th className="text-left font-label-caps text-label-caps text-mute uppercase py-sm px-md">Created</th>
                <th className="text-left font-label-caps text-label-caps text-mute uppercase py-sm px-md">Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.apiKeys.map((apiKey) => (
                <tr key={apiKey.id} className="border-t border-hairline">
                  <td className="py-sm font-body-md text-body-md text-ink">{apiKey.name}</td>
                  <td className="py-sm px-md font-body-sm text-body-sm text-mute">
                    {new Date(apiKey.createdAt).toLocaleString()}
                  </td>
                  <td className="py-sm px-md font-body-sm text-body-sm text-mute">
                    {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-sm">
                    <button
                      type="button"
                      onClick={() => void handleDeleteApiKey(apiKey.id, apiKey.name)}
                      className="font-label-caps text-label-caps text-error border-b border-error uppercase"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={(e) => void handleCreateApiKey(e)} className="flex gap-sm">
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder="Key name (e.g. production server)"
            value={apiKeyName}
            onChange={(e) => setApiKeyName(e.target.value)}
            required
          />
          <button type="submit" className="bg-ink text-surface px-xl py-md rounded-full font-button-md">
            Generate key
          </button>
        </form>
      </section>
    </main>
  );
}

function ConfigValueEditor({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  return (
    <input
      className="border border-hairline rounded px-sm py-xs w-32"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) {
          onSave(draft);
        }
      }}
    />
  );
}
