import { studyQuery } from '../core/study';
import type { Study, StudyCheck } from '../core/types';
import { en, t } from '../i18n/en';
import { pubmedSearchUrl } from '../pubmed/links';

export type StudyRowCheck = StudyCheck | { status: 'checking'; query: string };

/** A check result plus the input it was made for; editing the input invalidates it. */
export interface StudyRowState {
  input: string;
  check: StudyRowCheck;
}

export interface StudiesPanelProps {
  studies: Study[];
  results: Record<string, StudyRowState | undefined>;
  /** The current query preview; results for another query are not shown. */
  query: string | null;
  canCheck: boolean;
  checking: boolean;
  onInputChange: (id: string, input: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onCheck: () => void;
}

function currentCheck(
  study: Study,
  state: StudyRowState | undefined,
  query: string | null,
): StudyRowCheck | null {
  if (!state || query === null) return null;
  if (state.input !== study.input || state.check.query !== query) return null;
  return state.check;
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

function CheckIcon() {
  return (
    <svg {...iconProps} data-testid="study-icon-check">
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg {...iconProps} data-testid="study-icon-x">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function UnknownIcon() {
  return (
    <svg {...iconProps} strokeWidth={1.6} data-testid="study-icon-unknown">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M6.1 6.2a2 2 0 1 1 2.6 1.9c-.5.2-.7.6-.7 1.1v.4" />
      <path d="M8 11.6v.1" strokeWidth={2.2} />
    </svg>
  );
}

function StatusContent({ check }: { check: StudyRowCheck }) {
  switch (check.status) {
    case 'checking':
      return <span>{en.studyChecking}</span>;
    case 'found':
      return (
        <>
          <CheckIcon />
          <span>{en.studyFound}</span>
        </>
      );
    case 'not_found':
      return (
        <>
          <XIcon />
          <span>{en.studyNotFound}</span>
        </>
      );
    case 'not_in_pubmed':
      return (
        <>
          <UnknownIcon />
          <span>{en.studyNotInPubmed}</span>
        </>
      );
    case 'invalid':
      return <span>{en.studyInvalid}</span>;
    case 'error':
      return (
        <span>
          <span className="error-text">{en.error}</span>{' '}
          <span className="study-reason">{check.message}</span>
        </span>
      );
  }
}

function summaryText(checks: StudyRowCheck[]): string | null {
  if (checks.length === 0 || checks.some((check) => check.status === 'checking')) return null;
  const count = (status: StudyRowCheck['status']) =>
    checks.filter((check) => check.status === status).length;
  const found = count('found');
  const total = found + count('not_found');
  const notInPubmed = count('not_in_pubmed');
  const invalid = count('invalid');
  const errors = count('error');
  const unresolved: string[] = [];
  if (notInPubmed > 0) {
    const template = notInPubmed === 1 ? en.studiesNotInPubmedOne : en.studiesNotInPubmedMany;
    unresolved.push(t(template, { n: notInPubmed }));
  }
  if (invalid > 0) unresolved.push(t(en.studiesInvalid, { n: invalid }));
  if (errors > 0) {
    unresolved.push(t(errors === 1 ? en.studiesErrorOne : en.studiesErrorMany, { n: errors }));
  }
  const summary = t(en.studiesSummary, { found, total });
  if (unresolved.length === 0) return summary;
  return `${summary} ${t(en.studiesUnresolved, { list: unresolved.join(en.listSeparator) })}`;
}

export function StudiesPanel({
  studies,
  results,
  query,
  canCheck,
  checking,
  onInputChange,
  onLabelChange,
  onAdd,
  onRemove,
  onCheck,
}: StudiesPanelProps) {
  const checks = studies.map((study) => currentCheck(study, results[study.id], query));
  const summary = summaryText(checks.filter((check) => check !== null));

  return (
    <div>
      <p className="hint">{en.studiesHint}</p>
      <ol className="study-list">
        {studies.map((study, index) => {
          const n = index + 1;
          const check = checks[index] ?? null;
          const inputId = `study-input-${study.id}`;
          const statusId = `study-status-${study.id}`;
          const resolved = check && check.status !== 'checking' ? check : null;
          return (
            <li
              key={study.id}
              className="study"
              data-testid="study-row"
              data-status={resolved?.status}
            >
              <input
                type="text"
                className="study-name"
                value={study.label}
                placeholder={t(en.studyLabel, { n })}
                spellCheck={false}
                autoComplete="off"
                aria-label={t(en.studyNameLabel, { n })}
                onChange={(event) => onLabelChange(study.id, event.target.value)}
              />
              <div className="study-box">
                <input
                  id={inputId}
                  type="text"
                  className="study-input"
                  value={study.input}
                  spellCheck={false}
                  autoComplete="off"
                  aria-label={t(en.studyInputLabel, { n })}
                  aria-describedby={check ? statusId : undefined}
                  onChange={(event) => onInputChange(study.id, event.target.value)}
                />
                {check && (
                  <span id={statusId} className="study-status">
                    <StatusContent check={check} />
                  </span>
                )}
              </div>
              {resolved && resolved.doi !== null && (
                <a
                  className="study-link"
                  href={pubmedSearchUrl(studyQuery(resolved.query, resolved.doi))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {en.studyOpenInPubmed}
                  <span className="visually-hidden">
                    {study.label.trim() === ''
                      ? t(en.studyOpenInPubmedHidden, { n })
                      : t(en.studyOpenInPubmedHiddenNamed, { label: study.label.trim() })}
                  </span>
                </a>
              )}
              <button
                type="button"
                className="study-remove"
                aria-label={t(en.removeStudy, { n })}
                onClick={() => onRemove(study.id)}
              >
                {en.removeStudyVisible}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="study-actions">
        <button type="button" onClick={onAdd}>
          {en.addStudy}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!canCheck || checking}
          aria-busy={checking || undefined}
          onClick={onCheck}
        >
          {en.checkStudies}
        </button>
      </div>
      <p className="studies-summary" aria-live="polite">
        {summary && <span data-testid="studies-summary">{summary}</span>}
      </p>
    </div>
  );
}
