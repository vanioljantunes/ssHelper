import { describe, expect, it } from 'vitest';
import { parseStrategy, type Advisory } from '../../src/core/parse';

const bladder = `("Bladder cancer" OR "Bladder neoplasm*" OR "Bladder tumor*" OR
"Urinary bladder cancer" OR "Urinary bladder neoplasm*" OR
"Urothelial carcinoma" OR "Bladder carcinoma")
AND
("Apparent diffusion coefficient" OR "Apparent diffusion coefficient value*" OR
ADC OR "ADC value*" OR "Diffusion-weighted imaging" OR
"Diffusion weighted imaging" OR DWI OR
"Diffusion-weighted MRI" OR "Diffusion weighted MRI")`;

describe('parseStrategy', () => {
  it('splits a multi-line strategy into arms and terms as written', () => {
    const result = parseStrategy(bladder);
    expect(result).toEqual({
      ok: true,
      advisories: [],
      arms: [
        [
          '"Bladder cancer"',
          '"Bladder neoplasm*"',
          '"Bladder tumor*"',
          '"Urinary bladder cancer"',
          '"Urinary bladder neoplasm*"',
          '"Urothelial carcinoma"',
          '"Bladder carcinoma"',
        ],
        [
          '"Apparent diffusion coefficient"',
          '"Apparent diffusion coefficient value*"',
          'ADC',
          '"ADC value*"',
          '"Diffusion-weighted imaging"',
          '"Diffusion weighted imaging"',
          'DWI',
          '"Diffusion-weighted MRI"',
          '"Diffusion weighted MRI"',
        ],
      ],
    });
  });

  it('keeps field tags attached to their term, including tags with spaces', () => {
    expect(
      parseStrategy('("heart failure"[Mesh Terms] OR cardiac*[tiab]) AND sglt2[tiab]'),
    ).toEqual({
      ok: true,
      advisories: [],
      arms: [['"heart failure"[Mesh Terms]', 'cardiac*[tiab]'], ['sglt2[tiab]']],
    });
  });

  it('accepts arms without parentheses and a single term', () => {
    expect(parseStrategy('diabetes')).toEqual({
      ok: true,
      advisories: [],
      arms: [['diabetes']],
    });
    expect(parseStrategy('diabetes AND (a OR b)')).toEqual({
      ok: true,
      advisories: [],
      arms: [['diabetes'], ['a', 'b']],
    });
  });

  it('removes outer parentheses around the whole strategy', () => {
    expect(parseStrategy('((a OR b) AND (c))')).toEqual({
      ok: true,
      advisories: [],
      arms: [['a', 'b'], ['c']],
    });
  });

  it('quotes a multi-word body by the commit rule', () => {
    expect(parseStrategy('(heart failure OR hf) AND sglt2')).toEqual({
      ok: true,
      advisories: [],
      arms: [['"heart failure"', 'hf'], ['sglt2']],
    });
  });

  it('quotes a multi-word body and keeps its field tag outside the quotes', () => {
    expect(parseStrategy('(heart failure[tiab] OR hf[tiab]) AND sglt2[tiab]')).toEqual({
      ok: true,
      advisories: [],
      arms: [['"heart failure"[tiab]', 'hf[tiab]'], ['sglt2[tiab]']],
    });
  });

  it('never quotes twice', () => {
    expect(parseStrategy('"heart failure"[Mesh Terms] AND sglt2')).toEqual({
      ok: true,
      advisories: [],
      arms: [['"heart failure"[Mesh Terms]'], ['sglt2']],
    });
  });

  it('is deterministic', () => {
    expect(parseStrategy(bladder)).toEqual(parseStrategy(bladder));
  });

  it.each([
    ['', 'empty'],
    ['   \n ', 'empty'],
    ['(a OR b', 'unbalanced_parentheses'],
    ['a OR b)', 'unbalanced_parentheses'],
    ['("heart failure OR b)', 'unbalanced_quotes'],
    ['(a OR (b AND c)) AND d', 'nested_groups'],
    ['a OR b AND c', 'mixed_operators'],
    ['(x) AND (a AND b)', 'mixed_operators'],
    ['(a OR b) c', 'missing_operator'],
    ['(a OR ) AND b', 'missing_term'],
    ['a AND AND b', 'missing_term'],
    ['() AND b', 'missing_term'],
  ])('rejects %j with %s and imports nothing', (input, error) => {
    const result = parseStrategy(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(error);
  });
});

describe('parseStrategy advisories', () => {
  const advisoriesOf = (text: string): Advisory[] => {
    const result = parseStrategy(text);
    if (!result.ok) throw new Error(`expected a successful parse, got ${result.error}`);
    return result.advisories;
  };

  it('drops a NOT and the operand after it, and keeps the rest', () => {
    expect(parseStrategy('a NOT b')).toEqual({
      ok: true,
      arms: [['a']],
      advisories: [{ kind: 'not_clause', text: 'NOT b' }],
    });
  });

  it('drops a NOT group between arms', () => {
    expect(parseStrategy('(a OR b) AND c NOT (review OR editorial)')).toEqual({
      ok: true,
      arms: [['a', 'b'], ['c']],
      advisories: [{ kind: 'not_clause', text: 'NOT (review OR editorial)' }],
    });
  });

  it('drops a NOT used inside an arm', () => {
    expect(parseStrategy('(a OR b NOT c) AND d')).toEqual({
      ok: true,
      arms: [['a', 'b'], ['d']],
      advisories: [{ kind: 'not_clause', text: 'NOT c' }],
    });
  });

  it('drops methodological filters wherever they sit', () => {
    expect(parseStrategy('(a OR b) AND english[lang]')).toEqual({
      ok: true,
      arms: [['a', 'b']],
      advisories: [{ kind: 'filter', text: 'english[lang]' }],
    });
    expect(advisoriesOf('(a OR english[Lang]) AND b')).toEqual([
      { kind: 'filter', text: 'english[Lang]' },
    ]);
    expect(advisoriesOf('(a OR b) AND (humans[mh])')).toEqual([
      { kind: 'filter', text: 'humans[mh]' },
    ]);
    expect(advisoriesOf('(a OR b) AND review[pt]')).toEqual([
      { kind: 'filter', text: 'review[pt]' },
    ]);
  });

  it('keeps a MeSH term while dropping the humans check next to it', () => {
    expect(parseStrategy('"heart failure"[Mesh] AND humans[mh]')).toEqual({
      ok: true,
      arms: [['"heart failure"[Mesh]']],
      advisories: [{ kind: 'filter', text: 'humans[mh]' }],
    });
  });

  it('drops date limits, including a date range', () => {
    expect(parseStrategy('(a OR b) AND ("2010"[dp] : "3000"[dp])')).toEqual({
      ok: true,
      arms: [['a', 'b']],
      advisories: [{ kind: 'date_limit', text: '"2010"[dp] : "3000"[dp]' }],
    });
    expect(advisoriesOf('(a OR b) AND 2015:2020[pdat]')).toEqual([
      { kind: 'date_limit', text: '2015:2020[pdat]' },
    ]);
  });

  it('drops history line references', () => {
    expect(parseStrategy('#1 AND (a OR b)')).toEqual({
      ok: true,
      arms: [['a', 'b']],
      advisories: [{ kind: 'line_reference', text: '#1' }],
    });
  });

  it('lists every dropped part in the order it was written', () => {
    expect(advisoriesOf('#3 AND (a OR b) AND english[lang] NOT review[pt]')).toEqual([
      { kind: 'not_clause', text: 'NOT review[pt]' },
      { kind: 'line_reference', text: '#3' },
      { kind: 'filter', text: 'english[lang]' },
    ]);
  });

  it('refuses the import when every part would be dropped', () => {
    for (const input of ['#1 AND #2', 'english[lang]', '("2010"[dp] : "3000"[dp])']) {
      const result = parseStrategy(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('all_dropped');
    }
  });

  it('still rejects a dangling NOT', () => {
    const result = parseStrategy('NOT a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('missing_term');
  });

  it('is deterministic', () => {
    const input = '(a OR b) AND c NOT review[pt]';
    expect(parseStrategy(input)).toEqual(parseStrategy(input));
  });
});
