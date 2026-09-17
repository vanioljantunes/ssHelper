import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SearchRun } from '../../src/core/types';
import { HistoryTable } from '../../src/ui/HistoryTable';
import { SearchPanel } from '../../src/ui/SearchPanel';

const query = '("Bladder cancer" OR "Bladder neoplasm*") AND (ADC OR DWI)';

const run: SearchRun = {
  id: 'run-1',
  createdAt: '2026-09-16T21:43:00.000Z',
  arms: [{ terms: ['"Bladder cancer"', '"Bladder neoplasm*"'] }, { terms: ['ADC', 'DWI'] }],
  query,
  metaQuery: `${query} AND ("meta-analysis")`,
  result: { status: 'ok', count: 549, queryTranslation: '', warnings: [] },
  metaResult: { status: 'ok', count: 12, queryTranslation: '', warnings: [] },
};

function expectPubmedLink(link: HTMLElement) {
  const href = link.getAttribute('href') ?? '';
  const url = new URL(href);
  expect(url.origin).toBe('https://pubmed.ncbi.nlm.nih.gov');
  expect(url.searchParams.get('term')).toBe(query);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
  expect(link).toHaveAttribute('title', expect.stringMatching(/PubMed/));
}

describe('PubMed links', () => {
  it('history strategy text links to the PubMed search for that exact query', () => {
    render(
      <HistoryTable
        runs={[run]}
        needsLoadConfirmation={false}
        onLoad={vi.fn()}
        onDelete={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expectPubmedLink(screen.getByRole('link', { name: query }));
  });

  it('query preview links to PubMed when there is a query', () => {
    render(
      <SearchPanel
        query={query}
        isEmpty={false}
        hasIssues={false}
        running={false}
        last={null}
        onSearch={vi.fn()}
      />,
    );
    expectPubmedLink(screen.getByRole('link', { name: query }));
    expect(screen.getByTestId('query-preview')).toHaveTextContent(query);
  });

  it('query preview has no link when there is no query', () => {
    render(
      <SearchPanel
        query={null}
        isEmpty
        hasIssues={false}
        running={false}
        last={null}
        onSearch={vi.fn()}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});
