import { CSSProperties, FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ConfigEntryWithValues,
  ConfigValueType,
} from '../../domain/config-entry';
import { slugify } from '../../domain/slugify';
import { apiClient } from '../../infrastructure/api-client';
import { Badge } from '../components/Badge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Dialog } from '../components/Dialog';
import { PlusIcon, SearchIcon } from '../components/Icons';
import { MenuButton } from '../components/MenuButton';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { ValueEditor } from '../components/ValueEditor';
import { useAppContext } from '../layout/AppLayout';
import { EmptyState } from '../components/EmptyState';
import {
  buttonPrimary,
  buttonSecondary,
  inputClass,
  labelClass,
  noticeError,
} from '../ui';

const TYPE_HINTS: Record<ConfigValueType, string> = {
  [ConfigValueType.STRING]: 'Free text.',
  [ConfigValueType.NUMBER]: 'A number, e.g. 42 or 0.5.',
  [ConfigValueType.BOOLEAN]: 'true or false.',
  [ConfigValueType.JSON]: 'A JSON document, e.g. {"limit": 10}.',
};

export function ConfigsTab() {
  const { appId, overview, refresh } = useAppContext();
  const { notify } = useToast();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ConfigEntryWithValues | null>(null);

  const configs = overview?.configs;
  const environments = overview?.environments ?? [];
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (configs ?? []).filter(
      (config) =>
        needle === '' ||
        `${config.name} ${config.key}`.toLowerCase().includes(needle),
    );
  }, [configs, query]);

  if (environments.length === 0 && (configs?.length ?? 0) === 0) {
    return (
      <EmptyState
        title="Add an environment first"
        body="A config holds one value per environment. Create at least one environment, then add your configs."
        action={
          <Link to={`/apps/${appId}/environments`} className={buttonPrimary}>
            Go to environments
          </Link>
        }
      />
    );
  }

  async function saveValue(
    config: ConfigEntryWithValues,
    environmentId: string,
    value: string,
  ): Promise<boolean> {
    try {
      await apiClient.setConfigValue(config.id, environmentId, value);
      await refresh();
      notify(`${config.name} saved`);
      return true;
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Failed to set value',
        'error',
      );
      return false;
    }
  }

  const gridTemplate = `minmax(0,1fr) ${environments.length > 0 ? `repeat(${environments.length}, minmax(140px, 1fr))` : ''} 44px`;
  // Below this width the grid scrolls instead of squeezing the config name.
  const gridMinWidth = 240 + environments.length * 152 + 44 + 48;

  return (
    <section aria-label="Configs" className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-gutter top-1/2 -translate-y-1/2 text-mute">
            <SearchIcon />
          </span>
          <input
            type="search"
            aria-label="Search configs"
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
          New config
        </button>
      </div>

      {!configs || configs.length === 0 ? (
        <EmptyState
          title="No configs yet"
          body="A config is a typed value (text, number, boolean or JSON) that differs per environment: a limit, a URL, a message. Services read it with an API key."
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={buttonPrimary}
            >
              <PlusIcon />
              Create your first config
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <p className="text-mute">No config matches your search.</p>
      ) : (
        <div
          className="-m-px overflow-x-auto p-px"
          tabIndex={0}
          role="region"
          aria-label="Configs by environment"
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
              <span>Config</span>
              {environments.map((env) => (
                <span key={env.id} className="truncate">
                  {env.name}
                </span>
              ))}
              <span />
            </div>
            <ul className="flex flex-col gap-sm md:gap-0">
              {visible.map((config) => (
                <li
                  key={config.id}
                  className="flex flex-col gap-sm rounded bg-canvas p-gutter shadow-[0_0_0_1px_var(--color-hairline-soft)] md:grid md:items-start md:gap-md md:rounded-none md:bg-transparent md:py-sm md:shadow-none md:[&:not(:last-child)]:border-b md:[&:not(:last-child)]:border-hairline-soft"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <div className="flex items-start justify-between gap-md md:contents">
                    <div className="flex min-w-0 flex-col gap-xs md:py-xs">
                      <span className="truncate font-body-md text-body-md font-semibold text-ink">
                        {config.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-sm">
                        <span className="truncate font-mono text-[13px] text-mute">
                          {config.key}
                        </span>
                        <Badge>{config.type}</Badge>
                      </span>
                    </div>
                    <div className="-mr-sm -mt-sm md:hidden">
                      <ConfigMenu
                        config={config}
                        onDelete={() => setDeleting(config)}
                      />
                    </div>
                  </div>

                  {environments.map((env) => {
                    const value = config.values.find(
                      (v) => v.environmentId === env.id,
                    );
                    return (
                      <label key={env.id} className="flex flex-col gap-xs">
                        <span className={`${labelClass} md:sr-only`}>
                          {env.name}
                        </span>
                        <ValueEditor
                          label={`${config.name} in ${env.name}`}
                          value={value?.value ?? ''}
                          onSave={(next) => saveValue(config, env.id, next)}
                        />
                      </label>
                    );
                  })}

                  <div className="hidden md:block">
                    <ConfigMenu
                      config={config}
                      onDelete={() => setDeleting(config)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="New config"
        description="A typed value with one setting per environment."
      >
        {creating && (
          <CreateConfigForm
            appId={appId}
            onClose={() => setCreating(false)}
            onCreated={async () => {
              setCreating(false);
              await refresh();
              notify('Config created');
            }}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Delete ${deleting.name}?` : ''}
        description="Its values in every environment are deleted. Services reading it fall back to their default. This cannot be undone."
        confirmLabel="Delete config"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await apiClient.deleteConfigEntry(deleting.id);
          await refresh();
          notify(`${deleting.name} deleted`);
        }}
      />
    </section>
  );
}

function ConfigMenu({
  config,
  onDelete,
}: {
  config: ConfigEntryWithValues;
  onDelete: () => void;
}) {
  return (
    <MenuButton
      label={`More actions for ${config.name}`}
      items={[{ label: 'Delete config…', onSelect: onDelete, danger: true }]}
    />
  );
}

function CreateConfigForm({
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
  const [type, setType] = useState<ConfigValueType>(ConfigValueType.STRING);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const derivedKey = slugify(name);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.createConfigEntry(appId, {
        key: key.trim() === '' ? derivedKey : key,
        name,
        type,
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
        placeholder="Max items"
      />
      <TextField
        label="Key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={derivedKey || 'auto'}
        hint={
          <>
            What your code reads. Leave empty to use{' '}
            <span className="font-mono text-ink">{derivedKey || '…'}</span>.
          </>
        }
      />
      <SelectField
        label="Type"
        value={type}
        onChange={(e) => {
          const selected = Object.values(ConfigValueType).find(
            (candidate) => (candidate as string) === e.target.value,
          );
          if (selected) setType(selected);
        }}
        hint={TYPE_HINTS[type]}
      >
        {Object.values(ConfigValueType).map((candidate) => (
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
          Create config
        </button>
      </div>
    </form>
  );
}
