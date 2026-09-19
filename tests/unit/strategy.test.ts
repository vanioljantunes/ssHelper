import { describe, expect, it } from 'vitest';
import {
  addArm,
  commitAllPending,
  commitPending,
  createDefaultStrategy,
  editTerm,
  fromDraft,
  isStrategyEmpty,
  previewArmTerms,
  removeArm,
  removeTerm,
  setPending,
  setTermTag,
  toArmTerms,
  toDraft,
  unquoteTermById,
  validateStrategy,
} from '../../src/core/strategy';
import type { Strategy } from '../../src/core/types';

function withTerms(...arms: string[][]): Strategy {
  return fromDraft({ arms: arms.map((terms) => ({ terms, pending: '' })) });
}

function armId(s: Strategy, index: number): string {
  const arm = s.arms[index];
  if (!arm) throw new Error(`no arm ${index}`);
  return arm.id;
}

function termId(s: Strategy, a: number, t: number): string {
  const term = s.arms[a]?.terms[t];
  if (!term) throw new Error(`no term ${a}/${t}`);
  return term.id;
}

describe('strategy operations', () => {
  it('starts with 3 empty arms', () => {
    const s = createDefaultStrategy();
    expect(s.arms).toHaveLength(3);
    for (const arm of s.arms) {
      expect(arm.terms).toEqual([]);
      expect(arm.pending).toBe('');
    }
    expect(new Set(s.arms.map((a) => a.id)).size).toBe(3);
    expect(isStrategyEmpty(s)).toBe(true);
  });

  it('addArm appends an empty arm and does not mutate the input', () => {
    const s = withTerms(['a']);
    const next = addArm(s);
    expect(next.arms).toHaveLength(2);
    expect(next.arms[1]?.terms).toEqual([]);
    expect(s.arms).toHaveLength(1);
  });

  it('removeArm keeps order and terms of the other arms', () => {
    const s = withTerms(['a'], ['b'], ['c']);
    const next = removeArm(s, armId(s, 1));
    expect(toArmTerms(next)).toEqual([['a'], ['c']]);
  });

  it('removing the last arm leaves one empty arm', () => {
    const s = withTerms(['a']);
    const next = removeArm(s, armId(s, 0));
    expect(next.arms).toHaveLength(1);
    expect(next.arms[0]?.terms).toEqual([]);
  });

  it('commitPending applies the quoting rule and clears pending', () => {
    let s = createDefaultStrategy();
    s = setPending(s, armId(s, 0), 'heart failure');
    s = commitPending(s, armId(s, 0));
    expect(toArmTerms(s)[0]).toEqual(['"heart failure"']);
    expect(s.arms[0]?.pending).toBe('');
  });

  it('commitPending on blank text adds nothing', () => {
    let s = createDefaultStrategy();
    s = setPending(s, armId(s, 0), '   ');
    s = commitPending(s, armId(s, 0));
    expect(s.arms[0]?.terms).toEqual([]);
  });

  it('commitAllPending commits every arm', () => {
    let s = createDefaultStrategy();
    s = setPending(s, armId(s, 0), 'heart failure');
    s = setPending(s, armId(s, 2), 'diabetes');
    s = commitAllPending(s);
    expect(toArmTerms(s)).toEqual([['"heart failure"'], [], ['diabetes']]);
    expect(s.arms.every((a) => a.pending === '')).toBe(true);
  });

  it('editTerm re-applies the quoting rule and keeps the id', () => {
    const s = withTerms(['cardiac failure']);
    const id = termId(s, 0, 0);
    const next = editTerm(s, armId(s, 0), id, 'cardiac failure');
    expect(next.arms[0]?.terms[0]).toEqual({ id, text: '"cardiac failure"' });
    const single = editTerm(next, armId(s, 0), id, 'heart');
    expect(single.arms[0]?.terms[0]?.text).toBe('heart');
  });

  it('editTerm with empty text removes the term', () => {
    const s = withTerms(['a', 'b']);
    const next = editTerm(s, armId(s, 0), termId(s, 0, 0), '  ');
    expect(toArmTerms(next)).toEqual([['b']]);
  });

  it('removeTerm removes only that term', () => {
    const s = withTerms(['a', 'b', 'c']);
    const next = removeTerm(s, armId(s, 0), termId(s, 0, 1));
    expect(toArmTerms(next)).toEqual([['a', 'c']]);
  });

  it('unquoteTermById removes quotes only', () => {
    const s = withTerms(['"heart failure"[tiab]']);
    const next = unquoteTermById(s, armId(s, 0), termId(s, 0, 0));
    expect(toArmTerms(next)).toEqual([['heart failure[tiab]']]);
  });

  it('keeps duplicate terms in one arm', () => {
    let s = createDefaultStrategy();
    for (let i = 0; i < 2; i += 1) {
      s = setPending(s, armId(s, 0), 'diabetes');
      s = commitPending(s, armId(s, 0));
    }
    expect(toArmTerms(s)[0]).toEqual(['diabetes', 'diabetes']);
  });

  it('validateStrategy returns issues for committed and pending text', () => {
    let s = withTerms(['(heart', 'ok'], ['"heart failure']);
    s = setPending(s, armId(s, 1), 'x)');
    const issues = validateStrategy(s);
    expect(issues).toEqual([
      { armId: armId(s, 0), termId: termId(s, 0, 0), kind: 'unbalanced_parentheses' },
      { armId: armId(s, 1), termId: termId(s, 1, 0), kind: 'unbalanced_quotes' },
      { armId: armId(s, 1), kind: 'unbalanced_parentheses' },
    ]);
    expect(validateStrategy(withTerms(['a'], []))).toEqual([]);
  });

  it('isStrategyEmpty considers pending text', () => {
    let s = createDefaultStrategy();
    s = setPending(s, armId(s, 1), 'x');
    expect(isStrategyEmpty(s)).toBe(false);
    expect(isStrategyEmpty(setPending(s, armId(s, 1), '  '))).toBe(true);
  });

  it('previewArmTerms includes pending text as it would be committed', () => {
    let s = withTerms(['a']);
    s = setPending(s, armId(s, 0), 'heart failure');
    expect(previewArmTerms(s)).toEqual([['a', '"heart failure"']]);
  });

  it('toDraft and fromDraft round trip', () => {
    let s = withTerms(['a', '"b c"'], []);
    s = setPending(s, armId(s, 1), 'typed');
    const draft = toDraft(s);
    expect(draft).toEqual({
      arms: [
        { terms: ['a', '"b c"'], pending: '' },
        { terms: [], pending: 'typed' },
      ],
    });
    expect(toDraft(fromDraft(draft))).toEqual(draft);
  });

  it('fromDraft with no arms gives one empty arm', () => {
    expect(fromDraft({ arms: [] }).arms).toHaveLength(1);
  });
});

describe('setTermTag (FR-027)', () => {
  it('sets and clears the field tag of one term', () => {
    const s = withTerms(['"heart failure"', 'diabetes']);
    const id = armId(s, 0);
    const termId = s.arms[0]!.terms[0]!.id;
    const tagged = setTermTag(s, id, termId, '[tiab]');
    expect(toArmTerms(tagged)[0]).toEqual(['"heart failure"[tiab]', 'diabetes']);
    expect(toArmTerms(setTermTag(tagged, id, termId, ''))[0]).toEqual([
      '"heart failure"',
      'diabetes',
    ]);
  });
});
