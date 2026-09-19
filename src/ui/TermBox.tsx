import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { editableBody, FIELD_TAGS, isQuoted, splitTag } from '../core/term';
import type { Term } from '../core/types';
import { en, t } from '../i18n/en';

export interface TermBoxProps {
  term: Term;
  invalid: boolean;
  describedBy?: string;
  onUnquote: () => void;
  onEdit: (raw: string) => void;
  /** Sets the field tag; an empty string removes it (FR-027). */
  onSetTag: (tag: string) => void;
  onRemove: () => void;
}

export function TermBox({
  term,
  invalid,
  describedBy,
  onUnquote,
  onEdit,
  onSetTag,
  onRemove,
}: TermBoxProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [tagMenu, setTagMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTagRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const { body, tag } = splitTag(term.text);
  const quoted = isQuoted(term.text);
  const words = editableBody(term.text);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Only the words are edited (FR-028): quotes and the tag are put back on commit.
  const startEdit = () => {
    setDraft(words);
    setEditing(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setEditing(false);
      onEdit(draft.trim() === '' ? '' : draft + tag);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
    }
  };

  const closeMenu = () => {
    setTagMenu(false);
    addTagRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };

  const className = invalid ? 'term invalid' : 'term';

  if (editing) {
    return (
      <span className={className} data-testid="term" data-text={term.text}>
        {quoted && <span className="quote quote--static">{en.quoteMark}</span>}
        <input
          ref={inputRef}
          value={draft}
          aria-label={t(en.termEditLabel, { term: words })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => setEditing(false)}
        />
        {quoted && <span className="quote quote--static">{en.quoteMark}</span>}
      </span>
    );
  }

  const quoteButton = (
    <button
      type="button"
      className="quote"
      aria-label={en.removeQuotes}
      title={en.removeQuotes}
      onClick={onUnquote}
    >
      {en.quoteMark}
    </button>
  );

  return (
    <span className={className} data-testid="term" data-text={term.text}>
      {quoted && quoteButton}
      <button
        type="button"
        className="term-text"
        aria-label={t(en.termEditLabel, { term: words })}
        aria-describedby={describedBy}
        onClick={startEdit}
      >
        {quoted ? words : body}
      </button>
      {quoted && quoteButton}
      {tag !== '' ? (
        <span className="term-tag">
          {tag}
          <button
            type="button"
            className="term-tag-remove"
            aria-label={t(en.removeTag, { tag, term: words })}
            title={t(en.removeTag, { tag, term: words })}
            onClick={() => onSetTag('')}
          >
            {en.removeTermSymbol}
          </button>
        </span>
      ) : (
        <span className="term-tag-add">
          <button
            ref={addTagRef}
            type="button"
            className="add-tag"
            aria-label={t(en.addTag, { term: words })}
            title={t(en.addTag, { term: words })}
            aria-expanded={tagMenu}
            aria-controls={tagMenu ? menuId : undefined}
            onClick={() => setTagMenu((open) => !open)}
            onKeyDown={onMenuKeyDown}
          >
            {en.addTagSymbol}
          </button>
          {tagMenu && (
            <span className="tag-menu" id={menuId} onKeyDown={onMenuKeyDown}>
              {FIELD_TAGS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={t(en.addTagOption, { tag: option, term: words })}
                  onClick={() => {
                    setTagMenu(false);
                    onSetTag(option);
                  }}
                >
                  {option}
                </button>
              ))}
            </span>
          )}
        </span>
      )}
      <button
        type="button"
        className="remove"
        aria-label={en.removeTerm}
        title={en.removeTerm}
        onClick={onRemove}
      >
        {en.removeTermSymbol}
      </button>
    </span>
  );
}
