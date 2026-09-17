import { describe, expect, it } from 'vitest';
import { buildQuery, withMetaAnalysisArm } from '../../src/core/query';

describe('buildQuery (contracts/query-builder.md)', () => {
  const rows: [string[][], string | null][] = [
    [
      [['"heart failure"', '"cardiac failure"'], [], ['"sglt2 inhibitors"']],
      '("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")',
    ],
    [[[], ['diabetes'], []], '(diabetes)'],
    [[[], [], []], null],
  ];

  it.each(rows)('buildQuery(%j) -> %j', (arms, expected) => {
    expect(buildQuery(arms)).toBe(expected);
  });

  it('returns null for no arms', () => {
    expect(buildQuery([])).toBeNull();
  });

  it('is deterministic', () => {
    for (const [arms] of rows) {
      expect(buildQuery(arms)).toBe(buildQuery(arms));
    }
  });

  it('sends terms exactly as given, including operators and tags', () => {
    expect(buildQuery([['heart AND lung', 'cardio*', '"heart failure"[tiab]']])).toBe(
      '(heart AND lung OR cardio* OR "heart failure"[tiab])',
    );
  });
});

describe('withMetaAnalysisArm (contracts/query-builder.md)', () => {
  it('appends the quoted meta-analysis arm', () => {
    expect(withMetaAnalysisArm('(diabetes)')).toBe('(diabetes) AND ("meta-analysis")');
  });

  it('is deterministic', () => {
    expect(withMetaAnalysisArm('(a) AND (b)')).toBe(withMetaAnalysisArm('(a) AND (b)'));
  });
});
