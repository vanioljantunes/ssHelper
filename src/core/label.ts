/**
 * Study label "Lastname, Year" (FR-024). The name is trimmed and keeps its capitalisation;
 * a missing year gives only the name, and a missing name gives no label.
 */
export function formatStudyLabel(
  family: string | null | undefined,
  year: number | null | undefined,
): string | null {
  const name = family?.trim() ?? '';
  if (name === '') return null;
  return typeof year === 'number' && Number.isInteger(year) ? `${name}, ${year}` : name;
}
