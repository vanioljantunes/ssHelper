export interface Term {
  id: string;
  text: string;
}

export interface Arm {
  id: string;
  terms: Term[];
  pending: string;
}

export interface Strategy {
  arms: Arm[];
}

export type IssueKind = 'unbalanced_parentheses' | 'unbalanced_quotes';

export interface Issue {
  armId: string;
  termId?: string;
  kind: IssueKind;
}

export type CountErrorKind = 'rate_limited' | 'network' | 'http' | 'invalid_response';

export type CountOutcome =
  | { status: 'ok'; count: number; queryTranslation: string; warnings: string[] }
  | { status: 'error'; kind: CountErrorKind; message: string };

export interface ArmSnapshot {
  terms: string[];
}

export interface SearchRun {
  id: string;
  createdAt: string;
  arms: ArmSnapshot[];
  query: string;
  metaQuery: string;
  result: CountOutcome;
  metaResult: CountOutcome;
}

export interface DraftArm {
  terms: string[];
  pending: string;
}

export interface Draft {
  arms: DraftArm[];
  /** Known study inputs (DOI boxes). Missing in drafts saved before FR-023. */
  studies?: string[];
}

export interface Study {
  id: string;
  input: string;
}

/**
 * Outcome of checking one known study against a strategy query (FR-023).
 * `not_in_pubmed`, `invalid`, and `error` are Unresolved and never mean "not found".
 */
export type StudyCheck =
  | { status: 'invalid'; doi: null; query: string; checkedAt: string }
  | {
      status: 'found' | 'not_found' | 'not_in_pubmed';
      doi: string;
      query: string;
      checkedAt: string;
    }
  | { status: 'error'; doi: string; query: string; checkedAt: string; message: string };
