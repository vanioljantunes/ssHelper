import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PriorRecord } from '../../src/core/prior';
import { pmcUrl, pubmedArticleUrl } from '../../src/pubmed/links';
import { PriorPanel, type PriorState } from '../../src/ui/PriorPanel';

const records: PriorRecord[] = [
  {
    pmid: '42498088',
    author: 'Hassanpour H',
    year: 2027,
    title: 'Impact of lamiaceae plants on anthropometric indices',
    pmcid: null,
  },
  {
    pmid: '42812849',
    author: 'Fidah MFA',
    year: 2026,
    title: 'Willingness-to-pay for health insurance',
    pmcid: 'PMC13620861',
  },
];

const years = [2026, 2025, 2024, 2023, 2022, 2021];

function renderPanel(over: Partial<React.ComponentProps<typeof PriorPanel>> = {}) {
  const onMinYearChange = vi.fn();
  render(
    <PriorPanel
      headingId="prior-heading"
      state={{ status: 'ready', records, total: records.length }}
      count={97}
      minYear={2021}
      years={years}
      onMinYearChange={onMinYearChange}
      {...over}
    />,
  );
  return { onMinYearChange };
}

describe('PriorPanel', () => {
  it('shows the count on the heading row', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /prior meta-analyses/i })).toBeInTheDocument();
    expect(screen.getByTestId('prior-count')).toHaveTextContent('97');
  });

  it('names each row "Author, Year" without the initials', () => {
    renderPanel();
    const rows = screen.getAllByTestId('prior-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Hassanpour, 2027');
    expect(rows[1]).toHaveTextContent('Fidah, 2026');
  });

  it('links the PubMed page, and the free full text only when there is a PMC id', () => {
    renderPanel();
    const [first, second] = screen.getAllByTestId('prior-row');
    expect(within(first!).getByRole('link', { name: /pubmed/i })).toHaveAttribute(
      'href',
      pubmedArticleUrl('42498088'),
    );
    expect(within(first!).queryByRole('link', { name: /free full text/i })).toBeNull();
    expect(within(first!).getByTestId('prior-pmc-disabled')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(within(second!).getByRole('link', { name: /free full text/i })).toHaveAttribute(
      'href',
      pmcUrl('PMC13620861'),
    );
  });

  it('starts on the given minimum year and reports a change', async () => {
    const user = userEvent.setup();
    const { onMinYearChange } = renderPanel();
    const select = screen.getByLabelText(/from year/i);
    expect(select).toHaveValue('2021');

    await user.selectOptions(select, '2024');
    expect(onMinYearChange).toHaveBeenCalledWith(2024);

    await user.selectOptions(select, 'all');
    expect(onMinYearChange).toHaveBeenLastCalledWith(null);
  });

  it('shows no year on the filter when none is set', () => {
    renderPanel({ minYear: null });
    expect(screen.getByLabelText(/from year/i)).toHaveValue('all');
  });

  it('reports an empty result against the chosen year', () => {
    renderPanel({ state: { status: 'ready', records: [], total: 0 }, minYear: 2022 });
    expect(screen.getByText(/no meta-analysis from 2022 onwards/i)).toBeInTheDocument();
  });

  it('says how many of the total are shown when PubMed holds more', () => {
    renderPanel({ state: { status: 'ready', records, total: 140 } });
    expect(screen.getByTestId('prior-truncated')).toHaveTextContent(
      'Showing the 2 most recent of 140.',
    );
  });

  it('asks for a run before anything is listed, and reports a failure', () => {
    const { rerender } = render(
      <PriorPanel
        headingId="prior-heading"
        state={{ status: 'idle' }}
        count={null}
        minYear={null}
        years={years}
        onMinYearChange={() => undefined}
      />,
    );
    expect(screen.getByText(/run the search to list the meta-analyses/i)).toBeInTheDocument();
    expect(screen.queryByTestId('prior-count')).toBeNull();

    const failed: PriorState = { status: 'error', message: 'Could not reach PubMed.' };
    rerender(
      <PriorPanel
        headingId="prior-heading"
        state={failed}
        count={null}
        minYear={null}
        years={years}
        onMinYearChange={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach PubMed.');
  });

  it('keeps the filter usable while a load is running', () => {
    function Harness() {
      const [minYear, setMinYear] = useState<number | null>(2021);
      return (
        <PriorPanel
          headingId="prior-heading"
          state={{ status: 'loading' }}
          count={97}
          minYear={minYear}
          years={years}
          onMinYearChange={setMinYear}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByText(/loading meta-analyses/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/from year/i)).toBeEnabled();
  });
});
