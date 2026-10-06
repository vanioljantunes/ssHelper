import type { PriorRecord } from '../core/prior';
import type { CountErrorKind, CountOutcome } from '../core/types';
import { en, t } from '../i18n/en';
import { createThrottle, type Throttle } from './throttle';

export const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
export const ESUMMARY_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi';
/** How many records one list request asks PubMed for. */
export const LIST_RETMAX = 100;
export const TOOL_NAME = 'ssHelper';
export const REQUEST_TIMEOUT_MS = 15_000;
export const RETRY_DELAYS_MS = [1_000, 3_000] as const;

const IGNORED_MESSAGES = new Set(['No items found.']);

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** A contact email, or a getter read at each request so the visitor can change it (FR-025). */
export type ContactEmail = string | (() => string);

export interface PubmedClientOptions {
  fetchFn: FetchFn;
  /** Contact address sent as `email`; requests are refused with `no_email` while it is blank. */
  email: ContactEmail;
  throttle?: Throttle;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  /** Network failures are retried only while online; defaults to navigator.onLine. */
  isOnline?: () => boolean;
}

/** The records a list request returned, plus how many PubMed holds in total for that query. */
export type RecordsOutcome =
  | { status: 'ok'; records: PriorRecord[]; total: number }
  | { status: 'error'; kind: CountErrorKind; message: string };

export interface PubmedClient {
  countQuery(query: string, signal?: AbortSignal): Promise<CountOutcome>;
  /** The most recent records for a query, newest first, for the prior meta-analysis list. */
  listRecords(query: string, retmax?: number, signal?: AbortSignal): Promise<RecordsOutcome>;
}

/**
 * One request outcome: a parsed value, a final error, or a reason to retry. The parser decides
 * what the value holds, so counts and record lists share the retry and throttle machinery.
 */
type Attempt<T> =
  | { type: 'done'; value: T }
  | { type: 'failed'; outcome: CountOutcome }
  | { type: 'retry'; kind: 'rate_limited' | 'http' | 'network'; status: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function failure(kind: CountErrorKind, status?: number): CountOutcome {
  const messages: Record<CountErrorKind, string> = {
    rate_limited: en.errorRateLimited,
    network: en.errorNetwork,
    http: t(en.errorHttp, { status: status ?? 0 }),
    invalid_response: en.errorInvalidResponse,
    no_email: en.errorNoEmail,
  };
  return { status: 'error', kind, message: messages[kind] };
}

function searchParams(query: string, email: string, retmax: number): URLSearchParams {
  return new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: String(retmax),
    tool: TOOL_NAME,
    email,
  });
}

function withoutPlus(url: string): string {
  return url.replace(/\+/g, '%20');
}

export function buildEsearchUrl(query: string, email: string): string {
  return withoutPlus(`${ESEARCH_URL}?${searchParams(query, email, 0).toString()}`);
}

/** esearch for the newest records of a query: PMIDs only, sorted by publication date. */
export function buildEsearchListUrl(query: string, email: string, retmax: number): string {
  const params = searchParams(query, email, retmax);
  params.set('sort', 'pub_date');
  return withoutPlus(`${ESEARCH_URL}?${params.toString()}`);
}

/** esummary for a batch of PMIDs, in the order they were given. */
export function buildEsummaryUrl(pmids: readonly string[], email: string): string {
  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'json',
    tool: TOOL_NAME,
    email,
  });
  return withoutPlus(`${ESUMMARY_URL}?${params.toString()}`);
}

function flattenMessages(list: unknown): string[] {
  if (typeof list !== 'object' || list === null) return [];
  const out: string[] = [];
  for (const value of Object.values(list)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim() !== '' && !IGNORED_MESSAGES.has(item)) {
          out.push(item);
        }
      }
    }
  }
  return out;
}

function mentionsRateLimit(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const error = (body as { error: unknown }).error;
  return typeof error === 'string' && /rate limit/i.test(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function esearchResult(body: unknown): Record<string, unknown> | null {
  const root = asRecord(body);
  return root ? asRecord(root.esearchresult) : null;
}

function parseCount(body: unknown): Attempt<CountOutcome> {
  const result = esearchResult(body);
  if (result === null) return { type: 'failed', outcome: failure('invalid_response') };
  const rawCount = result.count;
  if (typeof rawCount !== 'string' || !/^\d+$/.test(rawCount)) {
    return { type: 'failed', outcome: failure('invalid_response') };
  }
  return {
    type: 'done',
    value: {
      status: 'ok',
      count: Number(rawCount),
      queryTranslation: typeof result.querytranslation === 'string' ? result.querytranslation : '',
      warnings: [...flattenMessages(result.warninglist), ...flattenMessages(result.errorlist)],
    },
  };
}

interface IdList {
  total: number;
  pmids: string[];
}

function parseIdList(body: unknown): Attempt<IdList> {
  const result = esearchResult(body);
  if (result === null) return { type: 'failed', outcome: failure('invalid_response') };
  const rawCount = result.count;
  const idlist = result.idlist;
  if (typeof rawCount !== 'string' || !/^\d+$/.test(rawCount) || !Array.isArray(idlist)) {
    return { type: 'failed', outcome: failure('invalid_response') };
  }
  return {
    type: 'done',
    value: {
      total: Number(rawCount),
      pmids: idlist.filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
    },
  };
}

/** First four-digit year in a PubMed date such as "2026 Mar 14" or "2026/03/14 00:00". */
function parseYear(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /\b(\d{4})\b/.exec(value);
  return match ? Number(match[1]) : null;
}

function firstAuthor(entry: Record<string, unknown>): string {
  if (typeof entry.sortfirstauthor === 'string' && entry.sortfirstauthor.trim() !== '') {
    return entry.sortfirstauthor.trim();
  }
  const authors = entry.authors;
  if (Array.isArray(authors)) {
    for (const author of authors) {
      const record = asRecord(author);
      const name = record?.name;
      if (typeof name === 'string' && name.trim() !== '') return name.trim();
    }
  }
  return '';
}

/** The PMC identifier, when PubMed lists one: a free full text exists for the record. */
function pmcId(entry: Record<string, unknown>): string | null {
  const ids = entry.articleids;
  if (!Array.isArray(ids)) return null;
  for (const id of ids) {
    const record = asRecord(id);
    if (record?.idtype !== 'pmc') continue;
    const value = record.value;
    if (typeof value !== 'string' || value.trim() === '') continue;
    const trimmed = value.trim();
    return /^PMC/i.test(trimmed) ? trimmed.toUpperCase() : `PMC${trimmed}`;
  }
  return null;
}

function parseSummaries(body: unknown): Attempt<Record<string, PriorRecord>> {
  const root = asRecord(body);
  const result = root ? asRecord(root.result) : null;
  if (result === null) return { type: 'failed', outcome: failure('invalid_response') };
  const records: Record<string, PriorRecord> = {};
  for (const [uid, value] of Object.entries(result)) {
    if (uid === 'uids') continue;
    const entry = asRecord(value);
    if (entry === null) continue;
    records[uid] = {
      pmid: uid,
      author: firstAuthor(entry),
      year: parseYear(entry.sortpubdate) ?? parseYear(entry.pubdate),
      title: typeof entry.title === 'string' ? entry.title : '',
      pmcid: pmcId(entry),
    };
  }
  return { type: 'done', value: records };
}

export function createPubmedClient(options: PubmedClientOptions): PubmedClient {
  const readEmail = () =>
    (typeof options.email === 'function' ? options.email() : options.email).trim();
  const throttle = options.throttle ?? createThrottle();
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retryDelays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const isOnline =
    options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);

  async function attempt<T>(
    url: string,
    parse: (body: unknown) => Attempt<T>,
    signal?: AbortSignal,
  ): Promise<Attempt<T>> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await options.fetchFn(url, { signal: controller.signal });
      if (response.status === 429) return { type: 'retry', kind: 'rate_limited', status: 429 };
      if (response.status >= 500) return { type: 'retry', kind: 'http', status: response.status };
      if (response.status !== 200) {
        return { type: 'failed', outcome: failure('http', response.status) };
      }
      let text: string;
      try {
        text = await response.text();
      } catch {
        return {
          type: 'failed',
          outcome: failure(controller.signal.aborted ? 'network' : 'invalid_response'),
        };
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return { type: 'failed', outcome: failure('invalid_response') };
      }
      if (mentionsRateLimit(body)) return { type: 'retry', kind: 'rate_limited', status: 200 };
      return parse(body);
    } catch {
      // A timeout or caller abort is final. Other fetch failures are retried: a PubMed rate
      // limit response without CORS headers reaches the browser as a plain network error.
      if (controller.signal.aborted || !isOnline()) {
        return { type: 'failed', outcome: failure('network') };
      }
      return { type: 'retry', kind: 'network', status: 0 };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /** Runs one request through the throttle, retrying rate limits and server errors in order. */
  async function request<T>(
    url: string,
    parse: (body: unknown) => Attempt<T>,
    signal?: AbortSignal,
  ): Promise<{ status: 'ok'; value: T } | { status: 'error'; outcome: CountOutcome }> {
    for (let i = 0; ; i += 1) {
      const result = await throttle.schedule(() => attempt(url, parse, signal));
      if (result.type === 'done') return { status: 'ok', value: result.value };
      if (result.type === 'failed') return { status: 'error', outcome: result.outcome };
      const delay = retryDelays[i];
      if (delay === undefined || signal?.aborted) {
        return { status: 'error', outcome: failure(result.kind, result.status) };
      }
      await sleep(delay);
    }
  }

  function asError(outcome: CountOutcome): RecordsOutcome {
    return outcome.status === 'error'
      ? { status: 'error', kind: outcome.kind, message: outcome.message }
      : { status: 'error', kind: 'invalid_response', message: en.errorInvalidResponse };
  }

  return {
    async countQuery(query: string, signal?: AbortSignal): Promise<CountOutcome> {
      try {
        const email = readEmail();
        if (email === '') return failure('no_email');
        const outcome = await request(buildEsearchUrl(query, email), parseCount, signal);
        return outcome.status === 'ok' ? outcome.value : outcome.outcome;
      } catch {
        return failure('network');
      }
    },

    async listRecords(
      query: string,
      retmax: number = LIST_RETMAX,
      signal?: AbortSignal,
    ): Promise<RecordsOutcome> {
      try {
        const email = readEmail();
        if (email === '') return asError(failure('no_email'));
        const ids = await request(buildEsearchListUrl(query, email, retmax), parseIdList, signal);
        if (ids.status === 'error') return asError(ids.outcome);
        if (ids.value.pmids.length === 0) {
          return { status: 'ok', records: [], total: ids.value.total };
        }
        const summaries = await request(
          buildEsummaryUrl(ids.value.pmids, email),
          parseSummaries,
          signal,
        );
        if (summaries.status === 'error') return asError(summaries.outcome);
        const records = ids.value.pmids
          .map((pmid) => summaries.value[pmid])
          .filter((record): record is PriorRecord => record !== undefined);
        return { status: 'ok', records, total: ids.value.total };
      } catch {
        return asError(failure('network'));
      }
    },
  };
}

/** One queue for every app client, so all PubMed calls from this page share the rate limit. */
const sharedThrottle = createThrottle();

/** The app's PubMed client: browser fetch, the shared throttle, and the visitor's email. */
export function createAppPubmedClient(email: ContactEmail): PubmedClient {
  return createPubmedClient({
    fetchFn: (input, init) => fetch(input, init),
    email,
    throttle: sharedThrottle,
  });
}
