import { ReactNode } from 'react';
import { PageHeader } from './PageHeader';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <PageHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-xl px-margin-mobile py-xl pb-[max(48px,env(safe-area-inset-bottom))] md:px-margin-desktop md:py-section">
        {children}
      </main>
    </div>
  );
}
