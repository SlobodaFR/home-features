/** Shared class strings, same vocabulary as home-budget (components/ui.ts). */

export const buttonPrimary =
  'inline-flex min-h-[44px] items-center justify-center gap-sm rounded-full bg-ink px-xl font-button-md text-button-md text-on-primary transition-opacity [@media(hover:hover)]:hover:[&:not(:disabled)]:opacity-85 disabled:opacity-40';

export const buttonSecondary =
  'inline-flex min-h-[44px] items-center justify-center gap-sm rounded-full border border-hairline bg-transparent px-xl font-button-md text-button-md text-ink transition-colors [@media(hover:hover)]:hover:bg-soft-cloud disabled:opacity-40';

/** Confirm button of a destructive dialog. */
export const buttonDanger =
  'inline-flex min-h-[44px] items-center justify-center gap-sm rounded-full bg-error px-xl font-button-md text-button-md text-on-primary transition-opacity [@media(hover:hover)]:hover:[&:not(:disabled)]:opacity-85 disabled:opacity-40';

/** Round 44px icon-only button. */
export const iconButton =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors [@media(hover:hover)]:hover:bg-soft-cloud';

export const inputClass =
  'min-h-[44px] w-full min-w-0 rounded border border-hairline bg-canvas px-gutter font-body-md text-body-md text-ink placeholder:text-mute';

/** Dense input inside a table cell (config values). */
export const cellInputClass =
  'min-h-[44px] w-full min-w-[8rem] md:min-h-[40px] rounded border border-hairline bg-canvas px-md font-body-md text-body-md text-ink';

export const cardClass =
  'rounded bg-canvas p-gutter shadow-[0_0_0_1px_var(--color-hairline-soft)] md:p-xl';

export const labelClass = 'font-label-caps text-label-caps uppercase text-mute';

export const pillClass =
  'inline-flex items-center whitespace-nowrap rounded-full border px-sm py-xs font-label-caps text-label-caps uppercase';

export const noticeError = 'font-body-sm text-body-sm text-error';
