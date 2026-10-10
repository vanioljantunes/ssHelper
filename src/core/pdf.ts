/**
 * A PDF of the search strategies, written by hand so the app keeps its single runtime
 * dependency (constitution: React only). The file is a plain uncompressed PDF 1.4 with the two
 * standard Courier fonts, which every reader carries, so no font has to be embedded.
 *
 * Pure: no DOM, no network, no clock. The same rows always produce the same bytes; anything
 * that changes between runs, such as the export date, is passed in through the options.
 */

export interface PdfTableRow {
  /** Name shown in the first column, for example PubMed. */
  database: string;
  /** The strategy text, exactly as the page shows it. */
  strategy: string;
}

export interface PdfTableOptions {
  /** Line above the table; left out when empty. */
  title?: string;
  /** Second line above the table, for example the export date. */
  subtitle?: string;
  /** Column titles, so the caller keeps every visible string in the i18n file. */
  columns?: { database: string; strategy: string };
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const FONT_SIZE = 8;
const TITLE_SIZE = 12;
const SUBTITLE_SIZE = 9;
const LINE_HEIGHT = 10;
/** Courier is monospaced: every glyph is 0.6 em wide, which is what makes wrapping exact. */
const CHAR_WIDTH = FONT_SIZE * 0.6;
const PADDING = 6;
const ASCENT = 7.5;
const TABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const DATABASE_WIDTH = 86;
const STRATEGY_WIDTH = TABLE_WIDTH - DATABASE_WIDTH;

const charsThatFit = (width: number): number =>
  Math.max(1, Math.floor((width - 2 * PADDING) / CHAR_WIDTH));

const DATABASE_CHARS = charsThatFit(DATABASE_WIDTH);
const STRATEGY_CHARS = charsThatFit(STRATEGY_WIDTH);

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Greedy wrap at `maxChars`; a word longer than the column is cut, never overflowed. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    let token = word;
    while (token.length > maxChars) {
      if (line !== '') {
        lines.push(line);
        line = '';
      }
      lines.push(token.slice(0, maxChars));
      token = token.slice(maxChars);
    }
    if (token === '') continue;
    if (line === '') line = token;
    else if (line.length + 1 + token.length <= maxChars) line = `${line} ${token}`;
    else {
      lines.push(line);
      line = token;
    }
  }
  if (line !== '') lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * The text of a PDF string. Parentheses and backslashes are escaped, control characters become
 * a space, and anything above Latin-1 becomes a question mark, so one character is one byte and
 * the stream length stays exact.
 */
function pdfString(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 255) {
      out += '?';
      continue;
    }
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code < 32) out += ' ';
    else out += char;
  }
  return out;
}

const show = (font: string, size: number, x: number, y: number, text: string): string =>
  `BT /${font} ${size} Tf ${round(x)} ${round(y)} Td (${pdfString(text)}) Tj ET\n`;

const rectangle = (x: number, y: number, width: number, height: number): string =>
  `${round(x)} ${round(y)} ${round(width)} ${round(height)} re S\n`;

/** One drawn band of the table: the lines that fit on this page for one row, or the titles. */
interface Band {
  database: string[];
  strategy: string[];
}

function bandHeight(band: Band): number {
  return Math.max(band.database.length, band.strategy.length) * LINE_HEIGHT + 2 * PADDING;
}

function drawBand(band: Band, top: number, bold: boolean): string {
  const height = bandHeight(band);
  const font = bold ? 'F2' : 'F1';
  let out = rectangle(MARGIN, top - height, DATABASE_WIDTH, height);
  out += rectangle(MARGIN + DATABASE_WIDTH, top - height, STRATEGY_WIDTH, height);
  band.database.forEach((line, index) => {
    const y = top - PADDING - ASCENT - index * LINE_HEIGHT;
    out += show(font, FONT_SIZE, MARGIN + PADDING, y, line);
  });
  band.strategy.forEach((line, index) => {
    const y = top - PADDING - ASCENT - index * LINE_HEIGHT;
    out += show(font, FONT_SIZE, MARGIN + DATABASE_WIDTH + PADDING, y, line);
  });
  return out;
}

function latin1(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 0xff);
  return bytes;
}

/**
 * The strategies as a one-table PDF: a Database column and a Search strategy column, the column
 * titles repeated on every page, and a long strategy wrapped and carried over the page break.
 */
export function buildStrategyTablePdf(
  rows: PdfTableRow[],
  options: PdfTableOptions = {},
): Uint8Array {
  const columns = options.columns ?? { database: 'Database', strategy: 'Search strategy' };
  const header: Band = {
    database: wrap(columns.database, DATABASE_CHARS),
    strategy: wrap(columns.strategy, STRATEGY_CHARS),
  };

  const pages: string[] = [];
  let content = '0.5 w\n';
  let top = PAGE_HEIGHT - MARGIN;

  if (options.title !== undefined && options.title !== '') {
    content += show('F2', TITLE_SIZE, MARGIN, top - TITLE_SIZE, options.title);
    top -= TITLE_SIZE + 8;
  }
  if (options.subtitle !== undefined && options.subtitle !== '') {
    content += show('F1', SUBTITLE_SIZE, MARGIN, top - SUBTITLE_SIZE, options.subtitle);
    top -= SUBTITLE_SIZE + 8;
  }

  content += drawBand(header, top, true);
  top -= bandHeight(header);

  for (const row of rows) {
    let strategy = wrap(row.strategy, STRATEGY_CHARS);
    let database = wrap(row.database, DATABASE_CHARS);
    while (strategy.length > 0) {
      const fits = Math.floor((top - MARGIN - 2 * PADDING) / LINE_HEIGHT);
      if (fits < 1) {
        pages.push(content);
        content = '0.5 w\n';
        top = PAGE_HEIGHT - MARGIN;
        content += drawBand(header, top, true);
        top -= bandHeight(header);
        continue;
      }
      const band: Band = { database, strategy: strategy.slice(0, fits) };
      content += drawBand(band, top, false);
      top -= bandHeight(band);
      strategy = strategy.slice(fits);
      database = [];
    }
  }
  pages.push(content);

  return assemble(pages);
}

/** Catalog, page tree, the two fonts, then one page and one content stream per page. */
function assemble(pages: string[]): Uint8Array {
  const firstPage = 5;
  const pageIds = pages.map((_, index) => firstPage + index * 2);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] ` +
      `/Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
  ];
  pages.forEach((stream, index) => {
    const id = pageIds[index] ?? firstPage;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  const bytes: number[] = [];
  const push = (text: string) => {
    for (const byte of latin1(text)) bytes.push(byte);
  };
  push('%PDF-1.4\n');
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(bytes.length);
    push(`${index + 1} 0 obj\n${body}\nendobj\n`);
  });
  const xref = bytes.length;
  push(`xref\n0 ${objects.length + 1}\n`);
  push('0000000000 65535 f \n');
  for (const offset of offsets) push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Uint8Array.from(bytes);
}
