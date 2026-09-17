import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import { TermBox } from '../../src/ui/TermBox';
import type { CountOutcome } from '../../src/core/types';

const neverCalled = async (): Promise<CountOutcome> => {
  throw new Error('countQuery should not be called');
};

function renderApp() {
  const user = userEvent.setup();
  render(<App countQuery={neverCalled} />);
  const arm = (n: number) => screen.getByRole('group', { name: `Arm ${n}` });
  const input = (n: number) => screen.getByRole('textbox', { name: `New term for arm ${n}` });
  const termTexts = (n: number) =>
    within(arm(n))
      .queryAllByTestId('term')
      .map((el) => el.getAttribute('data-text'));
  return { user, arm, input, termTexts };
}

describe('TermBox interactions (contracts/ui.md)', () => {
  it('Enter commits and quotes a multi-word term, focus stays in the input', async () => {
    const { user, input, termTexts } = renderApp();
    await user.type(input(1), 'heart failure{Enter}');
    expect(termTexts(1)).toEqual(['"heart failure"']);
    expect(input(1)).toHaveValue('');
    expect(input(1)).toHaveFocus();
  });

  it('commits a single word without quotes', async () => {
    const { user, input, termTexts } = renderApp();
    await user.type(input(1), 'diabetes{Enter}');
    expect(termTexts(1)).toEqual(['diabetes']);
  });

  it('Enter on an empty input does nothing', async () => {
    const { user, input, termTexts, arm } = renderApp();
    await user.click(input(1));
    await user.keyboard('{Enter}');
    await user.type(input(1), '   {Enter}');
    expect(termTexts(1)).toEqual([]);
    expect(within(arm(1)).queryByText('OR')).toBeNull();
  });

  it('shows OR between terms and before the input, not focusable', async () => {
    const { user, input, arm } = renderApp();
    await user.type(input(1), 'a{Enter}b{Enter}');
    const ors = within(arm(1)).getAllByText('OR');
    expect(ors).toHaveLength(2);
    for (const or of ors) {
      expect(or.tagName).not.toBe('BUTTON');
      expect(or).not.toHaveAttribute('tabindex');
    }
  });

  it('clicking a quotation mark removes the quotes without entering edit mode', async () => {
    const { user, input, arm, termTexts } = renderApp();
    await user.type(input(1), 'cardiac failure{Enter}');
    const quoteButtons = within(arm(1)).getAllByRole('button', { name: 'Remove quotes' });
    expect(quoteButtons).toHaveLength(2);
    await user.click(quoteButtons[1] as HTMLElement);
    expect(termTexts(1)).toEqual(['cardiac failure']);
    expect(within(arm(1)).queryByRole('textbox', { name: /Edit term/ })).toBeNull();
    expect(within(arm(1)).queryByRole('button', { name: 'Remove quotes' })).toBeNull();
  });

  it('clicking the text enters edit mode and Enter re-applies the rule', async () => {
    const { user, input, arm, termTexts } = renderApp();
    await user.type(input(1), 'cardiac failure{Enter}');
    await user.click(
      within(arm(1)).getAllByRole('button', { name: 'Remove quotes' })[0] as HTMLElement,
    );
    await user.click(within(arm(1)).getByRole('button', { name: 'cardiac failure' }));
    const edit = within(arm(1)).getByRole('textbox', { name: 'Edit term cardiac failure' });
    expect(edit).toHaveFocus();
    expect(edit).toHaveValue('cardiac failure');
    await user.keyboard('{Enter}');
    expect(termTexts(1)).toEqual(['"cardiac failure"']);

    await user.click(within(arm(1)).getByRole('button', { name: 'cardiac failure' }));
    const edit2 = within(arm(1)).getByRole('textbox', { name: /Edit term/ });
    await user.clear(edit2);
    await user.type(edit2, 'heart{Enter}');
    expect(termTexts(1)).toEqual(['heart']);
  });

  it('an empty edit removes the term', async () => {
    const { user, input, arm, termTexts } = renderApp();
    await user.type(input(1), 'a{Enter}b{Enter}');
    await user.click(within(arm(1)).getByRole('button', { name: 'a' }));
    const edit = within(arm(1)).getByRole('textbox', { name: /Edit term/ });
    await user.clear(edit);
    await user.keyboard('{Enter}');
    expect(termTexts(1)).toEqual(['b']);
    expect(within(arm(1)).getAllByText('OR')).toHaveLength(1);
  });

  it('Escape cancels the edit', async () => {
    const { user, input, arm, termTexts } = renderApp();
    await user.type(input(1), 'diabetes{Enter}');
    await user.click(within(arm(1)).getByRole('button', { name: 'diabetes' }));
    const edit = within(arm(1)).getByRole('textbox', { name: /Edit term/ });
    await user.clear(edit);
    await user.type(edit, 'changed{Escape}');
    expect(termTexts(1)).toEqual(['diabetes']);
    expect(within(arm(1)).queryByRole('textbox', { name: /Edit term/ })).toBeNull();
  });

  it('the remove control removes the term and its OR', async () => {
    const { user, input, arm, termTexts } = renderApp();
    await user.type(input(1), 'a{Enter}b{Enter}');
    const removes = within(arm(1)).getAllByRole('button', { name: 'Remove term' });
    await user.click(removes[0] as HTMLElement);
    expect(termTexts(1)).toEqual(['b']);
    expect(within(arm(1)).getAllByText('OR')).toHaveLength(1);
  });

  it('Backspace in an empty input does nothing', async () => {
    const { user, input, termTexts } = renderApp();
    await user.type(input(1), 'a{Enter}');
    await user.click(input(1));
    await user.keyboard('{Backspace}{Backspace}');
    expect(termTexts(1)).toEqual(['a']);
  });
});

describe('TermBox rendering', () => {
  it('renders the tag after the closing quote and marks invalid terms', () => {
    render(
      <TermBox
        term={{ id: 't1', text: '"heart failure"[tiab]' }}
        invalid
        onUnquote={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      />,
    );
    const box = screen.getByTestId('term');
    expect(box).toHaveTextContent('"heart failure"[tiab]');
    expect(box).toHaveClass('invalid');
    expect(screen.getByRole('button', { name: 'heart failure[tiab]' })).toBeInTheDocument();
  });
});
