import { ReactNode, useEffect, useId, useRef } from 'react';
import { CloseIcon } from './Icons';
import { iconButton } from '../ui';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /**
   * false: only the dialog's own buttons close it (no backdrop click, no Escape, whether
   * pressed once, twice or as a `cancel` event): the parent flips `open` itself.
   */
  dismissible?: boolean;
}

/**
 * Modal built on the native <dialog>: focus trap, Escape and inert background come from the
 * browser. A bottom sheet below 640px, a centered card above.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first control (Close); prefer the marked field.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        // Escape pressed twice (or any UA close path that ignores preventDefault on `cancel`)
        // closes the native dialog anyway: reopen it, the parent still considers it open.
        if (!dismissible && open) {
          ref.current?.showModal();
          return;
        }
        onClose();
      }}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t bg-canvas p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded"
    >
      {open && (
        <div className="p-gutter pb-[max(16px,env(safe-area-inset-bottom))] sm:p-xl">
          <div className="mb-md flex items-start justify-between gap-md">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-heading-md text-heading-md text-ink"
              >
                {title}
              </h2>
              {description && (
                <p
                  id={descriptionId}
                  className="font-body-sm text-body-sm text-mute"
                >
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={`${iconButton} -mr-sm -mt-sm`}
              >
                <CloseIcon />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
