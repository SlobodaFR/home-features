import { useAuth } from '../auth/AuthProvider';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen flex items-center justify-center px-margin-mobile">
      <div className="w-full max-w-sm flex flex-col items-center gap-xl text-center">
        <h1 className="font-heading-xl text-heading-xl text-ink">Kinetic Feature Management</h1>
        <p className="font-body-md text-body-md text-mute">Logged in as {user?.email}</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="bg-ink text-surface px-xl py-md rounded-full font-button-md"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
