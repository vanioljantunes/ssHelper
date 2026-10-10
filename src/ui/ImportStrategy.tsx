import { useId, useState } from 'react';
import { parseStrategy, type Advisory, type AdvisoryKind, type ParseError } from '../core/parse';
import { en, t } from '../i18n/en';

const errorMessages: Record<ParseError, string> = {
  empty: en.importErrorEmpty,
  unbalanced_quotes: en.importErrorUnbalancedQuotes,
  unbalanced_parentheses: en.importErrorUnbalancedParentheses,
  all_dropped: en.importErrorAllDropped,
  nested_groups: en.importErrorNestedGroups,
  mixed_operators: en.importErrorMixedOperators,
  missing_term: en.importErrorMissingTerm,
  missing_operator: en.importErrorMissingOperator,
};

/** One line per kind of dropped part, in the order the kinds are warned about. */
const warningMessages: Record<AdvisoryKind, string> = {
  not_clause: en.importWarnNot,
  filter: en.importWarnFilter,
  date_limit: en.importWarnDateLimit,
  line_reference: en.importWarnLineReference,
};

const WARNING_ORDER: AdvisoryKind[] = ['not_clause', 'filter', 'date_limit', 'line_reference'];

function warningLines(advisories: Advisory[]): { kind: AdvisoryKind; text: string }[] {
  return WARNING_ORDER.filter((kind) => advisories.some((item) => item.kind === kind)).map(
    (kind) => ({
      kind,
      text: t(warningMessages[kind], {
        list: advisories
          .filter((item) => item.kind === kind)
          .map((item) => item.text)
          .join(en.listSeparator),
      }),
    }),
  );
}

interface Pending {
  arms: string[][];
  advisories: Advisory[];
}

export interface ImportStrategyProps {
  needsConfirmation: boolean;
  onImport: (arms: string[][]) => void;
}

export function ImportStrategy({ needsConfirmation, onImport }: ImportStrategyProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const boxId = useId();
  const hintId = useId();
  const dialogTextId = useId();

  const apply = ({ arms, advisories }: Pending) => {
    onImport(arms);
    setText('');
    setPending(null);
    const terms = arms.reduce((sum, arm) => sum + arm.length, 0);
    const dropped = advisories.length;
    const template =
      dropped === 0
        ? en.importDone
        : dropped === 1
          ? en.importDoneDroppedOne
          : en.importDoneDropped;
    setDone(t(template, { arms: arms.length, terms, dropped }));
  };

  const submit = () => {
    setDone('');
    const result = parseStrategy(text);
    if (!result.ok) {
      setError(errorMessages[result.error]);
      return;
    }
    setError(null);
    const next = { arms: result.arms, advisories: result.advisories };
    if (needsConfirmation || result.advisories.length > 0) setPending(next);
    else apply(next);
  };

  const lines = pending ? warningLines(pending.advisories) : [];

  return (
    <div className="import">
      <label htmlFor={boxId} className="label">
        {en.importLabel}
      </label>
      <p id={hintId} className="hint">
        {en.importHint}
      </p>
      <textarea
        id={boxId}
        className="import-box"
        rows={5}
        value={text}
        aria-describedby={hintId}
        aria-invalid={error !== null}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
          setDone('');
        }}
      />
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {pending ? (
        <div className="confirm" role="alertdialog" aria-labelledby={dialogTextId}>
          <p id={dialogTextId}>{lines.length > 0 ? en.importWarnLead : en.confirmImport}</p>
          {lines.length > 0 && (
            <>
              <ul className="import-warnings">
                {lines.map((line) => (
                  <li key={line.kind}>{line.text}</li>
                ))}
              </ul>
              {needsConfirmation && <p>{en.confirmImport}</p>}
              <p>{en.importWarnQuestion}</p>
            </>
          )}
          <div className="confirm-actions">
            <button type="button" className="primary" onClick={() => apply(pending)} autoFocus>
              {en.confirm}
            </button>
            <button type="button" onClick={() => setPending(null)}>
              {en.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={submit} disabled={text.trim() === ''}>
          {en.importButton}
        </button>
      )}
      <p className="hint" aria-live="polite">
        {done}
      </p>
    </div>
  );
}
