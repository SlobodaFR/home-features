import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApps } from '../../application/use-apps';
import { slugify } from '../../domain/slugify';
import { PageShell } from '../components/PageShell';
import { apiClient } from '../../infrastructure/api-client';
import {
  actionDanger,
  buttonPrimary,
  cardClass,
  inputClass,
  labelClass,
  noticeError,
} from '../ui';

export function AppsPage() {
  const { loading, error, apps, refresh } = useApps();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await apiClient.createApp({
        name,
        slug: slug.trim() === '' ? slugify(name) : slug,
        description: description.trim() === '' ? null : description,
      });
      setName('');
      setSlug('');
      setDescription('');
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(appId: string, appName: string) {
    if (
      !window.confirm(
        `Delete app "${appName}" and all its environments, flags and configs?`,
      )
    ) {
      return;
    }
    await apiClient.deleteApp(appId);
    await refresh();
  }

  return (
    <PageShell>
      <h1 className="font-heading-xl text-heading-xl text-ink">Apps</h1>

      <section className={cardClass} aria-labelledby="apps-heading">
        <div className="mb-md flex items-baseline justify-between gap-md">
          <h2
            id="apps-heading"
            className="font-heading-md text-heading-md text-ink"
          >
            All apps
          </h2>
          {apps.length > 0 && (
            <span className={`${labelClass} tabular`}>{apps.length}</span>
          )}
        </div>
        {loading && apps.length === 0 ? (
          <p className="text-mute" role="status">
            Loading...
          </p>
        ) : error ? (
          <p className="text-error">Error: {error}</p>
        ) : apps.length === 0 ? (
          <p className="text-mute">No apps yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline-soft border-y border-hairline-soft">
            {apps.map((app) => (
              <li
                key={app.id}
                className="flex items-center justify-between gap-md py-sm"
              >
                <Link
                  to={`/apps/${app.id}`}
                  className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center"
                >
                  <span className="truncate font-body-md text-body-md font-semibold text-ink">
                    {app.name}
                  </span>
                  <span className="truncate font-body-sm text-body-sm text-mute">
                    {app.slug}
                    {app.description ? ` · ${app.description}` : ''}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(app.id, app.name)}
                  aria-label={`Delete app ${app.name}`}
                  className={actionDanger}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass} aria-labelledby="new-app-heading">
        <h2
          id="new-app-heading"
          className="mb-md font-heading-md text-heading-md text-ink"
        >
          New app
        </h2>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex max-w-md flex-col gap-sm"
        >
          <input
            className={inputClass}
            aria-label="Name"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className={inputClass}
            aria-label="Slug"
            placeholder={`Slug (default: ${slugify(name) || 'auto'})`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <input
            className={inputClass}
            aria-label="Description"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {formError && <p className={noticeError}>{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className={`${buttonPrimary} self-start`}
          >
            Create app
          </button>
        </form>
      </section>
    </PageShell>
  );
}
