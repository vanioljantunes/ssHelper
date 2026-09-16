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
}
