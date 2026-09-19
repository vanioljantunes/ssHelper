import photo from '../assets/vanio-antunes.jpg';
import { en, t } from '../i18n/en';

const SITE = 'https://vanioantunes.com';

const LINKS = [
  { label: en.siteBarAbout, href: `${SITE}/about/`, current: false },
  { label: en.siteBarTools, href: `${SITE}/tools/`, current: true },
  { label: en.siteBarPackages, href: `${SITE}/packages/`, current: false },
];

// Same marks as the vanioantunes.com bar (paths from the site's inline SVGs).
const PROFILES = [
  {
    network: en.networkScholar,
    href: 'https://scholar.google.com/citations?user=JOZkTg0AAAAJ&hl=en',
    path: 'M5.242 13.769L0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5c-2.977 0-5.548 1.748-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
  },
  {
    network: en.networkLinkedin,
    href: 'https://www.linkedin.com/in/vanio-antunes/',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.370 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    network: en.networkX,
    href: 'https://x.com/VanioAntunes',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
];

const TOOLS = [
  { label: en.toolsNavAll, href: `${SITE}/tools/`, current: false },
  { label: en.toolsNavSsHelper, href: `${SITE}/tools/ssHelper/`, current: true },
  { label: en.toolsNavDiagnostic, href: `${SITE}/tools/diagnostic/`, current: false },
  { label: en.toolsNavCombine, href: `${SITE}/tools/combine/`, current: false },
  { label: en.toolsNavMedian, href: `${SITE}/tools/median/`, current: false },
];

/** The same top bar as every page of vanioantunes.com; ssHelper lives under Tools. */
export function SiteBar() {
  return (
    <header className="site-bar">
      <div className="site-bar__inner">
        <div className="site-bar__id">
          <a className="site-bar__brand" href={`${SITE}/`}>
            <img src={photo} width={32} height={32} alt="" />
            <span className="site-bar__name">{en.siteBarHome}</span>
          </a>
          <ul className="site-bar__social" aria-label={en.siteBarProfiles}>
            {PROFILES.map(({ network, href, path }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(en.siteBarProfileLink, { network })}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d={path} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label={en.siteBarLabel}>
          <ul className="site-bar__links">
            {LINKS.map(({ label, href, current }) => (
              <li key={href}>
                <a href={href} aria-current={current ? 'page' : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <nav className="site-subnav" aria-label={en.toolsNavLabel}>
        <ul className="site-subnav__links">
          {TOOLS.map(({ label, href, current }) => (
            <li key={href}>
              <a href={href} aria-current={current ? 'page' : undefined}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
