import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { buildStrategyPrompt, MAX_PROMPT_CONCEPTS } from '../core/prompt';
import { en, promptText, t, VERA_HEALTH_URL } from '../i18n/en';

export interface PromptPanelProps {
  /** Opens the Search strategy section and focuses its paste box. */
  onGoPaste: () => void;
  copyText?: (text: string) => Promise<void>;
}

const defaultCopy = (text: string) => navigator.clipboard.writeText(text);

const EXAMPLES = [en.promptExample1, en.promptExample2, en.promptExample3];

/**
 * For visitors without a strategy: one concept per arm becomes a prompt for Vera Health, whose
 * answer is pasted back into Search strategy.
 */
export function PromptPanel({ onGoPaste, copyText = defaultCopy }: PromptPanelProps) {
  const [concepts, setConcepts] = useState<string[]>(['', '']);
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const previewId = useId();
  const timer = useRef<number | undefined>(undefined);
  const prompt = useMemo(() => buildStrategyPrompt(concepts, promptText), [concepts]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setConcept = (index: number, value: string) => {
    setStatus('idle');
    setConcepts((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const handleCopy = async () => {
    if (prompt === null) return;
    try {
      await copyText(prompt);
      setStatus('copied');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setStatus('idle'), 2500);
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="prompt">
      <p className="hint">{en.promptHint}</p>
      <fieldset className="prompt-concepts">
        <legend>{en.promptConceptsLabel}</legend>
        <ol>
          {concepts.map((concept, index) => (
            <li key={index} className="prompt-concept">
              <span className="prompt-arm" aria-hidden="true">
                (
              </span>
              <input
                type="text"
                value={concept}
                aria-label={t(en.promptConceptLabel, { n: index + 1 })}
                placeholder={
                  EXAMPLES[index] === undefined
                    ? ''
                    : t(en.promptConceptPlaceholder, { example: EXAMPLES[index] })
                }
                onChange={(event) => setConcept(index, event.target.value)}
              />
              <span className="prompt-arm" aria-hidden="true">
                )
              </span>
              {index < concepts.length - 1 && (
                <span className="prompt-and" data-label={en.and} aria-hidden="true" />
              )}
              {concepts.length > 1 && (
                <button
                  type="button"
                  className="prompt-remove"
                  aria-label={t(en.promptRemoveConcept, { n: index + 1 })}
                  onClick={() => {
                    setStatus('idle');
                    setConcepts((current) => current.filter((_, i) => i !== index));
                  }}
                >
                  {en.removeTermSymbol}
                </button>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setConcepts((current) => [...current, ''])}
          disabled={concepts.length >= MAX_PROMPT_CONCEPTS}
        >
          {en.promptAddConcept}
        </button>
      </fieldset>

      <p className="label" id={previewId}>
        {en.promptPreviewLabel}
      </p>
      {prompt === null ? (
        <p className="hint prompt-empty">{en.promptEmpty}</p>
      ) : (
        <pre className="prompt-preview" aria-labelledby={previewId} tabIndex={0}>
          {prompt}
        </pre>
      )}

      <div className="prompt-actions">
        <button
          type="button"
          className="primary action"
          disabled={prompt === null}
          onClick={() => void handleCopy()}
        >
          {status === 'copied' ? en.copied : en.promptCopy}
        </button>
        <a className="action-link" href={VERA_HEALTH_URL} target="_blank" rel="noopener noreferrer">
          {en.promptOpenVera}
          <span className="visually-hidden"> {en.promptOpenVeraHidden}</span>
        </a>
      </div>
      <p className="hint" aria-live="polite">
        {status === 'failed' ? en.promptCopyFailed : status === 'copied' ? en.copied : ''}
      </p>
      <p className="prompt-next">
        {en.promptNextStep}{' '}
        <button type="button" className="link-button" onClick={onGoPaste}>
          {en.promptGoPaste}
        </button>
      </p>
    </div>
  );
}
