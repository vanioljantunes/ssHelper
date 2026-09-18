import type { ReactNode } from 'react';
import photo from '../assets/vanio-antunes.jpg';
import { en, t } from '../i18n/en';
import { useMediaQuery } from './useMediaQuery';

interface AuthorLink {
  network: string;
  href: string;
  icon: ReactNode;
}

// Hand-drawn 24x24 marks (no icon library: React stays the only runtime dependency).
const xIcon = (
  <>
    <path d="M4 3.5h4.6l11.4 17h-4.6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M19.6 3.5l-6.3 7.2M10.7 13.4l-6.3 7.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </>
);

const linkedinIcon = (
  <path
    fillRule="evenodd"
    d="M4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2zM8.9 7.3a1.6 1.6 0 1 0-3.2 0a1.6 1.6 0 1 0 3.2 0zM5.9 9.6v8.8h2.8V9.6zM10.6 9.6v8.8h2.8v-4.5c0-1.3.8-2 1.8-2s1.5.7 1.5 1.9v4.6h2.8v-5c0-2.4-1.2-3.9-3.3-3.9c-1.3 0-2.3.6-2.8 1.4V9.6z"
  />
);

const AUTHOR_LINKS: AuthorLink[] = [
  { network: en.networkX, href: 'https://x.com/VanioAntunes', icon: xIcon },
  {
    network: en.networkLinkedin,
    href: 'https://www.linkedin.com/in/vanio-antunes/',
    icon: linkedinIcon,
  },
];

const BIO = [en.authorBio1, en.authorBio2, en.authorBio3];
const STEPS = [en.heroPoint1, en.heroPoint2, en.heroPoint3];

/** Wide layouts always show the steps; phones collapse them under "How it works". */
export const HERO_WIDE_QUERY = '(min-width: 720px)';

/**
 * Landing block: who made ssHelper and what it does (FR-026). One card holding the author block and
 * the intro; on phones the card dissolves (display: contents) so the page grid in app.css places
 * the two parts separately. The author block comes first in the
 * DOM so reading order matches the phone layout, where it is a compact strip above the title.
 */
export function Hero() {
  const wide = useMediaQuery(HERO_WIDE_QUERY, true);
  return (
    <section className="hero-card" aria-labelledby="hero-title">
      <aside className="author-card" aria-labelledby="author-caption author-name">
        <img
          className="author-photo"
          src={photo}
          alt={en.authorName}
          width={72}
          height={72}
          loading="eager"
          decoding="async"
        />
        <div className="author-text">
          <p className="author-caption" id="author-caption">
            {en.authorCaption}
          </p>
          <p className="author-name" id="author-name">
            {en.authorName}
          </p>
          <div className="author-bio">
            {BIO.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className="author-bio-short">{en.authorBioShort}</p>
        </div>
        <ul className="author-links" aria-label={en.authorLinksLabel}>
          {AUTHOR_LINKS.map(({ network, href, icon }) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer" title={network}>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="currentColor">
                  {icon}
                </svg>
                <span className="visually-hidden">
                  {t(en.authorLinkHidden, { name: en.authorName, network })}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <div className="hero-intro" id="about">
        <h1 id="hero-title">{en.appTitle}</h1>
        <p className="hero-subtitle">{en.heroSubtitle}</p>
        <details className="hero-how" open={wide}>
          <summary>{en.heroHowItWorks}</summary>
          {/* list-style is removed for the drawn circles, so role="list" keeps list semantics in Safari. */}
          <ol className="hero-steps" role="list" aria-label={en.heroPointsLabel}>
            {STEPS.map((step, i) => (
              <li key={step}>
                <span className="hero-step-number" aria-hidden="true">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </details>
        <p className="hero-privacy">{en.heroPrivacy}</p>
      </div>
    </section>
  );
}
