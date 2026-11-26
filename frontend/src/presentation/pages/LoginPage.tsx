import { buttonPrimary } from '../ui';

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-margin-mobile">
      <div className="flex w-full max-w-sm flex-col items-center gap-xl">
        <h1 className="text-center font-display-campaign text-display-campaign-mobile uppercase tracking-tighter text-ink">
          FEATURES
        </h1>
        <p className="text-center font-body-sm text-body-sm text-mute">
          Feature flags, configs and API keys for the home services.
        </p>
        <a href="/api/auth/login" className={`${buttonPrimary} w-full`}>
          Sign in
        </a>
      </div>
    </main>
  );
}
