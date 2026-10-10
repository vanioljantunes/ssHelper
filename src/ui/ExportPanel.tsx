import { useState } from 'react';
import { buildStrategyTablePdf, type PdfTableRow } from '../core/pdf';
import { translate, TARGET_DATABASES, type TargetDatabase } from '../core/translate';
import { en, t } from '../i18n/en';

/** Short names for the first column of the table; the panel keeps the long ones. */
const SHORT_NAMES: Record<TargetDatabase, string> = {
  cochrane: en.databaseCochrane,
  embase: en.databaseEmbase,
  scopus: en.databaseScopus,
};

export interface ExportPanelProps {
  /** Heading id, so the section can label itself with it. */
  headingId: string;
  /** Terms of each arm, as the PubMed preview uses them. */
  arms: string[][];
  /** The PubMed query exactly as the search panel shows it, or null when no term is entered. */
  query: string | null;
  /** The databases checked in the translation panel; they become the rows after PubMed. */
  selected: TargetDatabase[];
  /** Saves the finished file; replaced in tests. */
  savePdf?: (bytes: Uint8Array, fileName: string) => void;
  /** The export date as YYYY-MM-DD; replaced in tests so the output stays comparable. */
  today?: () => string;
}

function saveInBrowser(bytes: Uint8Array, fileName: string): void {
  // A copy into a fresh buffer keeps the Blob independent of the array it came from.
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const isoDate = (): string => new Date().toISOString().slice(0, 10);

/** The rows of the table: PubMed first, then each checked database in a fixed order. */
export function exportRows(
  arms: string[][],
  query: string,
  selected: TargetDatabase[],
): PdfTableRow[] {
  const rows: PdfTableRow[] = [{ database: en.databasePubmed, strategy: query }];
  for (const database of TARGET_DATABASES) {
    if (!selected.includes(database)) continue;
    const { query: rewritten } = translate(arms, database);
    if (rewritten === null) continue;
    rows.push({ database: SHORT_NAMES[database], strategy: rewritten });
  }
  return rows;
}

/**
 * The strategies as a PDF table (FR-033): one row for PubMed and one per checked database, no
 * result counts. The file is written in the browser; nothing is sent anywhere.
 */
export function ExportPanel({
  headingId,
  arms,
  query,
  selected,
  savePdf = saveInBrowser,
  today = isoDate,
}: ExportPanelProps) {
  const [message, setMessage] = useState('');
  const rows = query === null ? [] : exportRows(arms, query, selected);

  const download = () => {
    if (query === null) return;
    const date = today();
    try {
      const bytes = buildStrategyTablePdf(rows, {
        title: en.exportPdfTitle,
        subtitle: t(en.exportPdfSubtitle, { date }),
        columns: { database: en.exportColumnDatabase, strategy: en.exportColumnStrategy },
      });
      savePdf(bytes, t(en.exportFileName, { date }));
      setMessage(en.exportDone);
    } catch {
      setMessage(en.exportFailed);
    }
  };

  return (
    <div>
      <h2 id={headingId}>{en.exportHeading}</h2>
      <p className="hint">{en.exportHint}</p>
      {rows.length > 0 && (
        <ul className="export-rows" aria-label={en.exportRowsLabel}>
          {rows.map((row) => (
            <li key={row.database}>{row.database}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={download} disabled={query === null}>
        {en.exportButton}
      </button>
      <p className="hint" aria-live="polite">
        {query === null ? en.exportEmpty : message}
      </p>
    </div>
  );
}
