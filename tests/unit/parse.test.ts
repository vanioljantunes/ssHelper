import { describe, expect, it } from 'vitest';
import { parseStrategy } from '../../src/core/parse';

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
    expect(parseStrategy('("heart failure"[Mesh Terms] OR cardiac*[tiab]) AND sglt2[tiab]')).toEqual({
      ok: true,
      arms: [['"heart failure"[Mesh Terms]', 'cardiac*[tiab]'], ['sglt2[tiab]']],
    });
  });

  it('accepts arms without parentheses and a single term', () => {
    expect(parseStrategy('diabetes')).toEqual({ ok: true, arms: [['diabetes']] });
    expect(parseStrategy('diabetes AND (a OR b)')).toEqual({
      ok: true,
      arms: [['diabetes'], ['a', 'b']],
    });
  });

  it('removes outer parentheses around the whole strategy', () => {
    expect(parseStrategy('((a OR b) AND (c))')).toEqual({ ok: true, arms: [['a', 'b'], ['c']] });
  });

  it('keeps unquoted multi-word terms as written', () => {
    expect(parseStrategy('(heart failure OR hf) AND sglt2')).toEqual({
      ok: true,
      arms: [['heart failure', 'hf'], ['sglt2']],
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
    ['a NOT b', 'not_supported'],
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
