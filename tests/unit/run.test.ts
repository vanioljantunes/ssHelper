import { describe, expect, it, vi } from 'vitest';
import { runSearch } from '../../src/core/run';
import { fromDraft, toArmTerms } from '../../src/core/strategy';
import type { CountOutcome, DraftArm } from '../../src/core/types';

const ok = (count: number): CountOutcome => ({
  status: 'ok',
  count,
  queryTranslation: 't',
  warnings: [],
});
const err: CountOutcome = { status: 'error', kind: 'network', message: 'offline' };

function deps(outcomes: CountOutcome[]) {
  const countQuery = vi.fn(async (query: string) => {
    void query;
    const next = outcomes.shift();
    if (!next) throw new Error('unexpected call');
    return next;
  });
  return {
    countQuery,
    now: () => new Date('2026-09-16T17:05:00.000Z'),
    newId: () => 'run-1',
  };
}

const strategy = (...arms: DraftArm[]) => fromDraft({ arms });

describe('runSearch (contracts/run.md)', () => {
  it('commits pending text before building the query', async () => {
    const d = deps([ok(10), ok(2)]);
    const s = strategy(
      { terms: ['"heart failure"'], pending: '' },
      { terms: [], pending: '' },
      { terms: ['diabetes'], pending: 'sglt2 inhibitors' },
    );
    const outcome = await runSearch(s, d);
    expect(toArmTerms(outcome.strategy)).toEqual([
      ['"heart failure"'],
      [],
      ['diabetes', '"sglt2 inhibitors"'],
    ]);
    expect(d.countQuery.mock.calls[0]?.[0]).toBe(
      '("heart failure") AND (diabetes OR "sglt2 inhibitors")',
    );
  });

  it('stops with issues and makes no request', async () => {
    const d = deps([]);
    const outcome = await runSearch(strategy({ terms: ['(heart'], pending: '' }), d);
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.issues).toHaveLength(1);
    expect(d.countQuery).not.toHaveBeenCalled();
  });

  it('stops when every arm is empty', async () => {
    const d = deps([]);
    const outcome = await runSearch(
      strategy({ terms: [], pending: ' ' }, { terms: [], pending: '' }),
      d,
    );
    expect(outcome.status).toBe('empty');
    expect(d.countQuery).not.toHaveBeenCalled();
  });

  it('counts the query then the meta-analysis query, in order', async () => {
    const d = deps([ok(100), ok(7)]);
    const outcome = await runSearch(strategy({ terms: ['diabetes'], pending: '' }), d);
    expect(d.countQuery.mock.calls.map((c) => c[0])).toEqual([
      '(diabetes)',
      '(diabetes) AND ("meta-analysis")',
    ]);
    expect(outcome.status).toBe('completed');
  });

  it('does not start the second request before the first resolves', async () => {
    let releaseFirst: (value: CountOutcome) => void = () => {};
    const countQuery = vi
      .fn<(q: string) => Promise<CountOutcome>>()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            releaseFirst = r;
          }),
      )
      .mockResolvedValueOnce(ok(1));
    const pending = runSearch(strategy({ terms: ['a'], pending: '' }), {
      countQuery,
      now: () => new Date(),
      newId: () => 'x',
    });
    await Promise.resolve();
    expect(countQuery).toHaveBeenCalledTimes(1);
    releaseFirst(ok(2));
    await pending;
    expect(countQuery).toHaveBeenCalledTimes(2);
  });

  it('returns a failure and no run when both counts fail', async () => {
    const d = deps([err, { ...err, kind: 'rate_limited' }]);
    const outcome = await runSearch(strategy({ terms: ['a'], pending: '' }), d);
    expect(outcome.status).toBe('failed');
    expect(outcome).not.toHaveProperty('run');
    if (outcome.status === 'failed') {
      expect(outcome.failure.result).toEqual(err);
      expect(outcome.failure.metaResult).toMatchObject({ kind: 'rate_limited' });
    }
  });

  it('returns a run when only one count fails, keeping the error outcome', async () => {
    const d = deps([ok(55), err]);
    const outcome = await runSearch(strategy({ terms: ['a'], pending: '' }), d);
    expect(outcome.status).toBe('completed');
    if (outcome.status === 'completed') {
      expect(outcome.run.result).toEqual(ok(55));
      expect(outcome.run.metaResult).toEqual(err);
    }
  });

  it('creates a run with ISO createdAt and an arm snapshot including empty arms', async () => {
    const d = deps([ok(3), ok(1)]);
    const outcome = await runSearch(
      strategy(
        { terms: ['"heart failure"', '"cardiac failure"'], pending: '' },
        { terms: [], pending: '' },
        { terms: ['"sglt2 inhibitors"'], pending: '' },
      ),
      d,
    );
    expect(outcome.status).toBe('completed');
    if (outcome.status !== 'completed') return;
    expect(outcome.run).toEqual({
      id: 'run-1',
      createdAt: '2026-09-16T17:05:00.000Z',
      arms: [
        { terms: ['"heart failure"', '"cardiac failure"'] },
        { terms: [] },
        { terms: ['"sglt2 inhibitors"'] },
      ],
      query: '("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")',
      metaQuery:
        '("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors") AND ("meta-analysis")',
      result: ok(3),
      metaResult: ok(1),
    });
  });
});
