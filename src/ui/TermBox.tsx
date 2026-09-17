import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { isQuoted, splitTag, unquoteTerm } from '../core/term';
import type { Term } from '../core/types';
import { en, t } from '../i18n/en';

export interface TermBoxProps {
  term: Term;
  invalid: boolean;
  describedBy?: string;
  onUnquote: () => void;
  onEdit: (raw: string) => void;
  onRemove: () => void;
}

export function TermBox({ term, invalid, describedBy, onUnquote, onEdit, onRemove }: TermBoxProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(term.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(term.text);
    setEditing(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setEditing(false);
      onEdit(draft);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
    }
  };

  const className = invalid ? 'term invalid' : 'term';

  if (editing) {
    return (
      <span className={className} data-testid="term" data-text={term.text}>
        <input
          ref={inputRef}
          value={draft}
          aria-label={t(en.termEditLabel, { term: term.text })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => setEditing(false)}
        />
      </span>
    );
  }

  const quoted = isQuoted(term.text);
  const { body, tag } = splitTag(term.text);
  const inner = quoted ? body.slice(1, -1) : body;

  return (
    <span className={className} data-testid="term" data-text={term.text}>
      {quoted && (
        <button
          type="button"
          className="quote"
          aria-label={en.removeQuotes}
          title={en.removeQuotes}
          onClick={onUnquote}
        >
          "
        </button>
      )}
      <button
        type="button"
        className="term-text"
        aria-label={unquoteTerm(term.text)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={startEdit}
      >
        {inner}
        {!quoted && tag}
      </button>
      {quoted && (
        <button
          type="button"
          className="quote"
          aria-label={en.removeQuotes}
          title={en.removeQuotes}
          onClick={onUnquote}
        >
          "
        </button>
      )}
      {quoted && tag !== '' && (
        <span className="term-tag" onClick={startEdit}>
          {tag}
        </span>
      )}
      <button
        type="button"
        className="remove"
        aria-label={en.removeTerm}
        title={en.removeTerm}
        onClick={onRemove}
      >
        {'×'}
      </button>
    </span>
  );
}
