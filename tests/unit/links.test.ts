import { describe, expect, it } from 'vitest';
import { pubmedSearchUrl } from '../../src/pubmed/links';

describe('pubmedSearchUrl', () => {
  it('builds a PubMed search URL with the exact query encoded', () => {
    const query = '("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")';
    const url = pubmedSearchUrl(query);
    expect(url.startsWith('https://pubmed.ncbi.nlm.nih.gov/?term=')).toBe(true);
    expect(url).not.toContain(' ');
    expect(url).not.toContain('"');
    expect(new URL(url).searchParams.get('term')).toBe(query);
  });

  it('keeps truncation, field tags, and special characters intact', () => {
    const query = '("Bladder neoplasm*"[tiab] OR ADC) AND (#1 & 50%)';
    expect(new URL(pubmedSearchUrl(query)).searchParams.get('term')).toBe(query);
  });
});
