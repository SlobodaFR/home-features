import { useEffect, useId, useRef, useState } from 'react';
import { MoreIcon } from './Icons';
import { iconButton } from '../ui';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** "More actions" disclosure: a labelled icon button opening a short list of actions. */
export function MenuButton({
  label,
  items,
}: {
  label: string;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`${iconButton} text-mute`}
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-20 mt-xs w-48 rounded bg-canvas p-sm shadow-[0_0_0_1px_var(--color-hairline)]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                // Hand focus back to the trigger first: a dialog opened by the action
                // records it as the element to restore on close.
                buttonRef.current?.focus();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex min-h-[44px] w-full items-center rounded px-md text-left font-button-md text-button-md hover:bg-soft-cloud ${
                item.danger ? 'text-error' : 'text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
