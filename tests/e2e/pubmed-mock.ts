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
export const ESUMMARY_PATTERN = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi**';

/** Prior meta-analyses the mocked PubMed returns, newest first. */
export const PRIOR_RECORDS = [
  { pmid: '42498088', author: 'Hassanpour H', pubdate: '2026/03/14 00:00', pmcid: null },
  { pmid: '41816957', author: 'Thomas SM', pubdate: '2023/12/31 00:00', pmcid: 'PMC13620861' },
] as const;

/** Contact email seeded for e2e runs, so tests never depend on a local .env.local (FR-025). */
export const E2E_CONTACT_EMAIL = 'e2e@example.org';
export const SETTINGS_KEY = 'sshelper:v1:settings';

/**
 * Starts each test from empty browser storage with a saved contact email, or with the email
 * field empty when `contactEmail` is ''.
 */
export async function resetStorage(page: Page, contactEmail = E2E_CONTACT_EMAIL): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ([key, email]) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, contactEmail: email }));
    },
    [SETTINGS_KEY, contactEmail] as const,
  );
  await page.reload();
}

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
  await page.route(ESUMMARY_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    const asked = (url.searchParams.get('id') ?? '').split(',').filter((id) => id !== '');
    const result: Record<string, unknown> = { uids: asked };
    for (const pmid of asked) {
      const record = PRIOR_RECORDS.find((item) => item.pmid === pmid);
      if (!record) continue;
      result[pmid] = {
        uid: pmid,
        sortfirstauthor: record.author,
        sortpubdate: record.pubdate,
        title: `Meta-analysis ${pmid}`,
        articleids: record.pmcid === null ? [] : [{ idtype: 'pmc', value: record.pmcid }],
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ header: { type: 'esummary', version: '0.3' }, result }),
    });
  });
  await page.route(ESEARCH_PATTERN, async (route) => {
    const url = new URL(route.request().url());
    const term = url.searchParams.get('term') ?? '';
    // A list request carries sort=pub_date and asks for PMIDs; it is not one of the counted runs.
    if (url.searchParams.get('sort') === 'pub_date') {
      const from = /"(\d{4})"\[dp\]/.exec(term);
      const minYear = from ? Number(from[1]) : null;
      const shown = PRIOR_RECORDS.filter(
        (record) => minYear === null || Number(record.pubdate.slice(0, 4)) >= minYear,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ...countOk,
          esearchresult: {
            ...countOk.esearchresult,
            count: String(shown.length),
            idlist: shown.map((record) => record.pmid),
          },
        }),
      });
      return;
    }
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
  // Truly offline: navigator.onLine is false, so the client reports the failure without retries.
  await page.context().setOffline(true);
}
