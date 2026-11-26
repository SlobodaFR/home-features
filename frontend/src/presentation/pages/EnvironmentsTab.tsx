import { FormEvent, useState } from 'react';
import { Environment } from '../../domain/environment';
import { formatRelative } from '../../domain/relative-time';
import { slugify } from '../../domain/slugify';
import { apiClient } from '../../infrastructure/api-client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { PlusIcon } from '../components/Icons';
import { MenuButton } from '../components/MenuButton';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { useAppContext } from '../layout/AppLayout';
import { EmptyState } from '../components/EmptyState';
import { buttonPrimary, buttonSecondary, noticeError } from '../ui';

export function EnvironmentsTab() {
  const { appId, overview, refresh } = useAppContext();
  const { notify } = useToast();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Environment | null>(null);
  const environments = overview?.environments ?? [];
  const flagCount = overview?.flags.length ?? 0;

  return (
    <section aria-label="Environments" className="flex flex-col gap-md">
      <div className="flex items-start justify-between gap-md">
        <p className="max-w-prose font-body-sm text-body-sm text-mute">
          Each flag and config has its own value in every environment
          (production, staging…). An environment cannot be deleted while API
          keys are bound to it.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={`${buttonPrimary} shrink-0`}
        >
          <PlusIcon />
          New environment
        </button>
      </div>

      {environments.length === 0 ? (
        <EmptyState
          title="No environment yet"
          body="Create your first environment (for example production). Flags and configs become editable as soon as one exists."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={buttonPrimary}
            >
              <PlusIcon />
              Create an environment
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-sm">
          {environments.map((env) => (
            <li
              key={env.id}
              className="flex items-center rounded bg-canvas shadow-[0_0_0_1px_var(--color-hairline-soft)]"
            >
              <div className="flex min-h-[64px] min-w-0 flex-1 flex-col justify-center py-sm pl-gutter">
                <span className="truncate font-body-md text-body-md font-semibold text-ink">
                  {env.name}
                </span>
                <span className="truncate font-body-sm text-body-sm text-mute">
                  <span className="font-mono text-[13px]">{env.slug}</span> ·
                  created {formatRelative(env.createdAt)}
                </span>
              </div>
              <div className="pr-xs">
                <MenuButton
                  label={`More actions for ${env.name}`}
                  items={[
                    {
                      label: 'Delete environment…',
                      onSelect: () => setDeleting(env),
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
        title="New environment"
        description="Flags and configs get a value (off / empty) in it."
      >
        {creating && (
          <CreateEnvironmentForm
            appId={appId}
            onClose={() => setCreating(false)}
            onCreated={async () => {
              setCreating(false);
              await refresh();
              notify('Environment created');
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        description={`Its values for ${flagCount} ${flagCount === 1 ? 'flag' : 'flags'} and all configs are deleted with it. This cannot be undone.`}
        confirmLabel="Delete environment"
        typeToConfirm={deleting?.slug}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          // 409 while API keys are bound to it: the message shows in the dialog.
          await apiClient.deleteEnvironment(deleting.id);
          await refresh();
          notify(`${deleting.name} deleted`);
        }}
      />
    </section>
  );
}

function CreateEnvironmentForm({
  appId,
  onClose,
  onCreated,
}: {
  appId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const derivedSlug = slugify(name);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.createEnvironment(appId, {
        name,
        slug: slug.trim() === '' ? derivedSlug : slug,
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
        placeholder="production"
      />
      <TextField
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={derivedSlug || 'auto'}
        hint={
          <>
            Leave empty to use{' '}
            <span className="font-mono text-ink">{derivedSlug || '…'}</span>.
          </>
        }
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
          Create environment
        </button>
      </div>
    </form>
  );
}
