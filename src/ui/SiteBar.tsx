import photo from '../assets/vanio-antunes.jpg';
import { en } from '../i18n/en';

const SITE = 'https://vanioantunes.com';

const LINKS = [
  { label: en.siteBarAbout, href: `${SITE}/about/`, current: false },
  { label: en.siteBarTools, href: `${SITE}/tools/`, current: true },
  { label: en.siteBarPackages, href: `${SITE}/packages/`, current: false },
];

/** The same top bar as every page of vanioantunes.com; ssHelper lives under Tools. */
export function SiteBar() {
  return (
    <header className="site-bar">
      <div className="site-bar__inner">
        <a className="site-bar__brand" href={`${SITE}/`}>
          <img src={photo} width={32} height={32} alt="" />
          <span className="site-bar__name">{en.siteBarHome}</span>
        </a>
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
    </header>
  );
}
