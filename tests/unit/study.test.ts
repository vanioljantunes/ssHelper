import { describe, expect, it, vi } from 'vitest';
import {
  addStudy,
  checkStudy,
  createDefaultStudies,
  doiExistsQuery,
  fromStudyInputs,
  normalizeDoi,
  removeStudy,
  setStudyInput,
  studyQuery,
  toStudyInputs,
} from '../../src/core/study';
import type { CountOutcome } from '../../src/core/types';

const ok = (count: number): CountOutcome => ({
  status: 'ok',
  count,
  queryTranslation: 't',
  warnings: [],
});
const fail: CountOutcome = { status: 'error', kind: 'network', message: 'offline' };
const query = '("heart failure") AND ("sglt2 inhibitors")';
const doi = '10.1056/NEJMoa1911303';
const now = () => new Date('2026-09-16T10:00:00.000Z');

describe('normalizeDoi', () => {
  it('accepts a bare DOI', () => {
    expect(normalizeDoi(doi)).toBe(doi);
    expect(normalizeDoi(`  ${doi}\n`)).toBe(doi);
  });

  it('strips doi.org link prefixes', () => {
    expect(normalizeDoi(`https://doi.org/${doi}`)).toBe(doi);
    expect(normalizeDoi(`http://doi.org/${doi}`)).toBe(doi);
    expect(normalizeDoi(`https://dx.doi.org/${doi}`)).toBe(doi);
    expect(normalizeDoi(`http://dx.doi.org/${doi}`)).toBe(doi);
    expect(normalizeDoi(`doi.org/${doi}`)).toBe(doi);
    expect(normalizeDoi(`HTTPS://DOI.ORG/${doi}`)).toBe(doi);
  });

  it('strips a doi: prefix', () => {
    expect(normalizeDoi(`doi:${doi}`)).toBe(doi);
    expect(normalizeDoi(`DOI: ${doi}`)).toBe(doi);
  });

  it('decodes percent-encoding', () => {
    expect(normalizeDoi('https://doi.org/10.1016%2FS0140-6736%2820%2930183-5')).toBe(
      '10.1016/S0140-6736(20)30183-5',
    );
  });

  it('keeps parentheses in a DOI', () => {
    expect(normalizeDoi('10.1016/S0140-6736(20)30183-5')).toBe('10.1016/S0140-6736(20)30183-5');
  });

  it('rejects invalid strings', () => {
    for (const raw of [
      '',
      '   ',
      'heart failure',
      '10.12/abc',
      '11.1056/NEJMoa1911303',
      '10.1056/',
      '10.1056/NEJM oa1911303',
      '10.1056/NEJM"oa',
      'https://pubmed.ncbi.nlm.nih.gov/12345678/',
      '10.1056%ZZ/bad',
    ]) {
      expect(normalizeDoi(raw)).toBeNull();
    }
  });
});

describe('study queries', () => {
  it('adds the DOI as an extra arm', () => {
    expect(studyQuery(query, doi)).toBe(`${query} AND ("${doi}"[doi])`);
  });

  it('checks the DOI alone', () => {
    expect(doiExistsQuery(doi)).toBe(`"${doi}"[doi]`);
  });
});

describe('checkStudy', () => {
  it('found: one request with the extra arm', async () => {
    const countQuery = vi.fn(async () => ok(1));
    const result = await checkStudy(query, `https://doi.org/${doi}`, countQuery, now);
    expect(result).toEqual({
      status: 'found',
      doi,
      query,
      checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(countQuery.mock.calls).toEqual([[studyQuery(query, doi)]]);
  });

  it('not_found: zero with the strategy, present in PubMed (2 requests)', async () => {
    const countQuery = vi.fn(async (q: string) => (q === doiExistsQuery(doi) ? ok(1) : ok(0)));
    const result = await checkStudy(query, doi, countQuery, now);
    expect(result.status).toBe('not_found');
    expect(countQuery.mock.calls).toEqual([[studyQuery(query, doi)], [doiExistsQuery(doi)]]);
  });

  it('not_in_pubmed: the DOI alone retrieves nothing', async () => {
    const countQuery = vi.fn(async () => ok(0));
    const result = await checkStudy(query, doi, countQuery, now);
    expect(result).toEqual({
      status: 'not_in_pubmed',
      doi,
      query,
      checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(countQuery).toHaveBeenCalledTimes(2);
  });

  it('invalid: no request is made', async () => {
    const countQuery = vi.fn(async () => ok(1));
    const result = await checkStudy(query, 'not a doi', countQuery, now);
    expect(result).toEqual({
      status: 'invalid',
      doi: null,
      query,
      checkedAt: '2026-09-16T10:00:00.000Z',
    });
    expect(countQuery).not.toHaveBeenCalled();
  });

  it('error on the first request', async () => {
    const countQuery = vi.fn(async () => fail);
    const result = await checkStudy(query, doi, countQuery, now);
    expect(result).toEqual({
      status: 'error',
      doi,
      query,
      checkedAt: '2026-09-16T10:00:00.000Z',
      message: 'offline',
    });
    expect(countQuery).toHaveBeenCalledTimes(1);
  });

  it('error on the second request is never reported as not found', async () => {
    const countQuery = vi.fn(async (q: string) => (q === doiExistsQuery(doi) ? fail : ok(0)));
    const result = await checkStudy(query, doi, countQuery, now);
    expect(result).toMatchObject({ status: 'error', message: 'offline' });
    expect(countQuery).toHaveBeenCalledTimes(2);
  });
});

describe('study list', () => {
  it('starts with 3 empty studies', () => {
    const studies = createDefaultStudies();
    expect(toStudyInputs(studies)).toEqual(['', '', '']);
    expect(new Set(studies.map((s) => s.id)).size).toBe(3);
  });

  it('adds, edits and removes studies, keeping at least one', () => {
    let studies = addStudy(createDefaultStudies());
    expect(studies).toHaveLength(4);
    studies = setStudyInput(studies, studies[1]?.id ?? '', doi);
    expect(toStudyInputs(studies)).toEqual(['', doi, '', '']);
    studies = removeStudy(studies, studies[0]?.id ?? '');
    expect(toStudyInputs(studies)).toEqual([doi, '', '']);
    for (const study of [...studies]) studies = removeStudy(studies, study.id);
    expect(toStudyInputs(studies)).toEqual(['']);
  });

  it('restores studies from draft inputs', () => {
    expect(toStudyInputs(fromStudyInputs(undefined))).toEqual(['', '', '']);
    expect(toStudyInputs(fromStudyInputs([]))).toEqual(['']);
    expect(toStudyInputs(fromStudyInputs([doi, '']))).toEqual([doi, '']);
  });
});
