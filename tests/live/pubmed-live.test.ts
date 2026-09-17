// @vitest-environment node
import { describe, expect, it } from 'vitest';
import strategies from './strategies.json';
import { buildQuery, withMetaAnalysisArm } from '../../src/core/query';
import { runSearch } from '../../src/core/run';
import { fromDraft } from '../../src/core/strategy';
import { buildEsearchUrl, createPubmedClient } from '../../src/pubmed/client';
import { createThrottle } from '../../src/pubmed/throttle';

// Opt-in: runs only with LIVE_PUBMED=1 (vite.config.ts excludes tests/live otherwise).
const LIVE = process.env.LIVE_PUBMED === '1';
const email = import.meta.env.VITE_NCBI_CONTACT_EMAIL ?? '';

// One shared throttle keeps every request in this file at least 350 ms apart.
const throttle = createThrottle();
const client = createPubmedClient({
  fetchFn: (input, init) => fetch(input, init),
  email,
  throttle,
});

async function directCount(query: string): Promise<number> {
  const response = await throttle.schedule(() => fetch(buildEsearchUrl(query, email)));
  const body = (await response.json()) as { esearchresult: { count: string } };
  return Number(body.esearchresult.count);
}

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index] ?? Number.POSITIVE_INFINITY;
}

describe.skipIf(!LIVE)('live PubMed (T040)', () => {
  it('has a real contact email configured', () => {
    expect(email).not.toBe('');
    expect(email).not.toBe('test@example.org');
  });

  it('(a) counts ("heart failure") AND ("meta-analysis")', async () => {
    const outcome = await client.countQuery(withMetaAnalysisArm('("heart failure")'));
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.count).toBeGreaterThan(0);
  });

  it('(b) a nonsense quoted phrase returns 0 with a quotedphrasesnotfound warning', async () => {
    const phrase = '"zzqxunfoundphrase qqxzv"';
    const outcome = await client.countQuery(phrase);
    expect(outcome).toMatchObject({ status: 'ok', count: 0 });
    if (outcome.status === 'ok') expect(outcome.warnings).toContain(phrase);
  });

  it('(c, d) SC-002 and SC-003: 20 strategies match direct esearch; p95 run time under 5 s', async () => {
    expect(strategies).toHaveLength(20);
    const durations: number[] = [];
    for (const arms of strategies as string[][][]) {
      const query = buildQuery(arms);
      expect(query).not.toBeNull();
      const started = performance.now();
      const outcome = await runSearch(
        fromDraft({ arms: arms.map((terms) => ({ terms, pending: '' })) }),
        { countQuery: (q) => client.countQuery(q), now: () => new Date(), newId: () => 'live' },
      );
      durations.push(performance.now() - started);

      expect(outcome.status).toBe('completed');
      if (outcome.status !== 'completed') continue;
      expect(outcome.run.query).toBe(query);
      expect(outcome.run.result.status).toBe('ok');
      expect(outcome.run.metaResult.status).toBe('ok');
      if (outcome.run.result.status === 'ok') {
        expect(outcome.run.result.count, query ?? '').toBe(await directCount(query ?? ''));
      }
    }
    const p95 = percentile95(durations);
    console.info(
      `SC-003 run durations (ms): p95=${Math.round(p95)} max=${Math.round(Math.max(...durations))}`,
    );
    expect(p95).toBeLessThan(5000);
  }, 180_000);
});
