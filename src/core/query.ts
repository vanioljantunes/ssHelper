export const META_ANALYSIS_ARM = '("meta-analysis")';

/** Non-empty arms as `(t1 OR t2)`, joined with ` AND `. Null when every arm is empty. */
export function buildQuery(arms: string[][]): string | null {
  const parts = arms.filter((terms) => terms.length > 0).map((terms) => `(${terms.join(' OR ')})`);
  return parts.length === 0 ? null : parts.join(' AND ');
}

export function withMetaAnalysisArm(query: string): string {
  return `${query} AND ${META_ANALYSIS_ARM}`;
}

/**
 * The same query restricted to records published in `year` or later, using the PubMed date
 * range field. `3000` is the open upper bound PubMed accepts for "up to now".
 */
export function withYearFloor(query: string, year: number): string {
  return `${query} AND ("${year}"[dp] : "3000"[dp])`;
}
