import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MAX_PROMPT_CONCEPTS } from '../../src/core/prompt';
import { VERA_HEALTH_URL } from '../../src/i18n/en';
import { PromptPanel } from '../../src/ui/PromptPanel';

function renderPanel() {
  const copyText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  const onGoPaste = vi.fn();
  render(<PromptPanel copyText={copyText} onGoPaste={onGoPaste} />);
  return { copyText, onGoPaste, user: userEvent.setup() };
}

describe('PromptPanel', () => {
  it('starts with two concept boxes and no prompt to copy', () => {
    renderPanel();
    expect(screen.getByRole('textbox', { name: 'Concept 1' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Concept 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeDisabled();
    expect(screen.getByText(/write at least one concept/i)).toBeInTheDocument();
  });

  it('builds the prompt from the concepts and copies it', async () => {
    const { copyText, user } = renderPanel();
    await user.type(screen.getByRole('textbox', { name: 'Concept 1' }), 'sepsis');
    await user.type(screen.getByRole('textbox', { name: 'Concept 2' }), 'procalcitonin');
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }));
    expect(copyText).toHaveBeenCalledTimes(1);
    const prompt = copyText.mock.calls[0]?.[0] ?? '';
    expect(prompt).toContain('() AND ()');
    expect(prompt).toContain('about "sepsis" and the second about "procalcitonin"');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('adds and removes concept boxes up to the limit', async () => {
    const { user } = renderPanel();
    const add = screen.getByRole('button', { name: 'Add concept' });
    for (let i = 2; i < MAX_PROMPT_CONCEPTS; i++) await user.click(add);
    expect(screen.getAllByRole('textbox')).toHaveLength(MAX_PROMPT_CONCEPTS);
    expect(add).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Remove concept 1' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(MAX_PROMPT_CONCEPTS - 1);
  });

  it('links Vera Health in a new tab and hands off to the paste box', async () => {
    const { onGoPaste, user } = renderPanel();
    const link = screen.getByRole('link', { name: /open vera health/i });
    expect(link).toHaveAttribute('href', VERA_HEALTH_URL);
    expect(link).toHaveAttribute('target', '_blank');
    await user.click(screen.getByRole('button', { name: /paste it in search strategy/i }));
    expect(onGoPaste).toHaveBeenCalledTimes(1);
  });
});
