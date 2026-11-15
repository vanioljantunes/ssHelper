import { describe, expect, it } from 'vitest';
import {
  buildStrategyPrompt,
  cleanConcept,
  MAX_PROMPT_CONCEPTS,
  promptStructure,
} from '../../src/core/prompt';
import { promptText } from '../../src/i18n/en';

describe('promptStructure', () => {
  it('joins one empty group per concept with AND', () => {
    expect(promptStructure(1)).toBe('()');
    expect(promptStructure(3)).toBe('() AND () AND ()');
  });
});

describe('cleanConcept', () => {
  it('trims, collapses spaces and drops double quotes', () => {
    expect(cleanConcept('  "heart   failure" ')).toBe('heart failure');
  });
});

describe('buildStrategyPrompt', () => {
  it('returns null when every concept is empty', () => {
    expect(buildStrategyPrompt(['', '  '], promptText)).toBeNull();
  });

  it('builds the two-group prompt', () => {
    const prompt = buildStrategyPrompt(['Edinburgh criteria', 'CT'], promptText);
    expect(prompt).toBe(
      [
        'Please make a search strategy for PubMed with this structure:',
        '() AND ()',
        'The first parenthesis should be about "Edinburgh criteria" and the second about "CT". ' +
          "Please don't use keywords like MeSH or [tiab], and don't create more parentheses or ANDs. " +
          'Just increase the number of synonyms inside each ().',
        'Give me a single result so I can paste it in PubMed.',
      ].join('\n\n'),
    );
  });

  it('lists three concepts with commas and a final and', () => {
    const prompt = buildStrategyPrompt(['a', 'b', 'c'], promptText) ?? '';
    expect(prompt).toContain('() AND () AND ()');
    expect(prompt).toContain(
      'The first parenthesis should be about "a", the second about "b" and the third about "c".',
    );
  });

  it('uses the single sentence for one concept and skips empty boxes', () => {
    const prompt = buildStrategyPrompt(['', 'sepsis', ''], promptText) ?? '';
    expect(prompt).toContain('\n\n()\n\n');
    expect(prompt).toContain('The parenthesis should be about "sepsis".');
  });

  it('keeps at most the allowed number of concepts', () => {
    const many = Array.from({ length: MAX_PROMPT_CONCEPTS + 2 }, (_, i) => `c${i}`);
    const prompt = buildStrategyPrompt(many, promptText) ?? '';
    expect(prompt.split('()').length - 1).toBe(MAX_PROMPT_CONCEPTS + 1);
  });
});
