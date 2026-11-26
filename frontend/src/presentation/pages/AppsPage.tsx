import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApps } from '../../application/use-apps';
import { useAppSummaries } from '../../application/use-app-summaries';
import { App } from '../../domain/app';
import { AppSummary, pluralize } from '../../domain/app-summary';
import { formatRelative } from '../../domain/relative-time';
import { slugify } from '../../domain/slugify';
import { apiClient } from '../../infrastructure/api-client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { ChevronRightIcon, PlusIcon, SearchIcon } from '../components/Icons';
import { MenuButton } from '../components/MenuButton';
import { PageShell } from '../components/PageShell';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { buttonPrimary, buttonSecondary, inputClass, noticeError } from '../ui';

const SEARCH_THRESHOLD = 4;

export function AppsPage() {
  const { loading, error, apps, refresh } = useApps();
  const summaries = useAppSummaries(apps);
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<App | null>(null);

  const visibleApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return apps;
    return apps.filter((app) =>
      [app.name, app.slug, app.description ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [apps, query]);

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-md">
        <h1 className="font-heading-xl text-heading-xl text-ink">Apps</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={buttonPrimary}
        >
          <PlusIcon />
          New app
        </button>
      </div>

      {apps.length >= SEARCH_THRESHOLD && (
        <div className="relative">
          <span className="pointer-events-none absolute left-gutter top-1/2 -translate-y-1/2 text-mute">
            <SearchIcon />
          </span>
          <input
            type="search"
            aria-label="Search apps"
            placeholder="Search apps"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${inputClass} pl-[48px]`}
          />
        </div>
      )}

      {loading && apps.length === 0 ? (
        <p className="text-mute" role="status">
          Loading...
        </p>
      ) : error ? (
        <p className="text-error">Error: {error}</p>
      ) : apps.length === 0 ? (
        <EmptyApps onCreate={() => setCreating(true)} />
      ) : visibleApps.length === 0 ? (
        <p className="text-mute">No app matches “{query}”.</p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {visibleApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              summary={summaries[app.id]}
              onDelete={() => setDeleting(app)}
            />
          ))}
        </ul>
      )}

      <CreateAppDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={async () => {
          setCreating(false);
          await refresh();
          notify('App created');
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        description="This permanently deletes the app with all its environments, flags, configs and API keys. Consumers using its keys lose access. This cannot be undone."
        confirmLabel="Delete app"
        typeToConfirm={deleting?.slug}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await apiClient.deleteApp(deleting.id);
          await refresh();
          notify(`${deleting.name} deleted`);
        }}
      />
    </PageShell>
  );
}

function AppCard({
  app,
  summary,
  onDelete,
}: {
  app: App;
  summary: AppSummary | undefined;
  onDelete: () => void;
}) {
  // The slug only helps when it says something the name does not.
  const subtitle =
    app.description ?? (app.slug === slugify(app.name) ? null : app.slug);

  return (
    <li className="flex items-center rounded bg-canvas shadow-[0_0_0_1px_var(--color-hairline-soft)] transition-shadow [@media(hover:hover)]:hover:shadow-[0_0_0_1px_var(--color-hairline)]">
      <Link
        to={`/apps/${app.id}`}
        className="flex min-h-[72px] min-w-0 flex-1 items-center gap-md rounded py-md pl-gutter pr-sm"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-xs">
          <span className="truncate font-body-md text-body-md font-semibold text-ink">
            {app.name}
          </span>
          {subtitle && (
            <span className="truncate font-body-sm text-body-sm text-mute">
              {subtitle}
            </span>
          )}
          <span className="tabular flex flex-wrap gap-x-md font-body-sm text-body-sm text-mute">
            {summary ? (
              <>
                <span>
                  {pluralize(summary.environmentCount, 'environment')}
                </span>
                <span>{pluralize(summary.flagCount, 'flag')}</span>
                <span>
                  {summary.lastChangeAt
                    ? `Changed ${formatRelative(summary.lastChangeAt)}`
                    : 'No changes yet'}
                </span>
              </>
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </span>
        </span>
        <span className="text-mute">
          <ChevronRightIcon />
        </span>
      </Link>
      <div className="pr-xs">
        <MenuButton
          label={`More actions for ${app.name}`}
          items={[{ label: 'Delete app…', onSelect: onDelete, danger: true }]}
        />
      </div>
    </li>
  );
}

function EmptyApps({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      title="No apps yet"
      body="An app groups the environments, feature flags and configs of one of your services. Create your first app, then add a production environment and a flag."
      action={
        <button type="button" onClick={onCreate} className={buttonPrimary}>
          <PlusIcon />
          Create your first app
        </button>
      }
    />
  );
}

function CreateAppDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New app"
      description="An app holds the environments, flags and configs of one service."
    >
      {open && <CreateAppForm onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function CreateAppForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const derivedSlug = slugify(name);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.createApp({
        name,
        slug: slug.trim() === '' ? derivedSlug : slug,
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
        placeholder="Home Budget"
      />
      <TextField
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={derivedSlug || 'auto'}
        hint={
          <>
            Identifier used in URLs. Leave empty to use{' '}
            <span className="font-mono text-ink">{derivedSlug || '…'}</span>.
          </>
        }
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What this app does"
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
          Create app
        </button>
      </div>
    </form>
  );
}
