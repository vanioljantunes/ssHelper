import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import type { CountOutcome } from '../../src/core/types';

const ok = (count: number, warnings: string[] = []): CountOutcome => ({
  status: 'ok',
  count,
  queryTranslation: 't',
  warnings,
});

function renderApp(countQuery: (query: string) => Promise<CountOutcome> = async () => ok(1)) {
  const user = userEvent.setup();
  const spy = vi.fn(countQuery);
  render(<App countQuery={spy} />);
  const arms = () => screen.getAllByRole('group', { name: /^Arm \d+$/ });
  const input = (n: number) => screen.getByRole('textbox', { name: `New term for arm ${n}` });
  const searchButton = () => screen.getByRole('button', { name: /^Search/ });
  return { user, spy, arms, input, searchButton };
}

describe('Arms editor (contracts/ui.md)', () => {
  it('shows 3 arms and 2 AND labels on load', () => {
    const { arms } = renderApp();
    expect(arms()).toHaveLength(3);
    expect(screen.getAllByText('AND')).toHaveLength(2);
    for (const and of screen.getAllByText('AND')) {
      expect(and.tagName).not.toBe('BUTTON');
      expect(and).not.toHaveAttribute('tabindex');
    }
  });

  it('Add arm appends an empty arm with an AND before it', async () => {
    const { user, arms } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Add arm' }));
    expect(arms()).toHaveLength(4);
    expect(screen.getAllByText('AND')).toHaveLength(3);
    expect(screen.getByRole('group', { name: 'Arm 4' })).toBeInTheDocument();
  });

  it('deleting the middle arm keeps the terms and one AND per gap', async () => {
    const { user, arms, input } = renderApp();
    await user.type(input(1), 'a{Enter}');
    await user.type(input(2), 'b{Enter}');
    await user.type(input(3), 'c{Enter}');
    await user.click(screen.getByRole('button', { name: 'Delete arm 2' }));
    expect(arms()).toHaveLength(2);
    expect(screen.getAllByText('AND')).toHaveLength(1);
    expect(within(arms()[0] as HTMLElement).getByTestId('term')).toHaveAttribute('data-text', 'a');
    expect(within(arms()[1] as HTMLElement).getByTestId('term')).toHaveAttribute('data-text', 'c');
    expect(screen.getByTestId('query-preview')).toHaveTextContent('(a) AND (c)');
  });

  it('deleting the only arm leaves one empty arm', async () => {
    const { user, arms } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Delete arm 3' }));
    await user.click(screen.getByRole('button', { name: 'Delete arm 2' }));
    await user.click(screen.getByRole('button', { name: 'Delete arm 1' }));
    expect(arms()).toHaveLength(1);
    expect(screen.queryByText('AND')).toBeNull();
  });
});

describe('Search panel (contracts/ui.md)', () => {
  it('disables Search with a hint when all arms are empty', () => {
    const { searchButton } = renderApp();
    expect(searchButton()).toBeDisabled();
    expect(screen.getByText('Add at least one term.')).toBeInTheDocument();
  });

  it('shows the FR-017 run-time notice', () => {
    renderApp();
    expect(screen.getByText(/Counts come from PubMed at the time of the run/)).toBeInTheDocument();
  });

  it('marks (heart as invalid and disables Search (FR-020, T047)', async () => {
    const { user, input, searchButton } = renderApp();
    await user.type(input(1), '(heart{Enter}');
    expect(screen.getByTestId('term')).toHaveClass('invalid');
    expect(screen.getByText('Term (heart has unbalanced parentheses.')).toBeInTheDocument();
    expect(searchButton()).toBeDisabled();
  });

  it('marks "heart failure as invalid and disables Search (FR-020, T047)', async () => {
    const { user, input, searchButton } = renderApp();
    await user.type(input(2), '"heart failure{Enter}');
    expect(screen.getByTestId('term')).toHaveClass('invalid');
    expect(
      screen.getByText('Term "heart failure has an odd number of quotation marks.'),
    ).toBeInTheDocument();
    expect(searchButton()).toBeDisabled();
  });

  it('enables Search once the invalid term is removed', async () => {
    const { user, input, searchButton } = renderApp();
    await user.type(input(1), '(heart{Enter}diabetes{Enter}');
    expect(searchButton()).toBeDisabled();
    await user.click(screen.getAllByRole('button', { name: 'Remove term' })[0] as HTMLElement);
    expect(searchButton()).toBeEnabled();
  });

  it('shows the live query preview including pending text', async () => {
    const { user, input } = renderApp();
    await user.type(input(1), 'heart failure{Enter}cardiac failure{Enter}');
    await user.type(input(3), 'sglt2 inhibitors');
    expect(screen.getByTestId('query-preview')).toHaveTextContent(
      '("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")',
    );
  });

  it('auto-commits pending text on Search and sends both queries', async () => {
    const { user, input, spy, searchButton } = renderApp(async (q) =>
      q.includes('meta-analysis') ? ok(12) : ok(1234),
    );
    await user.type(input(1), 'heart failure{Enter}cardiac failure{Enter}');
    await user.type(input(3), 'diabetes{Enter}sglt2 inhibitors');
    await user.click(searchButton());

    const arm3 = screen.getByRole('group', { name: 'Arm 3' });
    expect(
      within(arm3)
        .getAllByTestId('term')
        .map((t) => t.getAttribute('data-text')),
    ).toEqual(['diabetes', '"sglt2 inhibitors"']);
    expect(input(3)).toHaveValue('');
    const results = await screen.findByTestId('search-results');
    expect(spy.mock.calls.map((c) => c[0])).toEqual([
      '("heart failure" OR "cardiac failure") AND (diabetes OR "sglt2 inhibitors")',
      '("heart failure" OR "cardiac failure") AND (diabetes OR "sglt2 inhibitors") AND ("meta-analysis")',
    ]);
    expect(within(results).getByTestId('result-count').textContent).toBe(
      new Intl.NumberFormat().format(1234),
    );
    expect(within(results).getByTestId('meta-result-count')).toHaveTextContent('12');
  });

  it('shows the loading state and blocks a duplicate run', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { user, input, spy, searchButton } = renderApp(async () => {
      await gate;
      return ok(5);
    });
    await user.type(input(1), 'diabetes{Enter}');
    await user.click(searchButton());
    expect(await screen.findAllByText('Searching PubMed...')).not.toHaveLength(0);
    expect(searchButton()).toBeDisabled();
    await user.click(searchButton());
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await screen.findByTestId('search-results');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(searchButton()).toBeEnabled();
  });

  it('formats large counts with thousands separators', async () => {
    const { user, input, searchButton } = renderApp(async () => ok(2014896));
    await user.type(input(1), 'heart{Enter}');
    await user.click(searchButton());
    const results = await screen.findByTestId('search-results');
    const text = within(results).getByTestId('result-count').textContent ?? '';
    expect(text).toBe(new Intl.NumberFormat().format(2014896));
    expect(text).not.toBe('2014896');
  });

  it('shows Error and the reason for a failed count, never a number', async () => {
    const { user, input, searchButton } = renderApp(async (q) =>
      q.includes('meta-analysis')
        ? { status: 'error', kind: 'rate_limited', message: 'PubMed is busy. Try again shortly.' }
        : ok(0),
    );
    await user.type(input(1), 'zzqx{Enter}');
    await user.click(searchButton());
    const results = await screen.findByTestId('search-results');
    expect(within(results).getByTestId('result-count')).toHaveTextContent('0');
    const meta = within(results).getByTestId('meta-result-count');
    expect(meta).toHaveTextContent('Error');
    expect(meta).not.toHaveTextContent(/\d/);
    expect(within(results).getByText('PubMed is busy. Try again shortly.')).toBeInTheDocument();
  });

  it('shows a message and no counts when both requests fail', async () => {
    const { user, input, searchButton } = renderApp(async () => ({
      status: 'error',
      kind: 'network',
      message: 'Could not reach PubMed. Check your connection and try again.',
    }));
    await user.type(input(1), 'diabetes{Enter}');
    await user.click(searchButton());
    expect(
      await screen.findByText('Both PubMed requests failed. No history row was saved.'),
    ).toBeInTheDocument();
    const results = screen.getByTestId('search-results');
    expect(within(results).getByTestId('result-count')).toHaveTextContent('Error');
    expect(within(results).getByTestId('meta-result-count')).toHaveTextContent('Error');
  });

  it('lists PubMed warnings', async () => {
    const { user, input, searchButton } = renderApp(async () => ok(0, ['"zzqx qq"']));
    await user.type(input(1), 'zzqx qq{Enter}');
    await user.click(searchButton());
    await screen.findByTestId('search-results');
    expect(screen.getByText('PubMed warnings')).toBeInTheDocument();
    expect(screen.getByText('"zzqx qq"')).toBeInTheDocument();
  });

  it('announces results in the polite live region', async () => {
    const { user, input, searchButton } = renderApp(async (q) =>
      q.includes('meta-analysis') ? ok(3) : ok(40),
    );
    await user.type(input(1), 'diabetes{Enter}');
    await user.click(searchButton());
    await screen.findByTestId('search-results');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Search finished. Results: 40. Results + meta-analysis: 3.',
    );
  });
});
