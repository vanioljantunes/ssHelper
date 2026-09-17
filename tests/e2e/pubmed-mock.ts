import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

const fixtureDir = resolve(import.meta.dirname, '../fixtures/pubmed');
const countOk = JSON.parse(readFileSync(resolve(fixtureDir, 'count-ok.json'), 'utf8'));
const crossrefDir = resolve(import.meta.dirname, '../fixtures/crossref');

/** Recorded Crossref works responses by DOI (FR-024). */
export const CROSSREF_FIXTURES: Record<string, string> = {
  '10.1016/j.clinimag.2021.02.026': 'akcay-2021',
  '10.1002/jmri.29184': 'gong-2024',
  '10.1186/s43055-023-01181-z': 'elshewy-2024',
  '10.1007/s00261-024-04788-6': 'zhang-2025',
  '10.1002/jmri.29103': 'yu-2024',
};

export const CROSSREF_PATTERN = 'https://api.crossref.org/works/**';

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
 * Routes Crossref works calls to the recorded fixtures; unknown DOIs get HTTP 404.
 * Returns the list of DOIs requested, in order.
 */
export async function mockCrossref(page: Page): Promise<string[]> {
  const dois: string[] = [];
  await page.route(CROSSREF_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    const doi = decodeURIComponent(url.pathname.slice('/works/'.length));
    dois.push(doi);
    const name = CROSSREF_FIXTURES[doi];
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (name === undefined) {
      await route.fulfill({ status: 404, headers, body: 'Resource not found.' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers,
      body: readFileSync(resolve(crossrefDir, `${name}.json`), 'utf8'),
    });
  });
  return dois;
}

/**
 * Routes PubMed esearch calls to the recorded count-ok.json shape with controlled counts, and
 * Crossref calls through `mockCrossref`.
 * Returns the list of `term` values requested, in order.
 */
export async function mockPubmed(page: Page, options: MockOptions = {}): Promise<string[]> {
  const terms: string[] = [];
  // Study label lookups must never reach the real Crossref API from tests.
  await mockCrossref(page);
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
