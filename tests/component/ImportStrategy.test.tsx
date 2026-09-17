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
    await user.paste('a NOT b');
    await user.click(button);
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/NOT is not supported/i);
    expect(box).toHaveValue('a NOT b');
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
