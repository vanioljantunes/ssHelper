import { describe, expect, it } from 'vitest';
import {
  defaultMinYear,
  familyName,
  recordLabel,
  YEAR_SPAN,
  yearOptions,
  type PriorRecord,
} from '../../src/core/prior';

const at = (year: number) => new Date(`${year}-06-15T12:00:00Z`);

const record = (over: Partial<PriorRecord> = {}): PriorRecord => ({
  pmid: '39000001',
  author: 'Li',
  year: 2026,
  title: 'Diffusion MRI in early Alzheimer disease',
  pmcid: null,
  ...over,
});

describe('yearOptions', () => {
  it('starts at the current year and runs YEAR_SPAN years back', () => {
    const years = yearOptions(at(2026));
    expect(years[0]).toBe(2026);
    expect(years).toHaveLength(YEAR_SPAN + 1);
    expect(years[years.length - 1]).toBe(2026 - YEAR_SPAN);
  });
});

describe('defaultMinYear', () => {
  it('filters to the last five years when more than five are found', () => {
    expect(defaultMinYear(97, at(2026))).toBe(2021);
    expect(defaultMinYear(6, at(2026))).toBe(2021);
  });

  it('leaves the filter empty at five or fewer', () => {
    expect(defaultMinYear(5, at(2026))).toBeNull();
    expect(defaultMinYear(0, at(2026))).toBeNull();
  });
});

describe('recordLabel', () => {
  it('names a record "Author, Year"', () => {
    expect(recordLabel(record())).toBe('Li, 2026');
    expect(recordLabel(record({ author: 'Hassanpour H' }))).toBe('Hassanpour, 2026');
  });

  it('falls back when the year or the author is missing', () => {
    expect(recordLabel(record({ year: null }))).toBe('Li');
    expect(recordLabel(record({ author: '  ' }))).toBe('2026');
    expect(recordLabel(record({ author: '', year: null }))).toBe('39000001');
  });
});

describe('familyName', () => {
  it('drops the initials PubMed appends to the first author', () => {
    expect(familyName('Hassanpour H')).toBe('Hassanpour');
    expect(familyName('Fidah MFA')).toBe('Fidah');
    expect(familyName('van der Berg JK')).toBe('van der Berg');
  });

  it('leaves a bare surname alone', () => {
    expect(familyName('Li')).toBe('Li');
    expect(familyName('  Schulz  ')).toBe('Schulz');
  });
});
