import { buildQuery, withMetaAnalysisArm } from './query';
import { commitAllPending, toArmTerms, validateStrategy } from './strategy';
import type { CountOutcome, Issue, SearchRun, Strategy } from './types';

export interface RunDeps {
  countQuery: (query: string) => Promise<CountOutcome>;
  now: () => Date;
  newId: () => string;
}

export interface RunFailure {
  query: string;
  metaQuery: string;
  result: CountOutcome;
  metaResult: CountOutcome;
}

export type RunSearchResult =
  | { status: 'invalid'; strategy: Strategy; issues: Issue[] }
  | { status: 'empty'; strategy: Strategy }
  | { status: 'failed'; strategy: Strategy; failure: RunFailure }
  | { status: 'completed'; strategy: Strategy; run: SearchRun };

/** Orchestrates one search run (contracts/run.md). No network or storage code here. */
export async function runSearch(strategy: Strategy, deps: RunDeps): Promise<RunSearchResult> {
  const committed = commitAllPending(strategy);
  const issues = validateStrategy(committed);
  if (issues.length > 0) return { status: 'invalid', strategy: committed, issues };

  const armTerms = toArmTerms(committed);
  const query = buildQuery(armTerms);
  if (query === null) return { status: 'empty', strategy: committed };

  const createdAt = deps.now().toISOString();
  const metaQuery = withMetaAnalysisArm(query);
  const result = await deps.countQuery(query);
  const metaResult = await deps.countQuery(metaQuery);

  if (result.status === 'error' && metaResult.status === 'error') {
    return {
      status: 'failed',
      strategy: committed,
      failure: { query, metaQuery, result, metaResult },
    };
  }

  return {
    status: 'completed',
    strategy: committed,
    run: {
      id: deps.newId(),
      createdAt,
      arms: armTerms.map((terms) => ({ terms })),
      query,
      metaQuery,
      result,
      metaResult,
    },
  };
}
