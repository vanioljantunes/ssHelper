import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ImportStrategy } from '../../src/ui/ImportStrategy';

const pasted =
  '("Bladder cancer" OR "Urothelial carcinoma")\nAND\n(ADC OR "Diffusion weighted imaging")';

function setup(needsConfirmation = false) {
  const onImport = vi.fn();
  const user = userEvent.setup();
  render(<ImportStrategy needsConfirmation={needsConfirmation} onImport={onImport} />);
  const box = screen.getByRole('textbox', { name: /paste a search strategy/i });
  const button = screen.getByRole('button', { name: /fill arms/i });
  return { onImport, user, box, button };
}

describe('ImportStrategy', () => {
  it('starts empty with the button disabled', () => {
    const { box, button } = setup();
    expect(box).toHaveValue('');
    expect(button).toBeDisabled();
  });

  it('fills arms from a pasted strategy and clears the box', async () => {
    const { onImport, user, box, button } = setup();
    await user.click(box);
    await user.paste(pasted);
    await user.click(button);
    expect(onImport).toHaveBeenCalledWith([
      ['"Bladder cancer"', '"Urothelial carcinoma"'],
      ['ADC', '"Diffusion weighted imaging"'],
    ]);
    expect(box).toHaveValue('');
    expect(screen.getByText('Filled 2 arms with 4 terms.')).toHaveAttribute('aria-live', 'polite');
  });

  it('shows an error and imports nothing when the strategy is not supported', async () => {
    const { onImport, user, box, button } = setup();
    await user.click(box);
    await user.paste('(a OR (b AND c)) AND d');
    await user.click(button);
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/groups inside groups/i);
    expect(box).toHaveValue('(a OR (b AND c)) AND d');
  });

  it('warns about every discouraged part before importing the rest', async () => {
    const { onImport, user, box, button } = setup();
    await user.click(box);
    await user.paste('#1 AND (a OR b) AND english[lang] AND 2015:2020[pdat] NOT review[pt]');
    await user.click(button);

    expect(onImport).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/not advised/i);
    expect(dialog).toHaveTextContent(/NOT review\[pt\]/);
    expect(dialog).toHaveTextContent(/english\[lang\]/);
    expect(dialog).toHaveTextContent(/2015:2020\[pdat\]/);
    expect(dialog).toHaveTextContent(/#1/);

    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onImport).toHaveBeenCalledWith([['a', 'b']]);
    expect(screen.getByText(/Dropped 4 parts\./)).toBeInTheDocument();
    expect(box).toHaveValue('');
  });

  it('keeps the paste and the arms when the warning is cancelled', async () => {
    const { onImport, user, box, button } = setup();
    const pastedWithNot = '(a OR b) AND c NOT review[pt]';
    await user.click(box);
    await user.paste(pastedWithNot);
    await user.click(button);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onImport).not.toHaveBeenCalled();
    expect(box).toHaveValue(pastedWithNot);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('warns about the replacement and the dropped parts in the same dialog', async () => {
    const { onImport, user, box, button } = setup(true);
    await user.click(box);
    await user.paste('(a OR b) AND c NOT review[pt]');
    await user.click(button);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/not advised/i);
    expect(dialog).toHaveTextContent(/current terms will be lost/i);
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onImport).toHaveBeenCalledWith([['a', 'b'], ['c']]);
  });

  it('refuses the import when every part would be dropped', async () => {
    const { onImport, user, box, button } = setup();
    await user.click(box);
    await user.paste('#1 AND #2');
    await user.click(button);
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing is left to import/i);
  });

  it('asks for confirmation before replacing existing terms', async () => {
    const { onImport, user, box, button } = setup(true);
    await user.click(box);
    await user.paste(pasted);
    await user.click(button);
    expect(onImport).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onImport).not.toHaveBeenCalled();
    expect(box).toHaveValue(pasted);

    await user.click(screen.getByRole('button', { name: /fill arms/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });
});
