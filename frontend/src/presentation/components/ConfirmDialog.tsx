import { useState } from 'react';
import { Dialog } from './Dialog';
import {
  buttonDanger,
  buttonSecondary,
  inputClass,
  labelClass,
  noticeError,
} from '../ui';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /** When set, the confirm button stays disabled until this exact text is typed. */
  typeToConfirm?: string;
  /** Rejecting keeps the dialog open and shows the message. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** In-app replacement for window.confirm / window.prompt on destructive actions. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
    >
      {props.open && <ConfirmBody {...props} />}
    </Dialog>
  );
}

function ConfirmBody({
  confirmLabel,
  typeToConfirm,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typeToConfirm === undefined || typed === typeToConfirm;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy) void confirm();
      }}
      className="flex flex-col gap-md"
    >
      {typeToConfirm !== undefined && (
        <label className="flex flex-col gap-xs">
          <span className={labelClass}>
            Type <span className="font-mono normal-case">{typeToConfirm}</span>{' '}
            to confirm
          </span>
          <input
            className={inputClass}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
      )}
      {error && (
        <p role="alert" className={noticeError}>
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-sm sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={buttonSecondary}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!ready || busy}
          className={buttonDanger}
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}
