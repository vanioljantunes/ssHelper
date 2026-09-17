import type { CountOutcome } from '../core/types';
import { en } from '../i18n/en';

export type LastSearch =
  | { status: 'completed'; result: CountOutcome; metaResult: CountOutcome }
  | { status: 'failed'; result: CountOutcome; metaResult: CountOutcome };

export interface SearchPanelProps {
  query: string | null;
  isEmpty: boolean;
  hasIssues: boolean;
  running: boolean;
  last: LastSearch | null;
  onSearch: () => void;
}

const numberFormat = new Intl.NumberFormat();

export function formatCount(outcome: CountOutcome): string {
  return outcome.status === 'ok' ? numberFormat.format(outcome.count) : en.error;
}

function CountValue({ outcome, testId }: { outcome: CountOutcome; testId: string }) {
  if (outcome.status === 'ok') {
    return <dd data-testid={testId}>{numberFormat.format(outcome.count)}</dd>;
  }
  return (
    <dd>
      <span className="error-text" data-testid={testId}>
        {en.error}
      </span>
      <span className="reason">{outcome.message}</span>
    </dd>
  );
}

export function SearchPanel({
  query,
  isEmpty,
  hasIssues,
  running,
  last,
  onSearch,
}: SearchPanelProps) {
  const disabled = running || isEmpty || hasIssues;
  let hint: string | null = null;
  if (running) hint = en.searching;
  else if (isEmpty) hint = en.needTerm;
  else if (hasIssues) hint = en.fixIssues;

  const warnings = last
    ? Array.from(
        new Set(
          [last.result, last.metaResult].flatMap((outcome) =>
            outcome.status === 'ok' ? outcome.warnings : [],
          ),
        ),
      )
    : [];

  return (
    <div>
      <span className="label" id="query-preview-label">
        {en.queryPreviewLabel}
      </span>
      <pre
        className="query-preview"
        data-testid="query-preview"
        aria-labelledby="query-preview-label"
      >
        {query ?? en.queryPreviewEmpty}
      </pre>
      <div className="search-row">
        <button
          type="button"
          className="primary"
          disabled={disabled}
          aria-busy={running || undefined}
          onClick={onSearch}
        >
          {en.search}
        </button>
        {hint && <p className="hint">{hint}</p>}
      </div>
      {last && (
        <div data-testid="search-results">
          {last.status === 'failed' && (
            <p className="alert" role="alert">
              {en.bothFailed}
            </p>
          )}
          <dl className="counts">
            <div>
              <dt>{en.results}</dt>
              <CountValue outcome={last.result} testId="result-count" />
            </div>
            <div>
              <dt>{en.resultsMeta}</dt>
              <CountValue outcome={last.metaResult} testId="meta-result-count" />
            </div>
          </dl>
          {warnings.length > 0 && (
            <div className="warnings">
              <h3>{en.warningsHeading}</h3>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="notice">{en.runTimeNotice}</p>
    </div>
  );
}
