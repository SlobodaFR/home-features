import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApps } from '../../application/use-apps';
import { slugify } from '../../domain/slugify';
import { useAuth } from '../auth/AuthProvider';
import { apiClient } from '../../infrastructure/api-client';

export function AppsPage() {
  const { loading, error, apps, refresh } = useApps();
  const { user, logout } = useAuth();
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
    if (!window.confirm(`Delete app "${appName}" and all its environments, flags and configs?`)) {
      return;
    }
    await apiClient.deleteApp(appId);
    await refresh();
  }

  return (
    <main className="min-h-screen px-margin-mobile py-section max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-xl">
        <h1 className="font-heading-xl text-heading-xl text-ink">Kinetic Feature Management</h1>
        <div className="flex items-center gap-md">
          <span className="text-mute font-body-sm text-body-sm">{user?.email}</span>
          <button type="button" onClick={() => void logout()} className="font-label-caps text-label-caps text-mute border-b border-mute uppercase">
            Log out
          </button>
        </div>
      </div>

      <section className="mb-xl">
        <h2 className="font-heading-md text-heading-md text-ink mb-md">New app</h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-sm max-w-md">
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder={`Slug (default: ${slugify(name) || 'auto'})`}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <input
            className="border border-hairline rounded px-md py-sm"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {formError && <p className="text-error font-body-sm text-body-sm">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-ink text-surface px-xl py-md rounded-full font-button-md self-start disabled:opacity-50"
          >
            Create app
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-heading-md text-heading-md text-ink mb-md">Apps</h2>
        {loading && apps.length === 0 ? (
          <p className="text-mute">Loading...</p>
        ) : error ? (
          <p className="text-error">Error: {error}</p>
        ) : apps.length === 0 ? (
          <p className="text-mute">No apps yet.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {apps.map((app) => (
              <li key={app.id} className="border border-hairline rounded px-md py-sm flex justify-between items-center">
                <Link to={`/apps/${app.id}`} className="flex flex-col">
                  <span className="font-body-md text-body-md text-ink">{app.name}</span>
                  <span className="font-body-sm text-body-sm text-mute">{app.slug}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(app.id, app.name)}
                  className="font-label-caps text-label-caps text-error border-b border-error uppercase"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
