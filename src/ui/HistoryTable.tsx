import { useEffect, useId, useState } from 'react';
import type { CountOutcome, SearchRun } from '../core/types';
import { en } from '../i18n/en';

export interface HistoryTableProps {
  runs: SearchRun[];
  /** True when loading a row would replace terms the researcher has entered. */
  needsLoadConfirmation: boolean;
  onLoad: (run: SearchRun) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  copyText?: (text: string) => Promise<void>;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const numberFormat = new Intl.NumberFormat();
const COPIED_MS = 2000;

export function formatRunDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

const defaultCopy = (text: string) => navigator.clipboard.writeText(text);

function CountCell({
  outcome,
  runId,
  label,
}: {
  outcome: CountOutcome;
  runId: string;
  label: string;
}) {
  const reasonId = `${runId}-${label}-reason`;
  if (outcome.status === 'ok') {
    return <td className="count">{numberFormat.format(outcome.count)}</td>;
  }
  return (
    <td className="count">
      <span className="error-text" title={outcome.message} aria-describedby={reasonId}>
        {en.error}
      </span>
      <span id={reasonId} className="visually-hidden">
        {outcome.message}
      </span>
    </td>
  );
}

type Pending = { type: 'clear' } | { type: 'load'; run: SearchRun } | null;

export function HistoryTable({
  runs,
  needsLoadConfirmation,
  onLoad,
  onDelete,
  onClear,
  copyText = defaultCopy,
}: HistoryTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const dialogTextId = useId();

  useEffect(() => {
    if (copiedId === null) return;
    const timer = setTimeout(() => setCopiedId(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const copy = async (run: SearchRun) => {
    try {
      await copyText(run.query);
      setCopiedId(run.id);
    } catch {
      setCopiedId(null);
    }
  };

  const load = (run: SearchRun) => {
    if (needsLoadConfirmation) setPending({ type: 'load', run });
    else onLoad(run);
  };

  const confirm = () => {
    if (pending?.type === 'clear') onClear();
    if (pending?.type === 'load') onLoad(pending.run);
    setPending(null);
  };

  const dialog = pending && (
    <div className="confirm" role="alertdialog" aria-labelledby={dialogTextId}>
      <p id={dialogTextId}>{pending.type === 'clear' ? en.confirmClearHistory : en.confirmLoad}</p>
      <div className="confirm-actions">
        <button type="button" className="primary" onClick={confirm} autoFocus>
          {en.confirm}
        </button>
        <button type="button" onClick={() => setPending(null)}>
          {en.cancel}
        </button>
      </div>
    </div>
  );

  if (runs.length === 0) {
    return <p className="hint">{en.historyEmpty}</p>;
  }

  return (
    <div>
      <div className="table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">{en.historyDateTime}</th>
              <th scope="col">{en.historyStrategy}</th>
              <th scope="col">{en.historyResults}</th>
              <th scope="col">{en.historyResultsMeta}</th>
              <th scope="col">{en.historyActions}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="when">
                  <time dateTime={run.createdAt}>{formatRunDate(run.createdAt)}</time>
                </td>
                <td className="strategy">{run.query}</td>
                <CountCell outcome={run.result} runId={run.id} label="result" />
                <CountCell outcome={run.metaResult} runId={run.id} label="meta" />
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => load(run)}>
                      {en.load}
                    </button>
                    <button type="button" onClick={() => void copy(run)}>
                      {copiedId === run.id ? en.copied : en.copy}
                    </button>
                    <button type="button" onClick={() => onDelete(run.id)}>
                      {en.delete}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
      <div className="history-toolbar">
        <button type="button" onClick={() => setPending({ type: 'clear' })}>
          {en.clearHistory}
        </button>
      </div>
    </div>
  );
}
