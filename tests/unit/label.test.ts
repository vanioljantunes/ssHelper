import { describe, expect, it } from 'vitest';
import { formatStudyLabel } from '../../src/core/label';

describe('formatStudyLabel', () => {
  it('joins the last name and year with a comma and space', () => {
    expect(formatStudyLabel('Akcay', 2021)).toBe('Akcay, 2021');
  });

  it('trims whitespace and keeps the original capitalisation', () => {
    expect(formatStudyLabel('  van der Berg ', 2019)).toBe('van der Berg, 2019');
    expect(formatStudyLabel('McDONALD', 2020)).toBe('McDONALD, 2020');
  });

  it('returns only the name when the year is missing', () => {
    expect(formatStudyLabel('Akcay', null)).toBe('Akcay');
    expect(formatStudyLabel('Akcay', undefined)).toBe('Akcay');
    expect(formatStudyLabel('Akcay', Number.NaN)).toBe('Akcay');
  });

  it('returns null when there is no name', () => {
    expect(formatStudyLabel(null, 2021)).toBeNull();
    expect(formatStudyLabel(undefined, 2021)).toBeNull();
    expect(formatStudyLabel('   ', 2021)).toBeNull();
  });
});
