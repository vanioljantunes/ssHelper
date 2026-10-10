import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { en } from '../../src/i18n/en';
import { TranslatePanel } from '../../src/ui/TranslatePanel';

const arms = [['"heart failure"[tiab]', '"Heart Failure"[Mesh]'], ['sacubitril[tiab]']];

function renderPanel(over: Partial<React.ComponentProps<typeof TranslatePanel>> = {}) {
  const copyText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  render(
    <TranslatePanel headingId="translate-heading" arms={arms} copyText={copyText} {...over} />,
  );
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
    expect(screen.getByText(en.translateCochraneLabel)).toBeInTheDocument();
    expect(screen.getByText(en.translateEmbaseLabel)).toBeInTheDocument();
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
    expect(screen.queryByRole('button')).toBeNull();
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
