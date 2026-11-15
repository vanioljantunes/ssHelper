import type { ReactNode } from 'react';
import { en } from '../i18n/en';

export interface SectionProps {
  id: string;
  headingId: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  /** Shown on the heading row, open or closed (for example a result count). */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * A page section whose body folds away behind its heading. The heading holds a disclosure button;
 * the body stays mounted while hidden so typed text and results survive a collapse.
 */
export function Section({ id, headingId, title, open, onToggle, badge, children }: SectionProps) {
  const bodyId = `${id}-body`;
  return (
    <section
      className={open ? 'panel collapsible is-open' : 'panel collapsible'}
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
    >
      <div className="section-head">
        <h2 id={headingId}>
          <button
            type="button"
            className="section-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => onToggle(id)}
          >
            <svg
              className="section-chevron"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M5.5 3.5 10 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="section-title">{title}</span>
            <span className="section-state" aria-hidden="true">
              {open ? en.sectionCollapse : en.sectionExpand}
            </span>
          </button>
        </h2>
        {badge}
      </div>
      <div id={bodyId} className="section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
