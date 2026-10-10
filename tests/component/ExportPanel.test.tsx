import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TargetDatabase } from '../../src/core/translate';
import { en } from '../../src/i18n/en';
import { ExportPanel } from '../../src/ui/ExportPanel';

const arms = [['"heart failure"[tiab]'], ['sacubitril[tiab]']];
const query = '("heart failure"[tiab]) AND (sacubitril[tiab])';

function setup(over: Partial<React.ComponentProps<typeof ExportPanel>> = {}) {
  const savePdf = vi.fn<(bytes: Uint8Array, fileName: string) => void>();
  const selected: TargetDatabase[] = ['cochrane', 'embase'];
  render(
    <ExportPanel
      headingId="export-heading"
      arms={arms}
      query={query}
      selected={selected}
      savePdf={savePdf}
      today={() => '2026-10-10'}
      {...over}
    />,
  );
  return { savePdf };
}

const fileText = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('ExportPanel', () => {
  it('lists PubMed and every checked database as a row of the table', () => {
    setup();
    const rows = screen.getByRole('list', { name: en.exportRowsLabel });
    expect(rows.textContent).toContain(en.databasePubmed);
    expect(rows.textContent).toContain(en.databaseCochrane);
    expect(rows.textContent).toContain(en.databaseEmbase);
    expect(rows.textContent).not.toContain(en.databaseScopus);
  });

  it('adds a Scopus row once Scopus is checked', () => {
    setup({ selected: ['cochrane', 'embase', 'scopus'] });
    expect(screen.getByRole('list', { name: en.exportRowsLabel }).textContent).toContain(
      en.databaseScopus,
    );
  });

  it('saves a PDF carrying the PubMed query and each translation', async () => {
    const { savePdf } = setup();
    await userEvent.click(screen.getByRole('button', { name: en.exportButton }));
    expect(savePdf).toHaveBeenCalledTimes(1);
    const [bytes, fileName] = savePdf.mock.calls[0] ?? [];
    expect(fileName).toBe('search-strategies-2026-10-10.pdf');
    const file = fileText(bytes ?? new Uint8Array());
    expect(file.startsWith('%PDF-1.4\n')).toBe(true);
    expect(file).toContain('(PubMed) Tj');
    expect(file).toContain('Exported 2026-10-10');
    expect(file).toContain('ti,ab,kw');
    expect(screen.getByText(en.exportDone)).toBeInTheDocument();
  });

  it('carries no result count into the table', async () => {
    const { savePdf } = setup();
    await userEvent.click(screen.getByRole('button', { name: en.exportButton }));
    const file = fileText(savePdf.mock.calls[0]?.[0] ?? new Uint8Array());
    expect(file).toContain(`(${en.exportColumnDatabase}) Tj`);
    expect(file).toContain(`(${en.exportColumnStrategy}) Tj`);
    expect(file).not.toContain('(Results) Tj');
  });

  it('disables the button and asks for a term while the strategy is empty', async () => {
    const { savePdf } = setup({ query: null, arms: [[], []] });
    const button = screen.getByRole('button', { name: en.exportButton });
    expect(button).toBeDisabled();
    expect(screen.getByText(en.exportEmpty)).toBeInTheDocument();
    await userEvent.click(button);
    expect(savePdf).not.toHaveBeenCalled();
  });

  it('reports a save that fails instead of staying silent', async () => {
    const savePdf = vi.fn(() => {
      throw new Error('no file system access');
    });
    setup({ savePdf });
    await userEvent.click(screen.getByRole('button', { name: en.exportButton }));
    expect(screen.getByText(en.exportFailed)).toBeInTheDocument();
  });
});
