import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ValueEditor } from './ValueEditor';

function setup(value = 'stored', saved = true) {
  const onSave = vi
    .fn<(next: string) => Promise<boolean>>()
    .mockResolvedValue(saved);
  const view = render(
    <ValueEditor label="Max" value={value} onSave={onSave} />,
  );
  const rerender = (next: string) =>
    view.rerender(<ValueEditor label="Max" value={next} onSave={onSave} />);
  return { onSave, rerender, input: screen.getByLabelText('Max') };
}

describe('ValueEditor', () => {
  it('follows a refreshed value while untouched', () => {
    const { rerender, input } = setup();

    rerender('from-server');

    expect(input).toHaveValue('from-server');
  });

  it('keeps the in-progress edit when a refresh lands while typing', async () => {
    const user = userEvent.setup();
    const { rerender, input, onSave } = setup();

    await user.click(input);
    await user.type(input, '-mine');
    rerender('from-server');

    expect(input).toHaveValue('stored-mine');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves the draft on blur, not the refreshed value', async () => {
    const user = userEvent.setup();
    const { rerender, input, onSave } = setup();

    await user.click(input);
    await user.type(input, '-mine');
    rerender('from-server');
    await user.tab();

    expect(onSave).toHaveBeenCalledWith('stored-mine');
  });

  it('takes the refreshed value again once the edit is saved', async () => {
    const user = userEvent.setup();
    const { rerender, input } = setup();

    await user.click(input);
    await user.type(input, '-mine');
    await user.tab();
    rerender('stored-mine');
    rerender('changed-elsewhere');

    expect(input).toHaveValue('changed-elsewhere');
  });

  it('takes the refreshed value again after Escape cancels the edit', async () => {
    const user = userEvent.setup();
    const { rerender, input, onSave } = setup();

    await user.click(input);
    await user.type(input, '-mine');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('stored');
    rerender('from-server');

    expect(input).toHaveValue('from-server');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('puts the stored value back when the save is rejected', async () => {
    const user = userEvent.setup();
    const { input, onSave } = setup('stored', false);

    await user.click(input);
    await user.type(input, '-mine');
    await user.tab();

    expect(onSave).toHaveBeenCalledWith('stored-mine');
    expect(input).toHaveValue('stored');
  });
});
