import { useEffect, useMemo, useState } from 'react';
import { translate, type TargetDatabase } from '../core/translate';
import { en, t } from '../i18n/en';

export interface TranslatePanelProps {
  /** Heading id, so the section can label itself with it. */
  headingId: string;
  /** Terms of each arm, as the PubMed preview uses them. */
  arms: string[][];
  /** Clipboard writer; replaced in tests. */
  copyText?: (text: string) => Promise<void>;
}

const COPIED_MS = 2000;

const defaultCopy = (text: string) => navigator.clipboard.writeText(text);

const DATABASES: { key: TargetDatabase; label: string }[] = [
  { key: 'cochrane', label: en.translateCochraneLabel },
  { key: 'embase', label: en.translateEmbaseLabel },
];

/**
 * The current strategy written for Cochrane CENTRAL and Embase. Nothing is sent anywhere: the
 * researcher copies each line into the database.
 */
export function TranslatePanel({ headingId, arms, copyText = defaultCopy }: TranslatePanelProps) {
  const [copied, setCopied] = useState<TargetDatabase | null>(null);
  const translations = useMemo(
    () => DATABASES.map((database) => ({ ...database, ...translate(arms, database.key) })),
    [arms],
  );

  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (key: TargetDatabase, query: string) => {
    try {
      await copyText(query);
      setCopied(key);
    } catch {
      setCopied(null);
    }
  };

  // Both translations read the same arms, so every flag is reported once for the panel.
  const flagged = translations[0];
  const dropped = flagged?.droppedTags ?? [];
  const headings = flagged?.headings ?? [];
  const wildcards = flagged?.wildcards ?? [];

  return (
    <div>
      <h2 id={headingId}>{en.translateHeading}</h2>
      <p className="hint">{en.translateHint}</p>
      {translations.map(({ key, label, query }) => (
        <div className="translation" key={key}>
          <div className="translation-head">
            <span className="label" id={`translate-${key}-label`}>
              {label}
            </span>
            {query !== null && (
              <button type="button" onClick={() => void copy(key, query)}>
                {copied === key ? en.copied : en.copy}
                <span className="visually-hidden">
                  {t(en.translateCopyHidden, { database: label })}
                </span>
              </button>
            )}
          </div>
          <pre
            className="query-preview"
            data-testid={`translate-${key}`}
            aria-labelledby={`translate-${key}-label`}
          >
            {query ?? en.translateEmpty}
          </pre>
        </div>
      ))}
      {headings.length > 0 && (
        <p className="hint" data-testid="translate-headings">
          {t(en.translateHeadingsReview, { headings: headings.join(en.listSeparator) })}
        </p>
      )}
      {dropped.length > 0 && (
        <p className="hint" data-testid="translate-dropped">
          {t(en.translateDroppedTags, { tags: dropped.join(en.listSeparator) })}
        </p>
      )}
      {wildcards.length > 0 && (
        <p className="hint" data-testid="translate-wildcards">
          {t(en.translateWildcards, { terms: wildcards.join(en.listSeparator) })}
        </p>
      )}
    </div>
  );
}
