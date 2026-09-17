import { describe, expect, it } from 'vitest';
import { doiOrgUrl, pubmedDoiUrl, pubmedSearchUrl } from '../../src/pubmed/links';

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

describe('study links', () => {
  it('pubmedDoiUrl searches PubMed for the DOI field only, which opens the article page', () => {
    const url = new URL(pubmedDoiUrl('10.1016/S0140-6736(20)30183-5'));
    expect(url.origin).toBe('https://pubmed.ncbi.nlm.nih.gov');
    expect(url.searchParams.get('term')).toBe('"10.1016/S0140-6736(20)30183-5"[doi]');
  });

  it('doiOrgUrl resolves the DOI through doi.org and keeps its slashes', () => {
    expect(doiOrgUrl('10.1186/s43055-023-01181-z')).toBe(
      'https://doi.org/10.1186/s43055-023-01181-z',
    );
    expect(doiOrgUrl('10.1002/(SICI)1097-0258<2::AID>3.0.CO;2-Z')).toBe(
      'https://doi.org/10.1002/(SICI)1097-0258%3C2%3A%3AAID%3E3.0.CO%3B2-Z',
    );
  });
});
