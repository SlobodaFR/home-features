import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

/** Compact app bar shared by the signed-in pages: wordmark on the left, user menu on the right. */
export function PageHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-md pl-[max(20px,env(safe-area-inset-left))] pr-[max(12px,env(safe-area-inset-right))] md:px-margin-desktop">
        <Link
          to="/"
          className="font-display-campaign text-[26px] uppercase leading-none tracking-tighter text-ink"
        >
          Kinetic
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const email = user?.email ?? '';
  const initial = (user?.name || email || '?').charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-canvas font-button-md text-button-md text-ink hover:bg-soft-cloud"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-xs w-64 max-w-[calc(100vw-24px)] rounded bg-canvas p-sm shadow-[0_0_0_1px_var(--color-hairline),0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <p className="truncate px-md py-sm font-body-sm text-body-sm text-mute">
            {email}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="flex min-h-[44px] w-full items-center rounded px-md font-button-md text-button-md text-ink hover:bg-soft-cloud"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
