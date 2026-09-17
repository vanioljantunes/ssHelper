import { useId, useState } from 'react';
import { parseStrategy, type ParseError } from '../core/parse';
import { en, t } from '../i18n/en';

const errorMessages: Record<ParseError, string> = {
  empty: en.importErrorEmpty,
  unbalanced_quotes: en.importErrorUnbalancedQuotes,
  unbalanced_parentheses: en.importErrorUnbalancedParentheses,
  not_supported: en.importErrorNotSupported,
  nested_groups: en.importErrorNestedGroups,
  mixed_operators: en.importErrorMixedOperators,
  missing_term: en.importErrorMissingTerm,
  missing_operator: en.importErrorMissingOperator,
};

export interface ImportStrategyProps {
  needsConfirmation: boolean;
  onImport: (arms: string[][]) => void;
}

export function ImportStrategy({ needsConfirmation, onImport }: ImportStrategyProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState('');
  const [pendingArms, setPendingArms] = useState<string[][] | null>(null);
  const boxId = useId();
  const hintId = useId();
  const dialogTextId = useId();

  const apply = (arms: string[][]) => {
    onImport(arms);
    setText('');
    setPendingArms(null);
    const terms = arms.reduce((sum, arm) => sum + arm.length, 0);
    setDone(t(en.importDone, { arms: arms.length, terms }));
  };

  const submit = () => {
    setDone('');
    const result = parseStrategy(text);
    if (!result.ok) {
      setError(errorMessages[result.error]);
      return;
    }
    setError(null);
    if (needsConfirmation) setPendingArms(result.arms);
    else apply(result.arms);
  };

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
      {pendingArms ? (
        <div className="confirm" role="alertdialog" aria-labelledby={dialogTextId}>
          <p id={dialogTextId}>{en.confirmImport}</p>
          <div className="confirm-actions">
            <button type="button" className="primary" onClick={() => apply(pendingArms)} autoFocus>
              {en.confirm}
            </button>
            <button type="button" onClick={() => setPendingArms(null)}>
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
