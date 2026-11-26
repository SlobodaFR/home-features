import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deletionWarning,
  enabledEnvironmentNames,
  lastEvaluatedLabel,
} from '../../domain/feature-flag';
import {
  describeChange,
  FlagValueChange,
} from '../../domain/flag-value-change';
import { formatRelative } from '../../domain/relative-time';
import { apiClient } from '../../infrastructure/api-client';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArrowLeftIcon, CheckIcon, CopyIcon } from '../components/Icons';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { useAppContext } from '../layout/AppLayout';
import {
  buttonDanger,
  buttonPrimary,
  cardClass,
  iconButton,
  labelClass,
  noticeError,
} from '../ui';

export function FlagDetailPage() {
  const { flagId = '' } = useParams<{ flagId: string }>();
  const { appId, overview, toggleFlag, pending, refresh, changeCount } =
    useAppContext();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [exposing, setExposing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exposureBusy, setExposureBusy] = useState(false);

  const flag = overview?.flags.find((f) => f.id === flagId);
  const environments = overview?.environments ?? [];

  if (!flag) {
    return (
      <div className="flex flex-col items-start gap-md">
        <p className="text-mute">This flag does not exist (any more).</p>
        <Link to={`/apps/${appId}`} className={buttonPrimary}>
          Back to flags
        </Link>
      </div>
    );
  }

  const warning = deletionWarning(flag, environments);
  const enabledIn = enabledEnvironmentNames(flag, environments);

  async function setClientExposed(clientExposed: boolean) {
    setExposureBusy(true);
    try {
      await apiClient.updateFeatureFlag(flagId, { clientExposed });
      await refresh();
      notify(
        clientExposed
          ? 'Flag exposed to web keys'
          : 'Flag hidden from web keys',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setExposureBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(flag!.key);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: the key stays selectable.
    }
  }

  return (
    <div className="flex flex-col gap-xl">
      <div>
        <Link
          to={`/apps/${appId}`}
          className="-ml-sm inline-flex min-h-[44px] items-center gap-xs px-sm font-label-caps text-label-caps uppercase text-mute hover:text-ink"
        >
          <ArrowLeftIcon />
          Flags
        </Link>
        <h2 className="font-heading-lg text-heading-lg text-ink">
          {flag.name}
        </h2>
        <div className="flex items-center gap-xs">
          <code className="font-mono text-[14px] text-mute">{flag.key}</code>
          <button
            type="button"
            onClick={() => void copyKey()}
            aria-label={`Copy key ${flag.key}`}
            className={`${iconButton} text-mute`}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <div className="mt-sm flex flex-wrap gap-sm">
          <Badge>{lastEvaluatedLabel(flag.lastEvaluatedAt)}</Badge>
        </div>
      </div>

      <section className={cardClass} aria-labelledby="flag-envs">
        <h3
          id="flag-envs"
          className="mb-xs font-heading-md text-heading-md text-ink"
        >
          Environments
        </h3>
        <p className="mb-sm font-body-sm text-body-sm text-mute">
          Switching applies immediately. Consumers see the change on their next
          evaluation.
        </p>
        <ul className="divide-y divide-hairline-soft">
          {environments.map((env) => {
            const value = flag.values.find((v) => v.environmentId === env.id);
            return (
              <li key={env.id}>
                <Switch
                  showLabel
                  label={env.name}
                  accessibleName={`${flag.name} in ${env.name}`}
                  checked={value?.enabled ?? false}
                  busy={pending.has(`${flag.id}:${env.id}`)}
                  onChange={(enabled) =>
                    void toggleFlag(flag.id, env.id, enabled)
                  }
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className={cardClass} aria-labelledby="flag-visibility">
        <h3
          id="flag-visibility"
          className="mb-xs font-heading-md text-heading-md text-ink"
        >
          Visibility
        </h3>
        <p className="mb-sm font-body-sm text-body-sm text-mute">
          A <em>web</em> API key (behind a browser proxy) only sees flags that
          are client-visible. Server keys see every flag.
        </p>
        <Switch
          showLabel
          label="Client-visible (web keys)"
          busy={exposureBusy}
          checked={flag.clientExposed}
          onChange={(checked) =>
            checked ? setExposing(true) : void setClientExposed(false)
          }
        />
      </section>

      <DetailsSection
        key={flag.id}
        name={flag.name}
        description={flag.description}
        onSave={async (name, description) => {
          await apiClient.updateFeatureFlag(flagId, { name, description });
          await refresh();
          notify('Flag updated');
        }}
      />

      <HistorySection
        flagId={flagId}
        environments={environments}
        reloadKey={changeCount}
      />

      <section
        className="rounded border border-error p-gutter md:p-xl"
        aria-labelledby="flag-danger"
      >
        <h3
          id="flag-danger"
          className="mb-xs font-heading-md text-heading-md text-error"
        >
          Delete flag
        </h3>
        <p className="mb-md font-body-sm text-body-sm text-mute">
          {enabledIn.length > 0
            ? `This flag is on in ${enabledIn.join(', ')}. Deleting it makes its consumers fall back to their code default.`
            : 'Consumers fall back to their code default once it is deleted.'}
        </p>
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className={buttonDanger}
        >
          Delete this flag…
        </button>
      </section>

      <ConfirmDialog
        open={exposing}
        title="Expose to web keys?"
        description={`Browsers behind a web key will see the value of "${flag.key}". Only expose flags that are safe to show to end users.`}
        confirmLabel="Expose flag"
        onClose={() => setExposing(false)}
        onConfirm={() => setClientExposed(true)}
        tone="neutral"
      />

      <ConfirmDialog
        open={deleting}
        title={`Delete ${flag.name}?`}
        description={
          warning ??
          `Delete "${flag.key}" (${lastEvaluatedLabel(flag.lastEvaluatedAt)}). This cannot be undone.`
        }
        confirmLabel="Delete flag"
        typeToConfirm={warning ? flag.key : undefined}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await apiClient.deleteFeatureFlag(
            flag.id,
            warning ? flag.key : undefined,
          );
          void navigate(`/apps/${appId}`, { replace: true });
          notify(`${flag.name} deleted`);
          await refresh();
        }}
      />
    </div>
  );
}

function DetailsSection({
  name: initialName,
  description: initialDescription,
  onSave,
}: {
  name: string;
  description: string | null;
  onSave: (name: string, description: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty =
    name !== initialName || description !== (initialDescription ?? '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(name, description.trim() === '' ? null : description);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass} aria-labelledby="flag-details">
      <h3
        id="flag-details"
        className="mb-md font-heading-md text-heading-md text-ink"
      >
        Details
      </h3>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-md">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this flag controls"
        />
        {error && (
          <p role="alert" className={noticeError}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!dirty || saving}
          className={`${buttonPrimary} self-start`}
        >
          Save changes
        </button>
      </form>
    </section>
  );
}

function HistorySection({
  flagId,
  environments,
  reloadKey,
}: {
  flagId: string;
  environments: { id: string; name: string }[];
  /** Changes when a switch was toggled, to reload the history. */
  reloadKey: number;
}) {
  const [changes, setChanges] = useState<FlagValueChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchFlagHistory(flagId)
      .then((result) => !cancelled && setChanges(result))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setError(err instanceof Error ? err.message : 'Failed to load'),
      );
    return () => {
      cancelled = true;
    };
    // reloadKey only re-triggers the fetch after a toggle.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [flagId, reloadKey]);

  return (
    <section className={cardClass} aria-labelledby="flag-history">
      <h3
        id="flag-history"
        className="mb-md font-heading-md text-heading-md text-ink"
      >
        History
      </h3>
      {error ? (
        <p className="text-error">Error: {error}</p>
      ) : changes === null ? (
        <p className="text-mute" role="status">
          Loading...
        </p>
      ) : changes.length === 0 ? (
        <p className="text-mute">No value change recorded yet.</p>
      ) : (
        <ul className="divide-y divide-hairline-soft">
          {changes.map((change) => (
            <li key={change.id} className="flex flex-col gap-xs py-sm">
              <span className="font-body-md text-body-md text-ink">
                {describeChange(change, environments)}
              </span>
              <span
                className={`${labelClass} tabular normal-case`}
                title={new Date(change.at).toLocaleString()}
              >
                {formatRelative(change.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
