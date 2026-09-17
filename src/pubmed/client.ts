import type { CountErrorKind, CountOutcome } from '../core/types';
import { en, t } from '../i18n/en';
import { createThrottle, type Throttle } from './throttle';

export const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
export const TOOL_NAME = 'ssHelper';
export const REQUEST_TIMEOUT_MS = 15_000;
export const RETRY_DELAYS_MS = [1_000, 3_000] as const;

const IGNORED_MESSAGES = new Set(['No items found.']);

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface PubmedClientOptions {
  fetchFn: FetchFn;
  email: string;
  throttle?: Throttle;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  /** Network failures are retried only while online; defaults to navigator.onLine. */
  isOnline?: () => boolean;
}

export interface PubmedClient {
  countQuery(query: string, signal?: AbortSignal): Promise<CountOutcome>;
}

type Attempt =
  | { type: 'done'; outcome: CountOutcome }
  | { type: 'retry'; kind: 'rate_limited' | 'http' | 'network'; status: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function failure(kind: CountErrorKind, status?: number): CountOutcome {
  const messages: Record<CountErrorKind, string> = {
    rate_limited: en.errorRateLimited,
    network: en.errorNetwork,
    http: t(en.errorHttp, { status: status ?? 0 }),
    invalid_response: en.errorInvalidResponse,
  };
  return { status: 'error', kind, message: messages[kind] };
}

export function buildEsearchUrl(query: string, email: string): string {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: '0',
    tool: TOOL_NAME,
    email,
  });
  return `${ESEARCH_URL}?${params.toString()}`.replace(/\+/g, '%20');
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

function parseBody(text: string): Attempt {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { type: 'done', outcome: failure('invalid_response') };
  }
  if (mentionsRateLimit(body)) return { type: 'retry', kind: 'rate_limited', status: 200 };
  const result =
    typeof body === 'object' && body !== null && 'esearchresult' in body
      ? (body as { esearchresult: unknown }).esearchresult
      : undefined;
  if (typeof result !== 'object' || result === null) {
    return { type: 'done', outcome: failure('invalid_response') };
  }
  const record = result as Record<string, unknown>;
  const rawCount = record.count;
  if (typeof rawCount !== 'string' || !/^\d+$/.test(rawCount)) {
    return { type: 'done', outcome: failure('invalid_response') };
  }
  return {
    type: 'done',
    outcome: {
      status: 'ok',
      count: Number(rawCount),
      queryTranslation: typeof record.querytranslation === 'string' ? record.querytranslation : '',
      warnings: [...flattenMessages(record.warninglist), ...flattenMessages(record.errorlist)],
    },
  };
}

export function createPubmedClient(options: PubmedClientOptions): PubmedClient {
  const email = options.email.trim();
  if (email === '') {
    throw new Error('VITE_NCBI_CONTACT_EMAIL is required to call PubMed (see .env.example).');
  }
  const throttle = options.throttle ?? createThrottle();
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const retryDelays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const isOnline =
    options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);

  async function attempt(url: string, signal?: AbortSignal): Promise<Attempt> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await options.fetchFn(url, { signal: controller.signal });
      if (response.status === 429) return { type: 'retry', kind: 'rate_limited', status: 429 };
      if (response.status >= 500) return { type: 'retry', kind: 'http', status: response.status };
      if (response.status !== 200) {
        return { type: 'done', outcome: failure('http', response.status) };
      }
      let text: string;
      try {
        text = await response.text();
      } catch {
        return {
          type: 'done',
          outcome: failure(controller.signal.aborted ? 'network' : 'invalid_response'),
        };
      }
      return parseBody(text);
    } catch {
      // A timeout or caller abort is final. Other fetch failures are retried: a PubMed rate
      // limit response without CORS headers reaches the browser as a plain network error.
      if (controller.signal.aborted || !isOnline()) {
        return { type: 'done', outcome: failure('network') };
      }
      return { type: 'retry', kind: 'network', status: 0 };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    async countQuery(query: string, signal?: AbortSignal): Promise<CountOutcome> {
      try {
        const url = buildEsearchUrl(query, email);
        for (let i = 0; ; i += 1) {
          const result = await throttle.schedule(() => attempt(url, signal));
          if (result.type === 'done') return result.outcome;
          const delay = retryDelays[i];
          if (delay === undefined || signal?.aborted) return failure(result.kind, result.status);
          await sleep(delay);
        }
      } catch {
        return failure('network');
      }
    },
  };
}

let defaultClient: PubmedClient | null = null;

/** Counts PubMed records for a query with the app's shared throttle and contact email. */
export function countQuery(query: string, signal?: AbortSignal): Promise<CountOutcome> {
  if (defaultClient === null) {
    defaultClient = createPubmedClient({
      fetchFn: (input, init) => fetch(input, init),
      email: import.meta.env.VITE_NCBI_CONTACT_EMAIL ?? '',
    });
  }
  return defaultClient.countQuery(query, signal);
}
