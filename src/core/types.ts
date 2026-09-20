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

export type CountErrorKind = 'rate_limited' | 'network' | 'http' | 'invalid_response' | 'no_email';

export type CountOutcome =
  | { status: 'ok'; count: number; queryTranslation: string; warnings: string[] }
  | { status: 'error'; kind: CountErrorKind; message: string };

export interface ArmSnapshot {
  terms: string[];
}

/**
 * What the known studies said about one run (FR-030). `notFound` and `unresolved` hold study
 * names; a run with `found === total` and both lists empty was fully retrieved.
 */
export interface RunStudies {
  total: number;
  found: number;
  notFound: string[];
  unresolved: string[];
}

export interface SearchRun {
  id: string;
  createdAt: string;
  arms: ArmSnapshot[];
  query: string;
  metaQuery: string;
  result: CountOutcome;
  metaResult: CountOutcome;
  /** Known-study outcome, attached once the checks finish. Missing in runs saved before FR-030. */
  studies?: RunStudies;
}

export interface DraftArm {
  terms: string[];
  pending: string;
}

/** A saved study box. Drafts saved before FR-024 hold only the input string. */
export interface DraftStudy {
  input: string;
  label: string;
  labelEdited: boolean;
}

export interface Draft {
  arms: DraftArm[];
  /** Known study boxes. Missing in drafts saved before FR-023. */
  studies?: DraftStudy[];
}

export interface Study {
  id: string;
  input: string;
  /** Display name such as "Akcay, 2021"; empty shows the "Study N" placeholder (FR-024). */
  label: string;
  /** True once the researcher typed the label; automatic lookups never overwrite it. */
  labelEdited: boolean;
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
