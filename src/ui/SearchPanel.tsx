import type { CountOutcome } from '../core/types';
import { en } from '../i18n/en';
import { pubmedSearchUrl } from '../pubmed/links';

export type LastSearch =
  | { status: 'completed'; result: CountOutcome; metaResult: CountOutcome }
  | { status: 'failed'; result: CountOutcome; metaResult: CountOutcome };

export interface SearchPanelProps {
  query: string | null;
  isEmpty: boolean;
  hasIssues: boolean;
  running: boolean;
  last: LastSearch | null;
  contactEmail: string;
  emailValid: boolean;
  onContactEmailChange: (value: string) => void;
  onSearch: () => void;
}

export const CONTACT_EMAIL_HINT_ID = 'contact-email-hint';

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
  contactEmail,
  emailValid,
  onContactEmailChange,
  onSearch,
}: SearchPanelProps) {
  const disabled = running || isEmpty || hasIssues || !emailValid;
  const emailHintId = emailValid ? undefined : CONTACT_EMAIL_HINT_ID;
  let hint: string | null = null;
  if (running) hint = en.searching;
  else if (isEmpty) hint = en.needTerm;
  else if (hasIssues) hint = en.fixIssues;

  return (
    <div>
      <span className="label" id="query-preview-label">
        {en.queryPreviewLabel}
      </span>
      <pre className="query-preview" data-testid="query-preview">
        {query === null ? (
          en.queryPreviewEmpty
        ) : (
          <a
            href={pubmedSearchUrl(query)}
            target="_blank"
            rel="noopener noreferrer"
            title={en.openInPubmed}
          >
            {query}
          </a>
        )}
      </pre>
      <div className="contact-email">
        <label className="label" htmlFor="contact-email">
          {en.contactEmailLabel}
        </label>
        <input
          id="contact-email"
          type="email"
          value={contactEmail}
          autoComplete="email"
          spellCheck={false}
          aria-invalid={(contactEmail.trim() !== '' && !emailValid) || undefined}
          aria-describedby={emailHintId}
          onChange={(event) => onContactEmailChange(event.target.value)}
        />
        {!emailValid && (
          <p id={CONTACT_EMAIL_HINT_ID} className="hint">
            {en.contactEmailHint}
          </p>
        )}
      </div>
      <div className="search-row">
        <button
          type="button"
          className="primary"
          disabled={disabled}
          aria-busy={running || undefined}
          aria-describedby={emailHintId}
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
        </div>
      )}
      <p className="notice">{en.runTimeNotice}</p>
    </div>
  );
}
