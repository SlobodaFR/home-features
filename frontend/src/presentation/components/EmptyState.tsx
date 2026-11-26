import { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-md rounded bg-canvas p-xl shadow-[0_0_0_1px_var(--color-hairline-soft)]">
      <h2 className="font-heading-md text-heading-md text-ink">{title}</h2>
      <p className="max-w-prose font-body-md text-body-md text-mute">{body}</p>
      {action}
    </div>
  );
}
