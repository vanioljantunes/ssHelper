/**
 * Prior meta-analyses retrieved by the strategy: the records PubMed returns for the strategy
 * plus the meta-analysis arm, named "Author, Year" and filtered by a minimum publication year.
 */
export interface PriorRecord {
  /** PubMed identifier; also the row key. */
  pmid: string;
  /** First author family name as PubMed sorts it, empty when the record has no author. */
  author: string;
  /** Publication year, null when PubMed gives no parsable year. */
  year: number | null;
  title: string;
  /** PMC identifier such as "PMC8123456" when a free full text exists, null otherwise. */
  pmcid: string | null;
}

/** How many years of the dropdown are offered below the current year. */
export const YEAR_SPAN = 20;

/** More than this many meta-analyses turns the default minimum year on. */
export const YEAR_FILTER_THRESHOLD = 5;

/** Years offered in the dropdown, newest first. */
export function yearOptions(now: Date, span: number = YEAR_SPAN): number[] {
  const current = now.getFullYear();
  return Array.from({ length: span + 1 }, (_, i) => current - i);
}

/**
 * The minimum year the dropdown starts on: five years back when the strategy retrieves more
 * than five meta-analyses, and no filter at all when it retrieves five or fewer.
 */
export function defaultMinYear(count: number, now: Date): number | null {
  return count > YEAR_FILTER_THRESHOLD ? now.getFullYear() - YEAR_FILTER_THRESHOLD : null;
}

/**
 * The family name in a PubMed author string: "Hassanpour H" gives "Hassanpour". Initials are a
 * short run of letters at the end, so a plain surname is left alone.
 */
export function familyName(author: string): string {
  return author
    .trim()
    .replace(/\s+[A-Za-z]{1,3}$/, '')
    .trim();
}

/** Row name "Author, Year"; a record without a year shows the author, one without both its PMID. */
export function recordLabel(record: PriorRecord): string {
  const author = familyName(record.author);
  if (author === '') return record.year === null ? record.pmid : String(record.year);
  return record.year === null ? author : `${author}, ${record.year}`;
}
