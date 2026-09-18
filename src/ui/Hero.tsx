import type { ReactNode } from 'react';
import photo from '../assets/vanio-antunes.jpg';
import { en, t } from '../i18n/en';

interface AuthorLink {
  network: string;
  href: string;
  icon: ReactNode;
}

// Hand-drawn 24x24 marks (no icon library: React stays the only runtime dependency).
const githubIcon = (
  <path
    fillRule="evenodd"
    d="M12 1a11 11 0 1 1 0 22a11 11 0 1 1 0-22zM8.1 10L7.7 6.4L10.2 7.9C11.4 7.6 12.6 7.6 13.8 7.9L16.3 6.4L15.9 10C16.7 11 16.9 12.2 16.5 13.3C16 14.6 14.8 15.3 13.5 15.5V22.85H10.5V19.6C9 19.8 7.8 19.2 6.9 17.8L7.6 17.4C8.3 18.4 9.2 18.8 10.5 18.6V15.5C9.2 15.3 8 14.6 7.5 13.3C7.1 12.2 7.3 11 8.1 10z"
  />
);

const linkedinIcon = (
  <path
    fillRule="evenodd"
    d="M4.5 2h15A2.5 2.5 0 0 1 22 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19.5v-15A2.5 2.5 0 0 1 4.5 2zM8.9 7.3a1.6 1.6 0 1 0-3.2 0a1.6 1.6 0 1 0 3.2 0zM5.9 9.6v8.8h2.8V9.6zM10.6 9.6v8.8h2.8v-4.5c0-1.3.8-2 1.8-2s1.5.7 1.5 1.9v4.6h2.8v-5c0-2.4-1.2-3.9-3.3-3.9c-1.3 0-2.3.6-2.8 1.4V9.6z"
  />
);

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

const instagramIcon = (
  <>
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.3" cy="6.7" r="1.2" />
  </>
);

const AUTHOR_LINKS: AuthorLink[] = [
  { network: en.networkGithub, href: 'https://github.com/vanioljantunes', icon: githubIcon },
  {
    network: en.networkLinkedin,
    href: 'https://www.linkedin.com/in/vanio-antunes/',
    icon: linkedinIcon,
  },
  { network: en.networkX, href: 'https://x.com/VanioAntunes', icon: xIcon },
  {
    network: en.networkInstagram,
    href: 'https://www.instagram.com/vanio.antunes/',
    icon: instagramIcon,
  },
];

const STEPS = [en.heroPoint1, en.heroPoint2, en.heroPoint3];

/**
 * Landing block: what ssHelper does, and who made it (FR-026).
 * The author card comes first in the DOM so reading order matches the phone layout, where it
 * shows as a compact strip above the title; on wide screens CSS grid places it in the right column.
 */
export function Hero() {
  return (
    <div className="hero">
      <aside className="author-card" aria-labelledby="author-caption">
        <img
          className="author-photo"
          src={photo}
          alt={en.authorName}
          width={96}
          height={96}
          loading="eager"
          decoding="async"
        />
        <div className="author-text">
          <p className="author-line">
            <span className="author-caption" id="author-caption">
              {en.authorCaption}
            </span>{' '}
            <span className="author-name">{en.authorName}</span>
          </p>
          <p className="author-bio">{en.authorBio}</p>
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
        </div>
      </aside>
      <header className="hero-intro">
        <h1>{en.appTitle}</h1>
        <p className="hero-subtitle">{en.heroSubtitle}</p>
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
        <p className="hero-privacy">{en.heroPrivacy}</p>
      </header>
    </div>
  );
}
