import { useState } from 'react';
import { recordLabel, type PriorRecord } from '../core/prior';
import { en, t } from '../i18n/en';
import { pmcUrl, pubmedArticleUrl } from '../pubmed/links';

/** What the panel knows about the meta-analyses of the current strategy. */
export type PriorState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; records: PriorRecord[]; total: number }
  | { status: 'error'; message: string };

export interface PriorPanelProps {
  state: PriorState;
  /** Oldest publication year shown; null lists every year. */
  minYear: number | null;
  years: number[];
  onMinYearChange: (year: number | null) => void;
}

const numberFormat = new Intl.NumberFormat();

const ALL_YEARS = 'all';

/** PMIDs the visitor has checked off, kept in this browser only. */
export const PRIOR_CHECKED_KEY = 'sshelper:v1:prior-checked';

function readChecked(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PRIOR_CHECKED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeChecked(checked: Set<string>) {
  try {
    window.localStorage.setItem(PRIOR_CHECKED_KEY, JSON.stringify([...checked]));
  } catch {
    // Storage blocked or full: the checks still hold for this visit.
  }
}

function useChecked() {
  const [checked, setChecked] = useState(readChecked);
  const toggle = (pmid: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(pmid)) next.delete(pmid);
      else next.add(pmid);
      writeChecked(next);
      return next;
    });
  return { checked, toggle };
}

function PubmedLink({ pmid, label }: { pmid: string; label: string }) {
  return (
    <a
      className="prior-link"
      href={pubmedArticleUrl(pmid)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {en.priorOpenPubmed}
      <span className="visually-hidden">{t(en.priorOpenPubmedHidden, { label })}</span>
    </a>
  );
}

/** The free full text, or a disabled twin of the same button when PubMed lists no PMC id. */
function PmcLink({ pmcid, label }: { pmcid: string | null; label: string }) {
  if (pmcid === null) {
    return (
      <span
        className="prior-link is-disabled"
        aria-disabled="true"
        data-testid="prior-pmc-disabled"
      >
        {en.priorOpenPmc}
        <span className="visually-hidden">{t(en.priorNoPmc, { label })}</span>
      </span>
    );
  }
  return (
    <a className="prior-link" href={pmcUrl(pmcid)} target="_blank" rel="noopener noreferrer">
      {en.priorOpenPmc}
      <span className="visually-hidden">{t(en.priorOpenPmcHidden, { label })}</span>
    </a>
  );
}

function Body({ state, minYear }: { state: PriorState; minYear: number | null }) {
  const { checked, toggle } = useChecked();
  switch (state.status) {
    case 'idle':
      return <p className="hint">{en.priorRunFirst}</p>;
    case 'loading':
      return <p className="hint">{en.priorLoading}</p>;
    case 'error':
      return (
        <p className="alert" role="alert">
          <span className="error-text">{en.error}</span>{' '}
          <span className="reason">{state.message}</span>
        </p>
      );
    case 'ready': {
      if (state.records.length === 0) {
        return (
          <p className="hint">
            {minYear === null ? en.priorEmpty : t(en.priorEmptyFromYear, { year: minYear })}
          </p>
        );
      }
      return (
        <>
          <ol className="prior-list">
            {state.records.map((record) => {
              const label = recordLabel(record);
              const isChecked = checked.has(record.pmid);
              return (
                <li
                  key={record.pmid}
                  className={isChecked ? 'prior is-checked' : 'prior'}
                  data-testid="prior-row"
                >
                  <input
                    type="checkbox"
                    className="prior-check"
                    checked={isChecked}
                    onChange={() => toggle(record.pmid)}
                    aria-label={t(en.priorCheck, { label })}
                  />
                  <span className="prior-name" title={record.title || undefined}>
                    {label}
                  </span>
                  <PubmedLink pmid={record.pmid} label={label} />
                  <PmcLink pmcid={record.pmcid} label={label} />
                </li>
              );
            })}
          </ol>
          {state.total > state.records.length && (
            <p className="hint" data-testid="prior-truncated">
              {t(en.priorTruncated, {
                shown: numberFormat.format(state.records.length),
                total: numberFormat.format(state.total),
              })}
            </p>
          )}
        </>
      );
    }
  }
}

/** The meta-analysis count the strategy retrieves, shown on the section heading row. */
export function PriorCount({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <span className="prior-count">
      <span className="visually-hidden">{en.priorCountLabel}: </span>
      <span data-testid="prior-count">{numberFormat.format(count)}</span>
    </span>
  );
}

/**
 * Prior meta-analyses (the count sits on the section heading row, see PriorCount): a minimum-year filter, and one row per
 * meta-analysis with its PubMed page and, when there is one, its free full text.
 */
export function PriorPanel({ state, minYear, years, onMinYearChange }: PriorPanelProps) {
  return (
    <div>
      <p className="hint">{en.priorHint}</p>
      <div className="prior-filter">
        <label className="label" htmlFor="prior-min-year">
          {en.priorMinYearLabel}
        </label>
        <select
          id="prior-min-year"
          value={minYear === null ? ALL_YEARS : String(minYear)}
          onChange={(event) =>
            onMinYearChange(event.target.value === ALL_YEARS ? null : Number(event.target.value))
          }
        >
          <option value={ALL_YEARS}>{en.priorAllYears}</option>
          {years.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
      </div>
      <Body state={state} minYear={minYear} />
    </div>
  );
}
