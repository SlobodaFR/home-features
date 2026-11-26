import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiKeys } from '../../application/use-api-keys';
import {
  API_KEY_SCOPES,
  ApiKey,
  ApiKeyScope,
  ApiKeyWithSecret,
  apiKeyScopeHint,
  environmentNameOf,
} from '../../domain/api-key';
import { formatRelative } from '../../domain/relative-time';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { CheckIcon, CopyIcon, PlusIcon } from '../components/Icons';
import { MenuButton } from '../components/MenuButton';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { useAppContext } from '../layout/AppLayout';
import { EmptyState } from '../components/EmptyState';
import { buttonPrimary, buttonSecondary, cardClass, noticeError } from '../ui';

export function ApiKeysTab() {
  const { appId, overview } = useAppContext();
  const keys = useApiKeys(appId);
  const { notify } = useToast();
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<ApiKeyWithSecret | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const environments = overview?.environments ?? [];

  if (environments.length === 0) {
    return (
      <EmptyState
        title="Add an environment first"
        body="An API key reads one environment of this app. Create an environment, then generate a key for it."
        action={
          <Link to={`/apps/${appId}/environments`} className={buttonPrimary}>
            Go to environments
          </Link>
        }
      />
    );
  }

  return (
    <section aria-label="API keys" className="flex flex-col gap-md">
      <HowItWorks />

      <div className="flex items-center justify-between gap-md">
        <h2 className="font-heading-md text-heading-md text-ink">
          Keys{' '}
          {!keys.loading && (
            <span className="tabular font-label-caps text-label-caps text-mute">
              {keys.apiKeys.length}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={buttonPrimary}
        >
          <PlusIcon />
          Generate key
        </button>
      </div>

      {keys.error && <p className="text-error">Error: {keys.error}</p>}

      {keys.loading && keys.apiKeys.length === 0 ? (
        <p className="text-mute" role="status">
          Loading...
        </p>
      ) : keys.apiKeys.length === 0 ? (
        <EmptyState
          title="No API keys yet"
          body="Generate a key to let a service or a browser proxy read this app's flags and configs. The key is shown once."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={buttonPrimary}
            >
              <PlusIcon />
              Generate your first key
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-sm">
          {keys.apiKeys.map((apiKey) => (
            <li
              key={apiKey.id}
              className="flex items-center rounded bg-canvas shadow-[0_0_0_1px_var(--color-hairline-soft)]"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-xs py-md pl-gutter">
                <span className="truncate font-body-md text-body-md font-semibold text-ink">
                  {apiKey.name}
                </span>
                <span className="flex flex-wrap gap-sm">
                  <Badge
                    tone={apiKey.scope === 'web' ? 'warning' : 'neutral'}
                    title={apiKeyScopeHint(apiKey.scope)}
                  >
                    {apiKey.scope}
                  </Badge>
                  <Badge>
                    {environmentNameOf(apiKey.environmentId, environments)}
                  </Badge>
                </span>
                <span className="font-body-sm text-body-sm text-mute">
                  Created {formatRelative(apiKey.createdAt)} ·{' '}
                  {apiKey.lastUsedAt
                    ? `last used ${formatRelative(apiKey.lastUsedAt)}`
                    : 'never used'}
                </span>
              </div>
              <div className="pr-xs">
                <MenuButton
                  label={`More actions for ${apiKey.name}`}
                  items={[
                    {
                      label: 'Revoke key…',
                      onSelect: () => setRevoking(apiKey),
                      danger: true,
                    },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Generate API key"
        description="The key is shown once, right after creation."
      >
        {creating && (
          <CreateKeyForm
            environments={environments}
            onClose={() => setCreating(false)}
            onCreate={async (payload) => {
              const created = await keys.createApiKey(payload);
              setCreating(false);
              setRevealed(created);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={revealed !== null}
        onClose={() => setRevealed(null)}
        title="Copy your new key"
        description="It won't be shown again. Store it in your service's secrets now."
        dismissible={false}
      >
        {revealed && (
          <SecretReveal apiKey={revealed} onDone={() => setRevealed(null)} />
        )}
      </Dialog>

      <ConfirmDialog
        open={revoking !== null}
        title={revoking ? `Revoke ${revoking.name}?` : ''}
        description="Services using this key lose access immediately. This cannot be undone."
        confirmLabel="Revoke key"
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await keys.deleteApiKey(revoking.id);
          notify(`${revoking.name} revoked`);
        }}
      />
    </section>
  );
}

function HowItWorks() {
  return (
    <div className={cardClass}>
      <h2 className="mb-sm font-heading-md text-heading-md text-ink">
        How keys work
      </h2>
      <ul className="flex max-w-prose flex-col gap-sm font-body-sm text-body-sm text-mute">
        <li>
          <Badge>server</Badge> <span className="text-ink">Backends.</span> See
          every flag and config of their environment.
        </li>
        <li>
          <Badge tone="warning">web</Badge>{' '}
          <span className="text-ink">Browser proxies.</span> See only the
          client-visible flags.
        </li>
        <li>
          One key reads <span className="text-ink">one environment</span>. Send
          it as{' '}
          <code className="font-mono text-[13px] text-ink">
            Authorization: Bearer hf_…
          </code>
          .
        </li>
      </ul>
    </div>
  );
}

function CreateKeyForm({
  environments,
  onClose,
  onCreate,
}: {
  environments: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    environmentId: string;
    scope: ApiKeyScope;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [environmentId, setEnvironmentId] = useState(environments[0]?.id ?? '');
  const [scope, setScope] = useState<ApiKeyScope>('server');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await onCreate({ name, environmentId, scope });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create key');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-md"
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        data-autofocus
        placeholder="production server"
        hint="Helps you recognise the key later."
      />
      <SelectField
        label="Environment"
        value={environmentId}
        onChange={(e) => setEnvironmentId(e.target.value)}
        required
        hint="The only environment this key can read."
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Scope"
        value={scope}
        onChange={(e) => {
          const selected = API_KEY_SCOPES.find((s) => s === e.target.value);
          if (selected) setScope(selected);
        }}
        hint={apiKeyScopeHint(scope)}
      >
        {API_KEY_SCOPES.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </SelectField>
      {formError && (
        <p role="alert" className={noticeError}>
          {formError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={buttonPrimary}>
          Generate key
        </button>
      </div>
    </form>
  );
}

function SecretReveal({
  apiKey,
  onDone,
}: {
  apiKey: ApiKeyWithSecret;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey.key);
      setCopied(true);
    } catch {
      // Clipboard API unavailable: the key stays selectable.
    }
  }

  return (
    <div className="flex flex-col gap-md">
      <p className="font-body-sm text-body-sm text-ink">
        Key <strong>{apiKey.name}</strong> created.
      </p>
      <code
        data-autofocus
        tabIndex={0}
        aria-label="API key"
        className="break-all rounded border-2 border-ink bg-soft-cloud p-md font-mono text-[13px] text-ink"
      >
        {apiKey.key}
      </code>
      <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
        <button type="button" onClick={onDone} className={buttonSecondary}>
          I have stored it
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className={buttonPrimary}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy key'}
        </button>
      </div>
    </div>
  );
}
