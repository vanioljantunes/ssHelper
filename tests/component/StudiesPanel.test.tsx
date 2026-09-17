import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  addStudy,
  applyAutoLabel,
  createDefaultStudies,
  removeStudy,
  setStudyInput,
  setStudyLabel,
} from '../../src/core/study';
import type { Study } from '../../src/core/types';
import { doiOrgUrl, pubmedDoiUrl } from '../../src/pubmed/links';
import { StudiesPanel, type StudyRowState } from '../../src/ui/StudiesPanel';

const query = '("heart failure")';
const doi = '10.1056/NEJMoa1911303';
const checkedAt = '2026-09-16T10:00:00.000Z';

function Harness({
  initial,
  results = {},
  currentQuery = query,
  onCheck = () => undefined,
}: {
  initial?: Study[];
  results?: Record<string, StudyRowState>;
  currentQuery?: string | null;
  onCheck?: () => void;
}) {
  const [studies, setStudies] = useState<Study[]>(() => initial ?? createDefaultStudies());
  const first = studies[0];
  return (
    <>
      {/* Stands in for a Crossref lookup finishing for the first study's current input. */}
      <button
        type="button"
        onClick={() =>
          first && setStudies((s) => applyAutoLabel(s, first.id, 'Akcay, 2021', first.input))
        }
      >
        auto label
      </button>
      <output data-testid="edited">{studies.map((s) => String(s.labelEdited)).join(',')}</output>
      <StudiesPanel
        studies={studies}
        results={results}
        query={currentQuery}
        canCheck
        checking={false}
        onInputChange={(id, input) => setStudies((s) => setStudyInput(s, id, input))}
        onLabelChange={(id, label) => setStudies((s) => setStudyLabel(s, id, label))}
        onAdd={() => setStudies(addStudy)}
        onRemove={(id) => setStudies((s) => removeStudy(s, id))}
        onCheck={onCheck}
      />
    </>
  );
}

const rows = () => screen.getAllByRole('listitem');

function row(index: number): HTMLElement {
  const found = rows()[index];
  if (!found) throw new Error(`No study row ${index + 1}`);
  return found;
}

function withInputs(inputs: string[]): Study[] {
  return inputs.map((input, index) => ({
    id: `s${index + 1}`,
    input,
    label: '',
    labelEdited: false,
  }));
}

describe('StudiesPanel', () => {
  it('shows 3 empty study boxes by default', () => {
    render(<Harness />);
    expect(rows()).toHaveLength(3);
    for (const n of [1, 2, 3]) {
      expect(screen.getByRole('textbox', { name: `DOI for study ${n}` })).toHaveValue('');
      const name = screen.getByRole('textbox', { name: `Name for study ${n}` });
      expect(name).toHaveValue('');
      expect(name).toHaveAttribute('placeholder', `Study ${n}`);
    }
  });

  it('typing a name marks the label edited; clearing it unlocks it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const name = screen.getByRole('textbox', { name: 'Name for study 1' });
    await user.type(name, 'Custom, 2020');
    expect(name).toHaveValue('Custom, 2020');
    expect(screen.getByTestId('edited')).toHaveTextContent('true,false,false');
    await user.clear(name);
    expect(screen.getByTestId('edited')).toHaveTextContent('false,false,false');
  });

  it('shows an automatic label and never overwrites an edited one', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withInputs([doi])} />);
    const name = screen.getByRole('textbox', { name: 'Name for study 1' });
    await user.click(screen.getByRole('button', { name: 'auto label' }));
    expect(name).toHaveValue('Akcay, 2021');
    expect(screen.getByTestId('edited')).toHaveTextContent('false');

    await user.clear(name);
    await user.type(name, 'Mine');
    await user.click(screen.getByRole('button', { name: 'auto label' }));
    expect(name).toHaveValue('Mine');
    expect(screen.getByTestId('edited')).toHaveTextContent('true');
  });

  it('uses the label in the hidden PubMed link text', () => {
    const initial = [{ id: 's1', input: doi, label: 'Akcay, 2021', labelEdited: false }];
    const results: Record<string, StudyRowState> = {
      s1: { input: doi, check: { status: 'found', doi, query, checkedAt } },
    };
    render(<Harness initial={initial} results={results} />);
    expect(screen.getByRole('link')).toHaveTextContent(
      'PubMed article page for Akcay, 2021 (opens in a new tab)',
    );
  });

  it('adds and removes boxes, keeping at least one', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add study' }));
    expect(rows()).toHaveLength(4);
    for (let i = 0; i < 4; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Remove study 1' }));
    }
    expect(rows()).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'DOI for study 1' })).toBeInTheDocument();
  });

  it('calls onCheck from the Check studies button', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Harness onCheck={onCheck} />);
    await user.click(screen.getByRole('button', { name: 'Check studies' }));
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('shows icon and text for each status', () => {
    const initial = withInputs([doi, doi, doi, 'nope', doi, doi]);
    const results: Record<string, StudyRowState> = {
      s1: { input: doi, check: { status: 'found', doi, query, checkedAt } },
      s2: { input: doi, check: { status: 'not_found', doi, query, checkedAt } },
      s3: { input: doi, check: { status: 'not_in_pubmed', doi, query, checkedAt } },
      s4: { input: 'nope', check: { status: 'invalid', doi: null, query, checkedAt } },
      s5: {
        input: doi,
        check: { status: 'error', doi, query, checkedAt, message: 'PubMed is busy.' },
      },
      s6: { input: doi, check: { status: 'checking', query } },
    };
    render(<Harness initial={initial} results={results} />);
    const [found, notFound, notInPubmed, invalid, error, checking] = [0, 1, 2, 3, 4, 5].map(
      row,
    ) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement];

    expect(found).toHaveAttribute('data-status', 'found');
    expect(found).toHaveTextContent('Found by the strategy');
    expect(within(found).getByTestId('study-icon-check')).toBeInTheDocument();
    expect(within(found).getByRole('link')).toHaveAttribute('href', pubmedDoiUrl(doi));

    expect(notFound).toHaveAttribute('data-status', 'not_found');
    expect(notFound).toHaveTextContent('Not found by the strategy');
    expect(within(notFound).getByTestId('study-icon-x')).toBeInTheDocument();
    expect(within(notFound).getByRole('link')).toHaveAttribute('href', pubmedDoiUrl(doi));

    expect(notInPubmed).toHaveAttribute('data-status', 'not_in_pubmed');
    expect(notInPubmed).toHaveTextContent('DOI not found in PubMed');
    expect(notInPubmed).not.toHaveTextContent('Not found by the strategy');
    expect(within(notInPubmed).getByTestId('study-icon-unknown')).toBeInTheDocument();
    expect(within(notInPubmed).getByRole('link')).toHaveAttribute('href', doiOrgUrl(doi));
    expect(within(notInPubmed).getByRole('link')).toHaveTextContent(/^DOI/);

    expect(invalid).toHaveAttribute('data-status', 'invalid');
    expect(invalid).toHaveTextContent('Not a valid DOI');
    expect(within(invalid).queryByRole('link')).toBeNull();

    expect(error).toHaveAttribute('data-status', 'error');
    expect(error).toHaveTextContent('Error');
    expect(error).toHaveTextContent('PubMed is busy.');

    expect(checking).toHaveTextContent('Checking...');

    for (const item of rows()) {
      expect(item.querySelector('svg:not([aria-hidden="true"])')).toBeNull();
    }
  });

  it('summarises found studies and lists unresolved ones separately', () => {
    const initial = withInputs([doi, doi, doi, 'nope', '']);
    const results: Record<string, StudyRowState> = {
      s1: { input: doi, check: { status: 'found', doi, query, checkedAt } },
      s2: { input: doi, check: { status: 'not_found', doi, query, checkedAt } },
      s3: { input: doi, check: { status: 'not_in_pubmed', doi, query, checkedAt } },
      s4: { input: 'nope', check: { status: 'invalid', doi: null, query, checkedAt } },
    };
    render(<Harness initial={initial} results={results} />);
    const summary = screen.getByTestId('studies-summary');
    expect(summary).toHaveTextContent('Found 1 of 2 studies.');
    expect(summary).toHaveTextContent('1 DOI not in PubMed');
    expect(summary).toHaveTextContent('1 not a valid DOI');
  });

  it('editing a box clears its status', async () => {
    const user = userEvent.setup();
    const initial = withInputs([doi, doi]);
    const results: Record<string, StudyRowState> = {
      s1: { input: doi, check: { status: 'found', doi, query, checkedAt } },
      s2: { input: doi, check: { status: 'found', doi, query, checkedAt } },
    };
    render(<Harness initial={initial} results={results} />);
    await user.type(screen.getByRole('textbox', { name: 'DOI for study 1' }), '9');
    const first = row(0);
    const second = row(1);
    expect(first).not.toHaveAttribute('data-status');
    expect(first).not.toHaveTextContent('Found by the strategy');
    expect(within(first).queryByRole('link')).toBeNull();
    expect(second).toHaveAttribute('data-status', 'found');
  });

  it('hides a status checked against a different query', () => {
    const initial = withInputs([doi]);
    const results: Record<string, StudyRowState> = {
      s1: { input: doi, check: { status: 'found', doi, query, checkedAt } },
    };
    render(<Harness initial={initial} results={results} currentQuery={`${query} AND (x)`} />);
    expect(row(0)).not.toHaveAttribute('data-status');
    expect(screen.queryByTestId('studies-summary')).toBeNull();
  });
});
