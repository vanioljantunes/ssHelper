import { Fragment, type KeyboardEvent } from 'react';
import type { Arm, Issue } from '../core/types';
import { en, t } from '../i18n/en';
import { TermBox } from './TermBox';

export interface ArmHandlers {
  onDeleteArm: (armId: string) => void;
  onPendingChange: (armId: string, text: string) => void;
  onCommitPending: (armId: string) => void;
  onEditTerm: (armId: string, termId: string, raw: string) => void;
  onRemoveTerm: (armId: string, termId: string) => void;
  onUnquoteTerm: (armId: string, termId: string) => void;
  onSetTermTag: (armId: string, termId: string, tag: string) => void;
}

export interface ArmRowProps extends ArmHandlers {
  arm: Arm;
  index: number;
  issues: Issue[];
}

export function issueMessage(issue: Issue, arm: Arm): string {
  const text = issue.termId
    ? (arm.terms.find((term) => term.id === issue.termId)?.text ?? '')
    : arm.pending.trim();
  const template =
    issue.kind === 'unbalanced_parentheses'
      ? en.issueUnbalancedParentheses
      : en.issueUnbalancedQuotes;
  return t(template, { term: text });
}

export function ArmRow({ arm, index, issues, ...handlers }: ArmRowProps) {
  const n = index + 1;
  const label = t(en.armLabel, { n });
  const titleId = `arm-title-${arm.id}`;
  const issuesId = `arm-issues-${arm.id}`;
  const invalidTermIds = new Set(issues.map((issue) => issue.termId).filter(Boolean));
  const pendingInvalid = issues.some((issue) => issue.termId === undefined);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handlers.onCommitPending(arm.id);
    }
  };

  return (
    <div className="arm" role="group" aria-labelledby={titleId}>
      <div className="arm-header">
        <h3 className="arm-title" id={titleId}>
          {label}
        </h3>
        <button
          type="button"
          aria-label={t(en.deleteArm, { n })}
          onClick={() => handlers.onDeleteArm(arm.id)}
        >
          {en.delete}
        </button>
      </div>
      <div className="arm-body">
        {arm.terms.map((term) => (
          <Fragment key={term.id}>
            <TermBox
              term={term}
              invalid={invalidTermIds.has(term.id)}
              describedBy={invalidTermIds.has(term.id) ? issuesId : undefined}
              onUnquote={() => handlers.onUnquoteTerm(arm.id, term.id)}
              onEdit={(raw) => handlers.onEditTerm(arm.id, term.id, raw)}
              onSetTag={(tag) => handlers.onSetTermTag(arm.id, term.id, tag)}
              onRemove={() => handlers.onRemoveTerm(arm.id, term.id)}
            />
            <span className="operator">{en.or}</span>
          </Fragment>
        ))}
        <input
          className="term-input"
          type="text"
          value={arm.pending}
          aria-label={t(en.termInputLabel, { n })}
          aria-invalid={pendingInvalid || undefined}
          aria-describedby={pendingInvalid ? issuesId : undefined}
          onChange={(event) => handlers.onPendingChange(arm.id, event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {issues.length > 0 && (
        <ul className="issues" id={issuesId}>
          {issues.map((issue, i) => (
            <li key={`${issue.termId ?? 'pending'}-${i}`}>{issueMessage(issue, arm)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
