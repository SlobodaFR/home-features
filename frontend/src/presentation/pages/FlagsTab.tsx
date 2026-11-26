import { CSSProperties, FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FlagFilter,
  filterFlags,
  FeatureFlagWithValues,
} from '../../domain/feature-flag';
import { formatRelative } from '../../domain/relative-time';
import { slugify } from '../../domain/slugify';
import { apiClient } from '../../infrastructure/api-client';
import { Badge } from '../components/Badge';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { ChevronRightIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { useAppContext } from '../layout/AppLayout';
import { buttonPrimary, buttonSecondary, inputClass, noticeError } from '../ui';

const FILTERS: { value: FlagFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'client', label: 'Client-visible' },
  { value: 'never-evaluated', label: 'Never evaluated' },
];

export function FlagsTab() {
  const { appId, overview, toggleFlag, pending, refresh } = useAppContext();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FlagFilter>('all');
  const [creating, setCreating] = useState(false);

  const flags = overview?.flags;
  const environments = overview?.environments ?? [];
  const visible = useMemo(
    () => filterFlags(flags ?? [], query, filter),
    [flags, query, filter],
  );

  if (environments.length === 0 && (flags?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="Add an environment first"
        body="A flag is switched on or off per environment (production, staging…). Create at least one environment, then add your flags."
        action={
          <Link to={`/apps/${appId}/environments`} className={buttonPrimary}>
            Go to environments
          </Link>
        }
      />
    );
  }

  const gridTemplate = `minmax(0,1fr) repeat(${environments.length}, minmax(88px, 112px)) 210px`;
  // Below this width the grid scrolls instead of squeezing the flag name.
  const gridMinWidth = 240 + environments.length * 100 + 210 + 32;

  return (
    <section aria-label="Feature flags" className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-gutter top-1/2 -translate-y-1/2 text-mute">
            <SearchIcon />
          </span>
          <input
            type="search"
            aria-label="Search flags"
            placeholder="Search by name or key"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${inputClass} pl-[48px]`}
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={buttonPrimary}
        >
          <PlusIcon />
          New flag
        </button>
      </div>

      {flags && flags.length > 0 && (
        <div
          role="group"
          aria-label="Filter flags"
          className="-mx-margin-mobile flex gap-sm overflow-x-auto px-margin-mobile md:mx-0 md:px-0"
        >
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-lg font-button-md text-button-md ${
                filter === item.value
                  ? 'border-ink bg-ink text-on-primary'
                  : 'border-hairline text-ink hover:bg-soft-cloud'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {!flags || flags.length === 0 ? (
        <EmptyState
          title="No flags yet"
          body="A feature flag turns a feature on or off without a deploy. Create one, then switch it per environment; your services read it with an API key."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={buttonPrimary}
            >
              <PlusIcon />
              Create your first flag
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="text-mute">No flag matches your search.</p>
      ) : (
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Flags by environment"
        >
          <div
            className="md:min-w-[var(--grid-min)]"
            style={{ '--grid-min': `${gridMinWidth}px` } as CSSProperties}
          >
            <div
              aria-hidden="true"
              className="hidden items-end gap-md border-b border-hairline px-gutter pb-sm font-label-caps text-label-caps uppercase text-mute md:grid"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span>Flag</span>
              {environments.map((env) => (
                <span key={env.id} className="truncate">
                  {env.name}
                </span>
              ))}
              <span>Status</span>
            </div>
            <ul className="flex flex-col gap-sm md:gap-0">
              {visible.map((flag) => (
                <FlagRow
                  key={flag.id}
                  flag={flag}
                  appId={appId}
                  gridTemplate={gridTemplate}
                  environments={environments}
                  pending={pending}
                  onToggle={toggleFlag}
                />
              ))}
            </ul>
          </div>
        </div>
      )}

      <CreateFlagDialog
        appId={appId}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          setCreating(false);
          await refresh();
          notify('Flag created');
        }}
      />
    </section>
  );
}

function FlagRow({
  flag,
  appId,
  gridTemplate,
  environments,
  pending,
  onToggle,
}: {
  flag: FeatureFlagWithValues;
  appId: string;
  gridTemplate: string;
  environments: { id: string; name: string }[];
  pending: ReadonlySet<string>;
  onToggle: (
    flagId: string,
    environmentId: string,
    enabled: boolean,
  ) => Promise<void>;
}) {
  const subtitle = flag.name === flag.key ? null : flag.key;
  return (
    <li
      className="flex flex-col gap-sm rounded bg-canvas p-gutter shadow-[0_0_0_1px_var(--color-hairline-soft)] md:grid md:items-center md:gap-md md:rounded-none md:bg-transparent md:py-sm md:shadow-none md:[&:not(:last-child)]:border-b md:[&:not(:last-child)]:border-hairline-soft"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <Link
        to={`/apps/${appId}/flags/${flag.id}`}
        className="flex min-h-[44px] min-w-0 items-center justify-between gap-md"
      >
        <span className="flex min-w-0 flex-col">
          <span
            className={`truncate text-ink ${
              subtitle
                ? 'font-body-md text-body-md font-semibold'
                : 'font-mono text-[15px] font-semibold'
            }`}
          >
            {flag.name}
          </span>
          {subtitle && (
            <span className="truncate font-mono text-[13px] text-mute">
              {subtitle}
            </span>
          )}
        </span>
        <span className="text-mute md:hidden">
          <ChevronRightIcon />
        </span>
      </Link>

      {environments.map((env) => {
        const value = flag.values.find((v) => v.environmentId === env.id);
        return (
          <div key={env.id} className="md:flex md:justify-start">
            <div className="w-full md:w-auto">
              <Switch
                showLabel
                labelHiddenFromMd
                label={env.name}
                accessibleName={`${flag.name} in ${env.name}`}
                checked={value?.enabled ?? false}
                busy={pending.has(`${flag.id}:${env.id}`)}
                onChange={(enabled) => void onToggle(flag.id, env.id, enabled)}
              />
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-sm">
        {flag.clientExposed && (
          <Badge
            tone="warning"
            title="Visible to web API keys (browser-facing)"
          >
            Client-visible
          </Badge>
        )}
        <Badge>
          {flag.lastEvaluatedAt
            ? `Evaluated ${formatRelative(flag.lastEvaluatedAt)}`
            : 'Never evaluated'}
        </Badge>
      </div>
    </li>
  );
}

function CreateFlagDialog({
  appId,
  open,
  onClose,
  onCreated,
}: {
  appId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New flag"
      description="Created off in every environment. The key cannot change afterwards."
    >
      {open && (
        <CreateFlagForm appId={appId} onClose={onClose} onCreated={onCreated} />
      )}
    </Dialog>
  );
}

function CreateFlagForm({
  appId,
  onClose,
  onCreated,
}: {
  appId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const derivedKey = slugify(name);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.createFeatureFlag(appId, {
        key: key.trim() === '' ? derivedKey : key,
        name,
        description: description.trim() === '' ? null : description,
      });
      await onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
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
        placeholder="New dashboard"
      />
      <TextField
        label="Key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={derivedKey || 'auto'}
        hint={
          <>
            What your code reads. Leave empty to use{' '}
            <span className="font-mono text-ink">{derivedKey || '…'}</span>. It
            cannot be changed later.
          </>
        }
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What this flag controls"
      />
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
          Create flag
        </button>
      </div>
    </form>
  );
}
