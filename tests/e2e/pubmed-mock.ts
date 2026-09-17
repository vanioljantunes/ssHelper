import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

const fixtureDir = resolve(import.meta.dirname, '../fixtures/pubmed');
const countOk = JSON.parse(readFileSync(resolve(fixtureDir, 'count-ok.json'), 'utf8'));

export const ESEARCH_PATTERN = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**';

export interface MockOptions {
  /** Count returned for queries without the meta-analysis arm. */
  count?: number;
  /** Count returned for queries with the meta-analysis arm. */
  metaCount?: number;
  /** Per-term override; return undefined to fall back to `count` or `metaCount`. */
  countFor?: (term: string) => number | undefined;
}

/**
 * Routes PubMed esearch calls to the recorded count-ok.json shape with controlled counts.
 * Returns the list of `term` values requested, in order.
 */
export async function mockPubmed(page: Page, options: MockOptions = {}): Promise<string[]> {
  const terms: string[] = [];
  await page.route(ESEARCH_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    const term = url.searchParams.get('term') ?? '';
    terms.push(term);
    const isMeta = term.endsWith(' AND ("meta-analysis")');
    const count =
      options.countFor?.(term) ?? (isMeta ? (options.metaCount ?? 56) : (options.count ?? 1234));
    const body = {
      ...countOk,
      esearchresult: { ...countOk.esearchresult, count: String(count), querytranslation: term },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(body),
    });
  });
  return terms;
}

export async function failPubmed(page: Page): Promise<void> {
  await page.unroute(ESEARCH_PATTERN);
  await page.route(ESEARCH_PATTERN, (route) => route.abort('internetdisconnected'));
}
