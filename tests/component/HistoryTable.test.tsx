import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SearchRun } from '../../src/core/types';
import { HistoryTable, formatRunDate } from '../../src/ui/HistoryTable';

const newer: SearchRun = {
  id: 'run-2',
  createdAt: '2026-09-16T17:05:42.000Z',
  arms: [{ terms: ['"heart failure"'] }, { terms: [] }, { terms: ['"sglt2 inhibitors"'] }],
  query: '("heart failure") AND ("sglt2 inhibitors")',
  metaQuery: '("heart failure") AND ("sglt2 inhibitors") AND ("meta-analysis")',
  result: { status: 'ok', count: 2014896, queryTranslation: 'x', warnings: [] },
  metaResult: {
    status: 'error',
    kind: 'rate_limited',
    message: 'PubMed is busy. Try again shortly.',
  },
};

const older: SearchRun = {
  ...newer,
  id: 'run-1',
  createdAt: '2026-09-15T08:00:00.000Z',
  query: '(diabetes)',
  metaQuery: '(diabetes) AND ("meta-analysis")',
  result: { status: 'ok', count: 0, queryTranslation: 'x', warnings: [] },
  metaResult: { status: 'ok', count: 12, queryTranslation: 'x', warnings: [] },
};

function setup(overrides: Partial<Parameters<typeof HistoryTable>[0]> = {}) {
  const user = userEvent.setup();
  const props = {
    runs: [newer, older],
    needsLoadConfirmation: false,
    onLoad: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
    copyText: vi.fn(async (text: string) => {
      void text;
    }),
    ...overrides,
  };
  render(<HistoryTable {...props} />);
  const rows = () => screen.getAllByRole('row').slice(1);
  return { user, props, rows };
}

describe('HistoryTable (contracts/ui.md)', () => {
  it('shows the columns in order', () => {
    setup();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Date and time',
      'Search strategy',
      'Results',
      'Results + meta-analysis',
      'Known studies',
      'Actions',
    ]);
  });

  it('shows local date and time to the minute', () => {
    const { rows } = setup();
    const expected = formatRunDate(newer.createdAt);
    expect(expected).toBe(
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(newer.createdAt)),
    );
    const cells = within(rows()[0] as HTMLElement).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent(expected);
    expect(cells[0]?.textContent).not.toContain('42');
    expect(
      within(cells[0] as HTMLElement)
        .getByText(expected)
        .closest('time'),
    ).toHaveAttribute('datetime', newer.createdAt);
  });

  it('shows the full strategy text and formatted counts, in the given order', () => {
    const { rows } = setup();
    const first = within(rows()[0] as HTMLElement).getAllByRole('cell');
    expect(first[1]).toHaveTextContent(newer.query);
    expect(first[2]?.textContent).toBe(new Intl.NumberFormat().format(2014896));
    const second = within(rows()[1] as HTMLElement).getAllByRole('cell');
    expect(second[1]).toHaveTextContent('(diabetes)');
    expect(second[2]?.textContent).toBe('0');
    expect(second[3]?.textContent).toBe('12');
  });

  it('shows Error with the reason as accessible description, never a number', () => {
    const { rows } = setup();
    const cell = within(rows()[0] as HTMLElement).getAllByRole('cell')[3] as HTMLElement;
    const error = within(cell).getByText('Error');
    expect(error).toHaveAccessibleDescription('PubMed is busy. Try again shortly.');
    expect(error).toHaveAttribute('title', 'PubMed is busy. Try again shortly.');
    expect(cell.textContent).not.toMatch(/\d/);
  });

  it('Copy writes the query and shows Copied', async () => {
    const { user, props, rows } = setup();
    await user.click(within(rows()[1] as HTMLElement).getByRole('button', { name: 'Copy' }));
    expect(props.copyText).toHaveBeenCalledWith('(diabetes)');
    expect(
      await within(rows()[1] as HTMLElement).findByRole('button', { name: 'Copied' }),
    ).toBeInTheDocument();
  });

  it('Copy uses navigator.clipboard by default', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    render(
      <HistoryTable
        runs={[older]}
        needsLoadConfirmation={false}
        onLoad={() => {}}
        onDelete={() => {}}
        onClear={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('(diabetes)');
    expect(await navigator.clipboard.readText()).toBe('(diabetes)');
  });

  it('Load calls the handler with the run', async () => {
    const { user, props, rows } = setup();
    await user.click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Load' }));
    expect(props.onLoad).toHaveBeenCalledWith(newer);
  });

  it('Load asks for confirmation when the current draft has terms', async () => {
    const { user, props, rows } = setup({ needsLoadConfirmation: true });
    await user.click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Load' }));
    expect(props.onLoad).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Replace the current arms with this search?');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(props.onLoad).not.toHaveBeenCalled();
    await user.click(within(rows()[0] as HTMLElement).getByRole('button', { name: 'Load' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }),
    );
    expect(props.onLoad).toHaveBeenCalledWith(newer);
  });

  it('Delete removes that row through the handler', async () => {
    const { user, props, rows } = setup();
    await user.click(within(rows()[1] as HTMLElement).getByRole('button', { name: 'Delete' }));
    expect(props.onDelete).toHaveBeenCalledWith('run-1');
  });

  it('Clear history requires confirmation', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(props.onClear).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete all history rows? This cannot be undone.');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows the empty state', () => {
    setup({ runs: [] });
    expect(screen.getByText('No searches yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear history' })).toBeNull();
  });
});
describe('App history wiring (T038)', () => {
  it('shows a warning when history cannot be saved', async () => {
    const user = userEvent.setup();
    const { App } = await import('../../src/ui/App');
    const historyStore = {
      list: () => [],
      add: () => ({ ok: false as const, reason: 'quota' as const }),
      attachStudies: () => ({ ok: true as const }),
      remove: () => ({ ok: true as const }),
      clear: () => ({ ok: true as const }),
    };
    render(
      <App
        historyStore={historyStore}
        countQuery={async () => ({ status: 'ok', count: 1, queryTranslation: '', warnings: [] })}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'New term for arm 1' }), 'diabetes{Enter}');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByText('History could not be saved in this browser.'),
    ).toBeInTheDocument();
  });

  it('adds a row after a search and restores the draft on remount', async () => {
    const user = userEvent.setup();
    const { App } = await import('../../src/ui/App');
    const countQuery = async () => ({
      status: 'ok' as const,
      count: 7,
      queryTranslation: '',
      warnings: [],
    });
    const { unmount } = render(<App countQuery={countQuery} />);
    await user.type(
      screen.getByRole('textbox', { name: 'New term for arm 2' }),
      'heart failure{Enter}',
    );
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('cell', { name: '("heart failure")' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'New term for arm 3' }), 'pending text');
    unmount();

    render(<App countQuery={countQuery} />);
    expect(screen.getByRole('cell', { name: '("heart failure")' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Arm 2' })).toHaveTextContent('"heart failure"');
    expect(screen.getByRole('textbox', { name: 'New term for arm 3' })).toHaveValue('pending text');
  });
});

describe('known studies column (FR-030)', () => {
  it('shows a check when every study was found, and the names when some were not', () => {
    const allFound: SearchRun = {
      ...newer,
      id: 'all-found',
      studies: { total: 3, found: 3, notFound: [], unresolved: [] },
    };
    const missing: SearchRun = {
      ...older,
      id: 'missing',
      studies: { total: 3, found: 1, notFound: ['Brown, 2019'], unresolved: ['Chen, 2020'] },
    };
    const none: SearchRun = { ...older, id: 'no-studies' };
    setup({ runs: [allFound, missing, none] });

    expect(screen.getByRole('columnheader', { name: 'Known studies' })).toBeInTheDocument();
    const cell = (id: string) => screen.getByTestId(`history-studies-${id}`);
    expect(cell('all-found')).toHaveTextContent('All 3 studies found');
    expect(cell('missing')).toHaveTextContent('Not found: Brown, 2019');
    expect(cell('missing')).toHaveTextContent('Unresolved: Chen, 2020');
    expect(cell('no-studies')).toHaveTextContent('No studies checked');
  });
});

