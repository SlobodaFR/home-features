import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog } from './Dialog';

function Harness({ dismissible }: { dismissible: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Your API key"
      dismissible={dismissible}
    >
      <p>secret-value</p>
      <button type="button" onClick={() => setOpen(false)}>
        Done
      </button>
    </Dialog>
  );
}

function dialogElement(container: HTMLElement): HTMLDialogElement {
  const dialog = container.querySelector('dialog');
  if (!dialog) throw new Error('no dialog');
  return dialog;
}

/** What Chrome does for Escape: a cancelable `cancel`, then a close if nobody prevented it. */
function pressEscape(dialog: HTMLDialogElement) {
  const cancel = new Event('cancel', { cancelable: true });
  act(() => {
    dialog.dispatchEvent(cancel);
    if (!cancel.defaultPrevented) dialog.close();
  });
}

/** The second Escape: the close request is not cancelable and the dialog closes regardless. */
function pressEscapeUncancelable(dialog: HTMLDialogElement) {
  act(() => {
    dialog.dispatchEvent(new Event('cancel'));
    dialog.close();
  });
}

describe('Dialog that is not dismissible', () => {
  it('survives Escape once', () => {
    const { container } = render(<Harness dismissible={false} />);
    const dialog = dialogElement(container);

    pressEscape(dialog);

    expect(dialog.open).toBe(true);
    expect(screen.getByText('secret-value')).toBeInTheDocument();
  });

  it('survives Escape twice, the second one not being cancelable', () => {
    const { container } = render(<Harness dismissible={false} />);
    const dialog = dialogElement(container);

    pressEscape(dialog);
    pressEscapeUncancelable(dialog);

    expect(dialog.open).toBe(true);
    expect(screen.getByText('secret-value')).toBeInTheDocument();
  });

  it('survives a cancel event', () => {
    const { container } = render(<Harness dismissible={false} />);
    const dialog = dialogElement(container);

    const prevented = !fireEvent(
      dialog,
      new Event('cancel', { cancelable: true }),
    );

    expect(prevented).toBe(true);
    expect(dialog.open).toBe(true);
  });

  it('ignores a backdrop click', () => {
    const { container } = render(<Harness dismissible={false} />);
    const dialog = dialogElement(container);

    fireEvent.click(dialog);

    expect(dialog.open).toBe(true);
  });

  it('closes through its own Done button', () => {
    const { container } = render(<Harness dismissible={false} />);
    const dialog = dialogElement(container);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(dialog.open).toBe(false);
    expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
  });
});

describe('Dialog that is dismissible', () => {
  it('closes on Escape', () => {
    const { container } = render(<Harness dismissible />);
    const dialog = dialogElement(container);

    pressEscape(dialog);

    expect(dialog.open).toBe(false);
    expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
  });
});
