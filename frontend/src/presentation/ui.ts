/** Shared class strings, same vocabulary as home-budget (components/ui.ts). */

export const buttonPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-sm rounded-full bg-ink px-xl font-button-md text-button-md text-on-primary transition-opacity [@media(hover:hover)]:hover:[&:not(:disabled)]:opacity-85 disabled:opacity-40';

/** Low-emphasis row action ("History"). */
export const actionLink =
  'inline-flex min-h-[44px] items-center px-sm font-label-caps text-label-caps uppercase text-mute underline decoration-1 underline-offset-4 hover:text-ink';

/** Destructive row action ("Delete", "Revoke"). */
export const actionDanger =
  'inline-flex min-h-[44px] items-center px-sm font-label-caps text-label-caps uppercase text-error underline decoration-1 underline-offset-4 hover:opacity-80';

export const inputClass =
  'min-h-[44px] w-full min-w-0 rounded border border-hairline bg-canvas px-gutter font-body-md text-body-md text-ink placeholder:text-mute';

/** Dense input inside a table cell (config values). */
export const cellInputClass =
  'min-h-[40px] w-full min-w-[8rem] rounded border border-hairline bg-canvas px-md font-body-md text-body-md text-ink';

export const cardClass =
  'rounded bg-canvas p-gutter shadow-[0_0_0_1px_var(--color-hairline-soft)] md:p-xl';

export const labelClass = 'font-label-caps text-label-caps uppercase text-mute';

export const thClass = `${labelClass} whitespace-nowrap px-md py-sm text-left font-bold first:min-w-[10rem] first:pl-0 last:pr-0`;

export const tdClass =
  'px-md py-md align-top first:min-w-[10rem] first:pl-0 last:pr-0';

export const pillClass =
  'inline-flex items-center rounded-full border px-sm py-xs font-label-caps text-label-caps uppercase';

export const noticeError = 'font-body-sm text-body-sm text-error';
