import { useCallback, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { useAppOverview } from '../../application/use-app-overview';
import { withFlagValue } from '../../domain/feature-flag';
import { AppOverview } from '../../domain/overview';
import { apiClient } from '../../infrastructure/api-client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArrowLeftIcon } from '../components/Icons';
import { MenuButton } from '../components/MenuButton';
import { PageShell } from '../components/PageShell';
import { useToast } from '../components/Toast';

export interface AppContext {
  appId: string;
  loading: boolean;
  error: string | null;
  overview: AppOverview | null;
  refresh: () => Promise<void>;
  /** Optimistic toggle: the switch moves at once and rolls back with a toast on failure. */
  toggleFlag: (
    flagId: string,
    environmentId: string,
    enabled: boolean,
  ) => Promise<void>;
  /** "flagId:environmentId" of toggles awaiting the server. */
  pending: ReadonlySet<string>;
}

export function useAppContext(): AppContext {
  return useOutletContext<AppContext>();
}

export function AppLayout() {
  const { appId = '' } = useParams<{ appId: string }>();
  const { loading, error, overview, refresh, patch } = useAppOverview(appId);
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [deletingApp, setDeletingApp] = useState(false);

  const toggleFlag = useCallback(
    async (flagId: string, environmentId: string, enabled: boolean) => {
      const key = `${flagId}:${environmentId}`;
      const apply = (value: boolean) =>
        patch((current) => ({
          ...current,
          flags: current.flags.map((flag) =>
            flag.id === flagId
              ? withFlagValue(
                  flag,
                  environmentId,
                  value,
                  new Date().toISOString(),
                )
              : flag,
          ),
        }));
      setPending((current) => new Set(current).add(key));
      apply(enabled);
      try {
        await apiClient.setFlagValue(flagId, environmentId, enabled);
        const flag = overview?.flags.find((f) => f.id === flagId);
        const env = overview?.environments.find((e) => e.id === environmentId);
        notify(
          `${flag?.name ?? 'Flag'} is now ${enabled ? 'on' : 'off'} in ${env?.name ?? 'the environment'}`,
        );
      } catch (err) {
        apply(!enabled);
        notify(
          err instanceof Error ? err.message : 'Failed to update the flag',
          'error',
        );
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [notify, overview, patch],
  );

  if (loading && !overview) {
    return (
      <PageShell>
        <p className="text-center text-mute" role="status">
          Loading...
        </p>
      </PageShell>
    );
  }

  if (error || !overview) {
    return (
      <PageShell>
        <p className="text-center text-error">Error: {error}</p>
      </PageShell>
    );
  }

  const { app } = overview;
  const tabs = [
    {
      to: `/apps/${appId}`,
      label: 'Flags',
      count: overview.flags.length,
      end: true,
    },
    {
      to: `/apps/${appId}/configs`,
      label: 'Configs',
      count: overview.configs.length,
    },
    {
      to: `/apps/${appId}/environments`,
      label: 'Environments',
      count: overview.environments.length,
    },
    { to: `/apps/${appId}/api-keys`, label: 'API keys', count: null },
  ];

  const context: AppContext = {
    appId,
    loading,
    error,
    overview,
    refresh,
    toggleFlag,
    pending,
  };

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <Link
            to="/"
            className="-ml-sm inline-flex min-h-[44px] items-center gap-xs px-sm font-label-caps text-label-caps uppercase text-mute hover:text-ink"
          >
            <ArrowLeftIcon />
            All apps
          </Link>
          <h1 className="truncate font-heading-xl text-heading-xl text-ink">
            {app.name}
          </h1>
          <p className="truncate font-body-sm text-body-sm text-mute">
            <span className="font-mono text-[13px]">{app.slug}</span>
            {app.description ? ` · ${app.description}` : ''}
          </p>
        </div>
        <div className="mt-xl">
          <MenuButton
            label={`More actions for ${app.name}`}
            items={[
              {
                label: 'Delete app…',
                onSelect: () => setDeletingApp(true),
                danger: true,
              },
            ]}
          />
        </div>
      </div>

      <nav
        aria-label="App sections"
        className="-mx-margin-mobile overflow-x-auto border-b border-hairline-soft px-margin-mobile md:mx-0 md:px-0"
      >
        <ul className="flex min-w-max gap-lg">
          {tabs.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => {
                  const active =
                    isActive ||
                    (tab.end === true && location.pathname.includes('/flags/'));
                  return `-mb-px inline-flex min-h-[44px] items-center gap-sm border-b-2 font-button-md text-button-md ${
                    active
                      ? 'border-ink text-ink'
                      : 'border-transparent text-mute hover:text-ink'
                  }`;
                }}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className="tabular font-label-caps text-label-caps text-mute">
                    {tab.count}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={context} />

      <ConfirmDialog
        open={deletingApp}
        title={`Delete ${app.name}?`}
        description="This permanently deletes the app with all its environments, flags, configs and API keys. Consumers using its keys lose access. This cannot be undone."
        confirmLabel="Delete app"
        typeToConfirm={app.slug}
        onClose={() => setDeletingApp(false)}
        onConfirm={async () => {
          await apiClient.deleteApp(app.id);
          notify(`${app.name} deleted`);
          void navigate('/', { replace: true });
        }}
      />
    </PageShell>
  );
}
