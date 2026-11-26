import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApiKeys } from '../../application/use-api-keys';
import {
  API_KEY_SCOPES,
  ApiKeyScope,
  ApiKeyWithSecret,
  apiKeyScopeHint,
  environmentNameOf,
} from '../../domain/api-key';
import { ConfigValueType } from '../../domain/config-entry';
import { slugify } from '../../domain/slugify';
import { apiClient } from '../../infrastructure/api-client';
import { useAppContext } from '../layout/AppLayout';
import {
  actionDanger,
  buttonPrimary,
  cardClass,
  cellInputClass,
  inputClass,
  labelClass,
  pillClass,
  tdClass,
  thClass,
} from '../ui';

export type LegacySection = 'environments' | 'configs' | 'apiKeys';

/** Interim tab content, replaced by dedicated tabs in the next PR of the stack. */
export function LegacyAppSections({ show }: { show: LegacySection }) {
  const { appId } = useParams<{ appId: string }>();
  const { loading, error, overview, refresh } = useAppContext();
  const apiKeys = useApiKeys(appId ?? '');

  const [envName, setEnvName] = useState('');
  const [envSlug, setEnvSlug] = useState('');

  const [configKey, setConfigKey] = useState('');
  const [configName, setConfigName] = useState('');
  const [configType, setConfigType] = useState<ConfigValueType>(
    ConfigValueType.STRING,
  );

  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyEnvironmentId, setApiKeyEnvironmentId] = useState('');
  const [apiKeyScope, setApiKeyScope] = useState<ApiKeyScope>('server');
  const [createdApiKey, setCreatedApiKey] = useState<ApiKeyWithSecret | null>(
    null,
  );

  if (!appId) {
    return <p className="text-error">Missing app id.</p>;
  }

  if (loading && !overview) {
    return (
      <p className="text-center text-mute" role="status">
        Loading...
      </p>
    );
  }

  if (error || !overview) {
    return <p className="text-center text-error">Error: {error}</p>;
  }

  const { environments, configs } = overview;

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
    try {
      await apiClient.deleteEnvironment(id);
    } catch (err) {
      // 409 while API keys are bound to it.
      window.alert(
        err instanceof Error ? err.message : 'Failed to delete environment',
      );
      return;
    }
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

  async function handleSetConfigValue(
    configEntryId: string,
    environmentId: string,
    value: string,
  ) {
    try {
      await apiClient.setConfigValue(configEntryId, environmentId, value);
      await refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to set value');
    }
  }

  async function handleCreateApiKey(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await apiKeys.createApiKey({
        name: apiKeyName,
        environmentId: apiKeyEnvironmentId || environments[0]?.id || '',
        scope: apiKeyScope,
      });
      setCreatedApiKey(created);
      setApiKeyName('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create key');
    }
  }

  async function handleDeleteApiKey(id: string, name: string) {
    if (
      !window.confirm(
        `Revoke API key "${name}"? Apps using it will lose access.`,
      )
    )
      return;
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
    <>
      {show === 'environments' && (
        <section className={cardClass} aria-labelledby="environments-heading">
          <SectionTitle id="environments-heading" count={environments.length}>
            Environments
          </SectionTitle>
          <ul className="mb-md flex flex-wrap gap-sm">
            {environments.map((env) => (
              <li
                key={env.id}
                className="flex items-center gap-xs rounded-full border border-hairline py-0 pl-md pr-0 font-body-sm text-body-sm text-ink"
              >
                {env.name}
                <button
                  type="button"
                  onClick={() => void handleDeleteEnvironment(env.id, env.name)}
                  aria-label={`Delete environment ${env.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-error hover:bg-soft-cloud"
                >
                  <span aria-hidden="true">x</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => void handleCreateEnvironment(e)}
            className={formClass}
          >
            <input
              className={`${inputClass} ${fieldGrow}`}
              aria-label="Environment name"
              placeholder="Environment name (e.g. production)"
              value={envName}
              onChange={(e) => setEnvName(e.target.value)}
              required
            />
            <input
              className={`${inputClass} ${fieldGrow}`}
              aria-label="Environment slug"
              placeholder={`Slug (default: ${slugify(envName) || 'auto'})`}
              value={envSlug}
              onChange={(e) => setEnvSlug(e.target.value)}
            />
            <button type="submit" className={buttonPrimary}>
              Add
            </button>
          </form>
        </section>
      )}

      {show === 'configs' && (
        <section className={cardClass} aria-labelledby="configs-heading">
          <SectionTitle id="configs-heading" count={configs.length}>
            Configs
          </SectionTitle>
          {environments.length === 0 ? (
            <p className="mb-md text-mute">Add an environment first.</p>
          ) : (
            <div
              className="mb-md overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Scrollable table"
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Config</th>
                    {environments.map((env) => (
                      <th key={env.id} className={thClass}>
                        {env.name}
                      </th>
                    ))}
                    <th className={thClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  {configs.map((config) => (
                    <tr key={config.id}>
                      <td className={tdClass}>
                        <div className="font-body-md text-body-md font-semibold text-ink">
                          {config.name}
                        </div>
                        <div className="font-body-sm text-body-sm text-mute">
                          <code className="font-mono text-[13px]">
                            {config.key}
                          </code>{' '}
                          ({config.type})
                        </div>
                      </td>
                      {environments.map((env) => {
                        const value = config.values.find(
                          (v) => v.environmentId === env.id,
                        );
                        return (
                          <td key={env.id} className={tdClass}>
                            <ConfigValueEditor
                              label={`${config.name} in ${env.name}`}
                              value={value?.value ?? ''}
                              onSave={(newValue) =>
                                void handleSetConfigValue(
                                  config.id,
                                  env.id,
                                  newValue,
                                )
                              }
                            />
                          </td>
                        );
                      })}
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteConfig(config.id, config.name)
                          }
                          aria-label={`Delete config ${config.name}`}
                          className={actionDanger}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form
            onSubmit={(e) => void handleCreateConfig(e)}
            className={formClass}
          >
            <input
              className={`${inputClass} ${fieldGrow}`}
              aria-label="Config name"
              placeholder="Config name"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              required
            />
            <input
              className={`${inputClass} ${fieldGrow}`}
              aria-label="Config key"
              placeholder={`Key (default: ${slugify(configName) || 'auto'})`}
              value={configKey}
              onChange={(e) => setConfigKey(e.target.value)}
            />
            <select
              aria-label="Config type"
              className={`${inputClass} sm:w-auto`}
              value={configType}
              onChange={(e) => {
                const selected = Object.values(ConfigValueType).find(
                  (type) => (type as string) === e.target.value,
                );
                if (selected) {
                  setConfigType(selected);
                }
              }}
            >
              {Object.values(ConfigValueType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonPrimary}>
              Add config
            </button>
          </form>
        </section>
      )}

      {show === 'apiKeys' && (
        <section className={cardClass} aria-labelledby="api-keys-heading">
          <SectionTitle id="api-keys-heading" count={apiKeys.apiKeys.length}>
            API keys
          </SectionTitle>
          <p className="mb-md max-w-prose font-body-sm text-body-sm text-mute">
            An API key reads one environment of this app, sent as an{' '}
            <code className="font-mono text-[13px] text-ink">
              Authorization: Bearer hf_…
            </code>{' '}
            header. A <em>server</em> key sees every flag and config; a{' '}
            <em>web</em> key (behind a browser proxy) sees only the
            client-exposed flags.
          </p>

          {createdApiKey && (
            <div
              role="status"
              className="mb-md rounded border-2 border-ink bg-canvas p-md"
            >
              <p className="mb-sm font-body-sm text-body-sm text-ink">
                New key <strong>{createdApiKey.name}</strong> created. Copy it
                now - it won't be shown again.
              </p>
              <div className="flex flex-wrap items-center gap-sm">
                <code className="min-w-0 flex-1 basis-64 break-all rounded border border-hairline bg-soft-cloud px-md py-sm font-mono text-[13px] text-ink">
                  {createdApiKey.key}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyApiKey(createdApiKey.key)}
                  className={buttonPrimary}
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {apiKeys.error && (
            <p className="mb-md text-error">Error: {apiKeys.error}</p>
          )}

          {apiKeys.apiKeys.length === 0 ? (
            <p className="mb-md text-mute">No API keys yet.</p>
          ) : (
            <div
              className="mb-md overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Scrollable table"
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Environment</th>
                    <th className={thClass}>Scope</th>
                    <th className={thClass}>Created</th>
                    <th className={thClass}>Last used</th>
                    <th className={thClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-soft">
                  {apiKeys.apiKeys.map((apiKey) => (
                    <tr key={apiKey.id}>
                      <td
                        className={`${tdClass} font-body-md text-body-md font-semibold text-ink`}
                      >
                        {apiKey.name}
                      </td>
                      <td
                        className={`${tdClass} font-body-sm text-body-sm text-ink`}
                      >
                        {environmentNameOf(apiKey.environmentId, environments)}
                      </td>
                      <td
                        className={tdClass}
                        title={apiKeyScopeHint(apiKey.scope)}
                      >
                        <span
                          className={`${pillClass} ${
                            apiKey.scope === 'web'
                              ? 'border-warning text-warning'
                              : 'border-hairline text-ink'
                          }`}
                        >
                          {apiKey.scope}
                        </span>
                      </td>
                      <td
                        className={`${tdClass} tabular whitespace-nowrap font-body-sm text-body-sm text-mute`}
                      >
                        {new Date(apiKey.createdAt).toLocaleString()}
                      </td>
                      <td
                        className={`${tdClass} tabular whitespace-nowrap font-body-sm text-body-sm text-mute`}
                      >
                        {apiKey.lastUsedAt
                          ? new Date(apiKey.lastUsedAt).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteApiKey(apiKey.id, apiKey.name)
                          }
                          aria-label={`Revoke API key ${apiKey.name}`}
                          className={actionDanger}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form
            onSubmit={(e) => void handleCreateApiKey(e)}
            className={formClass}
          >
            <input
              className={`${inputClass} ${fieldGrow}`}
              aria-label="Key name"
              placeholder="Key name (e.g. production server)"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              required
            />
            <select
              aria-label="Environment"
              className={`${inputClass} sm:w-auto`}
              value={apiKeyEnvironmentId || environments[0]?.id || ''}
              onChange={(e) => setApiKeyEnvironmentId(e.target.value)}
              required
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Scope"
              className={`${inputClass} sm:w-auto`}
              value={apiKeyScope}
              title={apiKeyScopeHint(apiKeyScope)}
              onChange={(e) => {
                const selected = API_KEY_SCOPES.find(
                  (scope) => scope === e.target.value,
                );
                if (selected) {
                  setApiKeyScope(selected);
                }
              }}
            >
              {API_KEY_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={environments.length === 0}
              className={buttonPrimary}
            >
              Generate key
            </button>
          </form>
        </section>
      )}
    </>
  );
}

const formClass =
  'flex flex-col gap-sm sm:flex-row sm:flex-wrap sm:items-start';
const fieldGrow = 'sm:w-auto sm:flex-1 sm:basis-48';

function SectionTitle({
  id,
  count,
  children,
}: {
  id: string;
  count: number;
  children: string;
}) {
  return (
    <div className="mb-md flex items-baseline justify-between gap-md">
      <h2 id={id} className="font-heading-md text-heading-md text-ink">
        {children}
      </h2>
      <span className={`${labelClass} tabular`}>{count}</span>
    </div>
  );
}

function ConfigValueEditor({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <input
      className={cellInputClass}
      aria-label={label}
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
