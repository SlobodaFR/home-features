interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; always present, shown or not. */
  label: string;
  /** A change is in flight: further changes are ignored (focus is kept, unlike `disabled`). */
  busy?: boolean;
  /** Accessible name when the visible label lacks context (e.g. "<flag> in <environment>"). */
  accessibleName?: string;
  /** Show the label text beside the switch (row layout) instead of hiding it visually. */
  showLabel?: boolean;
  /** With showLabel: keep the label visible on small screens only (a column header takes over). */
  labelHiddenFromMd?: boolean;
}

/** A labelled switch: still a native checkbox (keyboard, screen readers), styled by .toggle. */
export function Switch({
  checked,
  onChange,
  label,
  busy = false,
  accessibleName,
  showLabel = false,
  labelHiddenFromMd = false,
}: SwitchProps) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-center gap-md ${
        showLabel ? 'justify-between' : ''
      }`}
    >
      <span
        className={
          showLabel
            ? `font-body-md text-body-md text-ink ${labelHiddenFromMd ? 'md:sr-only' : ''}`
            : 'sr-only'
        }
      >
        {label}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="toggle"
        checked={checked}
        aria-label={accessibleName}
        aria-busy={busy || undefined}
        onChange={(event) => {
          if (!busy) onChange(event.target.checked);
        }}
      />
    </label>
  );
}
