import { formatStudyLabel } from '../core/label';
import { en, t } from '../i18n/en';
import { createThrottle, type Throttle } from '../pubmed/throttle';

export const CROSSREF_WORKS_URL = 'https://api.crossref.org/works';
export const CROSSREF_MIN_INTERVAL_MS = 200;
export const REQUEST_TIMEOUT_MS = 15_000;
export const RETRY_DELAYS_MS = [1_000, 3_000] as const;

/** Date fields in the order that gives the year of the study label (research.md R11). */
const YEAR_FIELDS = ['published-print', 'published-online', 'published', 'issued'] as const;

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export type LabelOutcome =
  | { status: 'ok'; label: string; family: string; year: number | null }
  | { status: 'error'; message: string };

export interface CrossrefClientOptions {
  fetchFn: FetchFn;
  /** Contact address for the Crossref polite pool; omitted from the URL when blank. */
  email: string;
  throttle?: Throttle;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
}

export interface CrossrefClient {
  fetchStudyLabel(doi: string, signal?: AbortSignal): Promise<LabelOutcome>;
}

type Attempt = { type: 'done'; outcome: LabelOutcome } | { type: 'retry'; status: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const failure = (message: string): LabelOutcome => ({ status: 'error', message });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function buildWorksUrl(doi: string, email: string): string {
  const url = `${CROSSREF_WORKS_URL}/${encodeURIComponent(doi)}`;
  return email === '' ? url : `${url}?${new URLSearchParams({ mailto: email }).toString()}`;
}

function firstAuthorName(message: Record<string, unknown>): string | null {
  const authors = message.author;
  if (!Array.isArray(authors) || !isObject(authors[0])) return null;
  const { family, name } = authors[0];
  if (typeof family === 'string' && family.trim() !== '') return family.trim();
  if (typeof name === 'string' && name.trim() !== '') return name.trim();
  return null;
}

function labelYear(message: Record<string, unknown>): number | null {
  for (const field of YEAR_FIELDS) {
    const date = message[field];
    if (!isObject(date) || !Array.isArray(date['date-parts'])) continue;
    const first: unknown = date['date-parts'][0];
    const year: unknown = Array.isArray(first) ? first[0] : undefined;
    if (typeof year === 'number' && Number.isInteger(year)) return year;
  }
  return null;
}

function parseBody(text: string): LabelOutcome {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return failure(en.labelErrorInvalidResponse);
  }
  if (!isObject(body) || !isObject(body.message)) return failure(en.labelErrorInvalidResponse);
  const family = firstAuthorName(body.message);
  const year = labelYear(body.message);
  const label = formatStudyLabel(family, year);
  if (family === null || label === null) return failure(en.labelErrorNoAuthor);
  return { status: 'ok', label, family, year };
}

/** Crossref works lookups for study labels (FR-024), on their own queue apart from PubMed. */
export function createCrossrefClient(options: CrossrefClientOptions): CrossrefClient {
  const email = options.email.trim();
  const throttle = options.throttle ?? createThrottle({ minIntervalMs: CROSSREF_MIN_INTERVAL_MS });
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retryDelays = options.retryDelaysMs ?? RETRY_DELAYS_MS;

  async function attempt(url: string, signal?: AbortSignal): Promise<Attempt> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await options.fetchFn(url, { signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        return { type: 'retry', status: response.status };
      }
      if (response.status !== 200) {
        return {
          type: 'done',
          outcome: failure(t(en.labelErrorHttp, { status: response.status })),
        };
      }
      return { type: 'done', outcome: parseBody(await response.text()) };
    } catch {
      return { type: 'done', outcome: failure(en.labelErrorNetwork) };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    async fetchStudyLabel(doi: string, signal?: AbortSignal): Promise<LabelOutcome> {
      try {
        const url = buildWorksUrl(doi, email);
        for (let i = 0; ; i += 1) {
          const result = await throttle.schedule(() => attempt(url, signal));
          if (result.type === 'done') return result.outcome;
          const delay = retryDelays[i];
          if (delay === undefined || signal?.aborted) {
            return failure(t(en.labelErrorHttp, { status: result.status }));
          }
          await sleep(delay);
        }
      } catch {
        return failure(en.labelErrorNetwork);
      }
    },
  };
}

let defaultClient: CrossrefClient | null = null;

/** Looks up "Lastname, Year" for a DOI with the app's Crossref queue and contact email. */
export function fetchStudyLabel(doi: string, signal?: AbortSignal): Promise<LabelOutcome> {
  if (defaultClient === null) {
    defaultClient = createCrossrefClient({
      fetchFn: (input, init) => fetch(input, init),
      email: import.meta.env.VITE_NCBI_CONTACT_EMAIL ?? '',
    });
  }
  return defaultClient.fetchStudyLabel(doi, signal);
}
