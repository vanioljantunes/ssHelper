import { describe, expect, it } from 'vitest';
import {
  commitTerm,
  editableBody,
  FIELD_TAGS,
  isQuoted,
  splitTag,
  unquoteTerm,
  validateTerm,
  withTag,
} from '../../src/core/term';

describe('commitTerm (contracts/query-builder.md)', () => {
  const rows: [string, string | null][] = [
    ['heart failure', '"heart failure"'],
    ['  diabetes  ', 'diabetes'],
    ['"heart failure"', '"heart failure"'],
    ['heart failure[tiab]', '"heart failure"[tiab]'],
    ['Heart Failure[Mesh]', '"Heart Failure"[Mesh]'],
    ['cardio*', 'cardio*'],
    ['sglt2[tiab]', 'sglt2[tiab]'],
    ['   ', null],
  ];

  it.each(rows)('commitTerm(%j) -> %j', (input, expected) => {
    expect(commitTerm(input)).toBe(expected);
  });

  it('trims before checking the space rule', () => {
    expect(commitTerm('diabetes ')).toBe('diabetes');
  });

  it('returns null for the empty string', () => {
    expect(commitTerm('')).toBeNull();
  });

  it('does not quote twice when the researcher typed quotes with a tag', () => {
    expect(commitTerm('"heart failure"[tiab]')).toBe('"heart failure"[tiab]');
  });

  it('is idempotent', () => {
    for (const [input] of rows) {
      const once = commitTerm(input);
      if (once !== null) expect(commitTerm(once)).toBe(once);
    }
  });
});

describe('unquoteTerm (contracts/query-builder.md)', () => {
  it.each([
    ['"heart failure"', 'heart failure'],
    ['"heart failure"[tiab]', 'heart failure[tiab]'],
    ['diabetes', 'diabetes'],
  ])('unquoteTerm(%j) -> %j', (input, expected) => {
    expect(unquoteTerm(input)).toBe(expected);
  });
});

describe('validateTerm (contracts/query-builder.md)', () => {
  it.each([
    ['(heart', 'unbalanced_parentheses'],
    ['"heart failure', 'unbalanced_quotes'],
    ['"heart failure"', null],
  ])('validateTerm(%j) -> %j', (input, expected) => {
    expect(validateTerm(input)).toBe(expected);
  });

  it('flags a closing parenthesis before its opening one', () => {
    expect(validateTerm(')heart(')).toBe('unbalanced_parentheses');
  });

  it('accepts balanced nested parentheses', () => {
    expect(validateTerm('(heart OR (cardiac))')).toBeNull();
  });
});

describe('FR-020 invalid terms (T047)', () => {
  it('keeps (heart as typed and marks it invalid', () => {
    const text = commitTerm('(heart');
    expect(text).toBe('(heart');
    expect(validateTerm(text ?? '')).toBe('unbalanced_parentheses');
  });

  it('keeps "heart failure as typed and marks it invalid', () => {
    const text = commitTerm('"heart failure');
    expect(text).toBe('"heart failure');
    expect(validateTerm(text ?? '')).toBe('unbalanced_quotes');
  });
});

describe('helpers', () => {
  it('splitTag separates a trailing field tag', () => {
    expect(splitTag('"heart failure"[tiab]')).toEqual({ body: '"heart failure"', tag: '[tiab]' });
    expect(splitTag('diabetes')).toEqual({ body: 'diabetes', tag: '' });
  });

  it('isQuoted detects a quoted body', () => {
    expect(isQuoted('"heart failure"[tiab]')).toBe(true);
    expect(isQuoted('heart failure')).toBe(false);
    expect(isQuoted('"')).toBe(false);
  });
});

describe('field tags (FR-027)', () => {
  it('offers [tiab] and [Mesh]', () => {
    expect(FIELD_TAGS).toEqual(['[tiab]', '[Mesh]']);
  });

  it('adds, replaces and removes the trailing tag and keeps the quotes', () => {
    expect(withTag('"heart failure"', '[tiab]')).toBe('"heart failure"[tiab]');
    expect(withTag('"heart failure"[tiab]', '[Mesh]')).toBe('"heart failure"[Mesh]');
    expect(withTag('"heart failure"[tiab]', '')).toBe('"heart failure"');
    expect(withTag('diabetes', '[Mesh]')).toBe('diabetes[Mesh]');
  });
});

describe('editableBody (FR-028)', () => {
  it('drops the wrapping quotes and the tag so only the words are edited', () => {
    expect(editableBody('"heart failure"[tiab]')).toBe('heart failure');
    expect(editableBody('"heart failure"')).toBe('heart failure');
    expect(editableBody('diabetes[Mesh]')).toBe('diabetes');
    expect(editableBody('diabetes')).toBe('diabetes');
  });
});
