import { describe, expect, it } from 'vitest';
import { buildStrategyTablePdf, type PdfTableRow } from '../../src/core/pdf';

const text = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

const rows: PdfTableRow[] = [
  { database: 'PubMed', strategy: '("heart failure"[tiab]) AND (sacubitril[tiab])' },
  { database: 'Embase', strategy: "('heart failure':ti,ab) AND (sacubitril:ti,ab)" },
];

describe('buildStrategyTablePdf', () => {
  it('writes a PDF file with a header, a cross-reference table and a trailer', () => {
    const file = text(buildStrategyTablePdf(rows));
    expect(file.startsWith('%PDF-1.4\n')).toBe(true);
    expect(file.endsWith('%%EOF\n')).toBe(true);
    expect(file).toContain('/Type /Catalog');
    expect(file).toContain('/BaseFont /Courier');
  });

  it('points startxref at the cross-reference table', () => {
    const file = text(buildStrategyTablePdf(rows));
    const match = /startxref\n(\d+)\n%%EOF\n$/.exec(file);
    expect(match).not.toBeNull();
    const offset = Number(match?.[1]);
    expect(file.slice(offset, offset + 4)).toBe('xref');
  });

  it('records the offset of every object in the cross-reference table', () => {
    const file = text(buildStrategyTablePdf(rows));
    const entries = Array.from(file.matchAll(/^(\d{10}) 00000 n $/gm)).map((entry) =>
      Number(entry[1]),
    );
    expect(entries.length).toBeGreaterThan(4);
    entries.forEach((offset, index) => {
      expect(file.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });

  it('carries the column titles and every row', () => {
    const file = text(buildStrategyTablePdf(rows));
    expect(file).toContain('(Database) Tj');
    expect(file).toContain('(Search strategy) Tj');
    expect(file).toContain('(PubMed) Tj');
    expect(file).toContain('(Embase) Tj');
    expect(file).toContain('heart failure');
  });

  it('escapes the characters a PDF string cannot carry as written', () => {
    const file = text(buildStrategyTablePdf([{ database: 'PubMed', strategy: 'a (b) \\ c' }]));
    expect(file).toContain('a \\(b\\) \\\\ c');
  });

  it('replaces a character outside Latin-1 so the stream stays byte for byte', () => {
    const file = text(buildStrategyTablePdf([{ database: 'PubMed', strategy: 'a 中 b' }]));
    expect(file).toContain('a ? b');
  });

  it('keeps an accented character as one Latin-1 byte', () => {
    const bytes = buildStrategyTablePdf([{ database: 'PubMed', strategy: 'fracao' }]);
    expect(text(bytes)).toContain('fracao');
    const accented = buildStrategyTablePdf([{ database: 'PubMed', strategy: 'fraçao' }]);
    expect(Array.from(accented)).toContain(0xe7);
  });

  it('wraps a long strategy over several lines instead of running off the page', () => {
    const long = Array.from({ length: 40 }, (_, i) => `"term number ${i}"[tiab]`).join(' OR ');
    const file = text(buildStrategyTablePdf([{ database: 'PubMed', strategy: long }]));
    const lines = Array.from(file.matchAll(/\) Tj/g)).length;
    expect(lines).toBeGreaterThan(10);
    for (const line of file.matchAll(/\((.*)\) Tj/g)) {
      expect((line[1] ?? '').length).toBeLessThanOrEqual(90);
    }
  });

  it('starts a second page when the rows do not fit on one', () => {
    const long = Array.from({ length: 400 }, (_, i) => `"term number ${i}"[tiab]`).join(' OR ');
    const file = text(buildStrategyTablePdf([{ database: 'PubMed', strategy: long }]));
    expect(file).toMatch(/\/Count [2-9]/);
    expect(Array.from(file.matchAll(/\/Type \/Page\b/g)).length).toBeGreaterThan(1);
  });

  it('repeats the column titles on every page', () => {
    const long = Array.from({ length: 400 }, (_, i) => `"term number ${i}"[tiab]`).join(' OR ');
    const file = text(buildStrategyTablePdf([{ database: 'PubMed', strategy: long }]));
    expect(Array.from(file.matchAll(/\(Database\) Tj/g)).length).toBeGreaterThan(1);
  });

  it('writes a title above the table when one is given', () => {
    const file = text(buildStrategyTablePdf(rows, { title: 'Search strategies' }));
    expect(file).toContain('(Search strategies) Tj');
  });

  it('is deterministic', () => {
    const first = buildStrategyTablePdf(rows, { title: 'Search strategies' });
    const second = buildStrategyTablePdf(rows, { title: 'Search strategies' });
    expect(Array.from(first)).toEqual(Array.from(second));
  });

  it('writes a valid file with the header row alone when there is no row', () => {
    const file = text(buildStrategyTablePdf([]));
    expect(file.startsWith('%PDF-1.4\n')).toBe(true);
    expect(file).toContain('(Database) Tj');
    expect(file.endsWith('%%EOF\n')).toBe(true);
  });
});
