import { useEffect, useRef, type MouseEvent } from 'react';
import { en } from '../i18n/en';
import { useActiveSection } from './useActiveSection';
import { useMediaQuery } from './useMediaQuery';

/** Page sections in order; each id is set on the matching element in Hero and App. */
export const PAGE_SECTIONS = [
  { id: 'about', label: en.sectionNavAbout },
  { id: 'prompt', label: en.promptNav },
  { id: 'strategy', label: en.armsHeading },
  { id: 'search', label: en.searchHeading },
  { id: 'prior', label: en.priorHeading },
  { id: 'studies', label: en.studiesHeading },
  { id: 'translate', label: en.translateHeading },
  { id: 'export', label: en.exportHeading },
  { id: 'history', label: en.historyHeading },
] as const;

const SECTION_IDS = PAGE_SECTIONS.map((section) => section.id);

/**
 * Section navigation (FR-026): a sticky sidebar from 1024px, a sticky horizontal bar below that.
 * Links are plain anchors; with script they scroll smoothly (unless reduced motion is preferred),
 * move focus to the section and mark it with aria-current.
 */
export interface SectionNavProps {
  /** Called before scrolling, so a folded section opens first. */
  onSelect?: (id: string) => void;
  /** Whether every section is open; with onToggleAll, adds an Expand all / Collapse all button. */
  allOpen?: boolean;
  onToggleAll?: () => void;
}

export function SectionNav({ onSelect, allOpen = false, onToggleAll }: SectionNavProps = {}) {
  const { active, select } = useActiveSection(SECTION_IDS);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)', false);
  const listRef = useRef<HTMLUListElement>(null);

  // In the phone bar the list can scroll sideways: keep the current link in view.
  useEffect(() => {
    const list = listRef.current;
    if (!list || active === null || list.scrollWidth <= list.clientWidth) return;
    const link = list.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!link) return;
    list.scrollLeft = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
  }, [active]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    onSelect?.(id);
    select(id);
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
    window.history.replaceState(null, '', `#${id}`);
    target.focus({ preventScroll: true });
  };

  return (
    <nav className="section-nav" aria-label={en.sectionNavLabel}>
      <ul ref={listRef}>
        {PAGE_SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={active === id ? 'true' : undefined}
              onClick={(event) => handleClick(event, id)}
            >
              {label}
            </a>
          </li>
        ))}
        {onToggleAll && (
          <li className="section-nav-all">
            <button type="button" className="link-button" onClick={onToggleAll}>
              {allOpen ? en.sectionsCollapseAll : en.sectionsExpandAll}
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
