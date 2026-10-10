import { describe, expect, it } from 'vitest';
import { translate, translateTerm } from '../../src/core/translate';

describe('translateTerm', () => {
  it('maps a tiab phrase to the title/abstract fields of each database', () => {
    expect(translateTerm('"heart failure"[tiab]', 'cochrane')).toBe('"heart failure":ti,ab,kw');
    expect(translateTerm('"heart failure"[tiab]', 'embase')).toBe("'heart failure':ti,ab");
  });

  it('leaves a single word unquoted', () => {
    expect(translateTerm('sacubitril[tiab]', 'cochrane')).toBe('sacubitril:ti,ab,kw');
    expect(translateTerm('sacubitril[tiab]', 'embase')).toBe('sacubitril:ti,ab');
  });

  it('explodes a subject heading', () => {
    expect(translateTerm('"Heart Failure"[Mesh]', 'cochrane')).toBe('[mh "Heart Failure"]');
    expect(translateTerm('"Heart Failure"[Mesh]', 'embase')).toBe("'heart failure'/exp");
  });

  it('explodes a single-word subject heading with quotes in both databases', () => {
    expect(translateTerm('Stroke[Mesh]', 'cochrane')).toBe('[mh "Stroke"]');
    expect(translateTerm('Stroke[Mesh]', 'embase')).toBe("'stroke'/exp");
  });

  it('keeps an untagged term as free text, with the quoting each database uses', () => {
    expect(translateTerm('"heart failure"', 'cochrane')).toBe('"heart failure"');
    expect(translateTerm('"heart failure"', 'embase')).toBe("'heart failure'");
    expect(translateTerm('sacubitril', 'embase')).toBe('sacubitril');
  });

  it('maps the title, abstract and text word tags', () => {
    expect(translateTerm('stroke[ti]', 'cochrane')).toBe('stroke:ti');
    expect(translateTerm('stroke[ab]', 'embase')).toBe('stroke:ab');
    expect(translateTerm('stroke[tw]', 'cochrane')).toBe('stroke:ti,ab,kw');
    expect(translateTerm('stroke[tw]', 'embase')).toBe('stroke:ti,ab,kw');
  });

  it('treats a major topic heading as an exploded heading', () => {
    expect(translateTerm('"Heart Failure"[majr]', 'cochrane')).toBe('[mh "Heart Failure"]');
    expect(translateTerm('"Heart Failure"[majr]', 'embase')).toBe("'heart failure'/exp");
  });

  it('drops a tag it cannot map and keeps the words', () => {
    expect(translateTerm('english[la]', 'cochrane')).toBe('english');
    expect(translateTerm('english[la]', 'embase')).toBe('english');
  });

  it('uses double quotes in Embase when the phrase contains an apostrophe', () => {
    expect(translateTerm('"crohn\'s disease"[tiab]', 'embase')).toBe('"crohn\'s disease":ti,ab');
  });

  it('keeps a wildcard as written', () => {
    expect(translateTerm('cardiomyopath*[tiab]', 'cochrane')).toBe('cardiomyopath*:ti,ab,kw');
    expect(translateTerm('cardiomyopath*[tiab]', 'embase')).toBe('cardiomyopath*:ti,ab');
  });
});

describe('translate', () => {
  const arms = [['"heart failure"[tiab]', '"Heart Failure"[Mesh]'], ['sacubitril[tiab]']];

  it('joins terms with OR and arms with AND', () => {
    expect(translate(arms, 'cochrane').query).toBe(
      '("heart failure":ti,ab,kw OR [mh "Heart Failure"]) AND (sacubitril:ti,ab,kw)',
    );
    expect(translate(arms, 'embase').query).toBe(
      "('heart failure':ti,ab OR 'heart failure'/exp) AND (sacubitril:ti,ab)",
    );
  });

  it('skips empty arms and returns null when every arm is empty', () => {
    expect(translate([[], ['stroke[tiab]'], []], 'embase').query).toBe('(stroke:ti,ab)');
    expect(translate([[], []], 'cochrane').query).toBeNull();
  });

  it('reports each tag it had to drop, once', () => {
    const result = translate([['english[la]', 'humans[la]', 'stroke[tiab]']], 'embase');
    expect(result.droppedTags).toEqual(['[la]']);
  });

  it('reports no dropped tag when every tag maps', () => {
    expect(translate(arms, 'embase').droppedTags).toEqual([]);
  });

  it('names every subject heading it carried over, for review against the thesaurus', () => {
    expect(translate(arms, 'embase').headings).toEqual(['Heart Failure']);
    expect(translate([['stroke[tiab]']], 'embase').headings).toEqual([]);
  });

  it('names a subject heading once however many times it appears', () => {
    const repeated = [['"Heart Failure"[Mesh]'], ['"Heart Failure"[majr]']];
    expect(translate(repeated, 'cochrane').headings).toEqual(['Heart Failure']);
  });

  it('names the terms whose truncation has to be checked', () => {
    const wild = [['cardiomyopath*[tiab]', 'stroke[tiab]']];
    expect(translate(wild, 'cochrane').wildcards).toEqual(['cardiomyopath*[tiab]']);
    expect(translate(arms, 'cochrane').wildcards).toEqual([]);
  });
});
