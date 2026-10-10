import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TARGET_DATABASES, type TargetDatabase } from '../../src/core/translate';
import { en } from '../../src/i18n/en';
import { TranslatePanel } from '../../src/ui/TranslatePanel';

const arms = [['"heart failure"[tiab]', '"Heart Failure"[Mesh]'], ['sacubitril[tiab]']];

type PanelProps = React.ComponentProps<typeof TranslatePanel>;

/** The checkboxes are controlled by the page, so the test holds the selection itself. */
function Harness(props: Omit<PanelProps, 'selected' | 'onToggle'>) {
  const [selected, setSelected] = useState<TargetDatabase[]>(DEFAULT_TARGET_DATABASES);
  return (
    <TranslatePanel
      {...props}
      selected={selected}
      onToggle={(database, checked) =>
        setSelected((current) =>
          checked ? [...current, database] : current.filter((item) => item !== database),
        )
      }
    />
  );
}

function renderPanel(over: Partial<PanelProps> = {}) {
  const copyText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  render(<Harness headingId="translate-heading" arms={arms} copyText={copyText} {...over} />);
  return { copyText };
}

describe('TranslatePanel', () => {
  it('shows the strategy written for Cochrane CENTRAL and for Embase', () => {
    renderPanel();
    expect(screen.getByTestId('translate-cochrane').textContent).toBe(
      '("heart failure":ti,ab,kw OR [mh "Heart Failure"]) AND (sacubitril:ti,ab,kw)',
    );
    expect(screen.getByTestId('translate-embase').textContent).toBe(
      "('heart failure':ti,ab OR 'heart failure'/exp) AND (sacubitril:ti,ab)",
    );
  });

  it('labels each translation and heads the panel with the given id', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: en.translateHeading })).toHaveAttribute(
      'id',
      'translate-heading',
    );
    expect(document.getElementById('translate-cochrane-label')?.textContent).toBe(
      en.translateCochraneLabel,
    );
    expect(document.getElementById('translate-embase-label')?.textContent).toBe(
      en.translateEmbaseLabel,
    );
  });

  it('copies one translation and reports it, without copying the other', async () => {
    const { copyText } = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /Copy the Cochrane CENTRAL/ }));
    expect(copyText).toHaveBeenCalledTimes(1);
    expect(copyText).toHaveBeenCalledWith(
      '("heart failure":ti,ab,kw OR [mh "Heart Failure"]) AND (sacubitril:ti,ab,kw)',
    );
    expect(await screen.findByText(en.copied)).toBeInTheDocument();
  });

  it('asks for a term and offers no copy button when there is no strategy yet', () => {
    renderPanel({ arms: [[], []] });
    expect(screen.getByTestId('translate-cochrane').textContent).toBe(en.translateEmpty);
    expect(screen.getByTestId('translate-embase').textContent).toBe(en.translateEmpty);
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
  });

  it('names the field tags it had to leave out', () => {
    renderPanel({ arms: [['english[la]', 'stroke[tiab]']] });
    expect(screen.getByTestId('translate-dropped').textContent).toContain('[la]');
  });

  it('says nothing about dropped tags when every tag maps', () => {
    renderPanel();
    expect(screen.queryByTestId('translate-dropped')).toBeNull();
  });

  it('asks for the subject headings to be checked in Emtree', () => {
    renderPanel();
    expect(screen.getByTestId('translate-headings').textContent).toContain('Heart Failure');
  });

  it('says nothing about headings when the strategy has none', () => {
    renderPanel({ arms: [['stroke[tiab]']] });
    expect(screen.queryByTestId('translate-headings')).toBeNull();
  });

  it('flags a truncated term, and stays quiet when there is none', () => {
    renderPanel({ arms: [['cardiomyopath*[tiab]']] });
    expect(screen.getByTestId('translate-wildcards').textContent).toContain('cardiomyopath*');
  });

  it('says nothing about truncation when no term is truncated', () => {
    renderPanel();
    expect(screen.queryByTestId('translate-wildcards')).toBeNull();
  });
});

describe('TranslatePanel database checkboxes (FR-032)', () => {
  it('checks Cochrane and Embase but not Scopus when the page opens', () => {
    renderPanel();
    expect(screen.getByRole('checkbox', { name: en.translateCochraneLabel })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: en.translateEmbaseLabel })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: en.translateScopusLabel })).not.toBeChecked();
    expect(screen.queryByTestId('translate-scopus')).toBeNull();
  });

  it('shows the Scopus translation once it is checked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('checkbox', { name: en.translateScopusLabel }));
    expect(screen.getByTestId('translate-scopus').textContent).toBe(
      '(TITLE-ABS-KEY("heart failure") OR INDEXTERMS("Heart Failure")) AND ' +
        '(TITLE-ABS-KEY(sacubitril))',
    );
    expect(screen.getByTestId('translate-scopus-headings').textContent).toContain('INDEXTERMS');
  });

  it('hides a translation when its database is unchecked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('checkbox', { name: en.translateEmbaseLabel }));
    expect(screen.queryByTestId('translate-embase')).toBeNull();
    expect(screen.getByTestId('translate-cochrane')).toBeInTheDocument();
  });

  it('asks for a database when none is checked', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('checkbox', { name: en.translateCochraneLabel }));
    await userEvent.click(screen.getByRole('checkbox', { name: en.translateEmbaseLabel }));
    expect(screen.getByText(en.translateNoneChecked)).toBeInTheDocument();
    expect(screen.queryByTestId('translate-cochrane')).toBeNull();
  });
});
