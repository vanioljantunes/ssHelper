import { en } from '../i18n/en';

interface PackageCard {
  id: string;
  name: string;
  description: string;
  href: string;
}

const PACKAGES: PackageCard[] = [
  {
    id: 'easydta',
    name: en.packageEasydtaName,
    description: en.packageEasydtaDescription,
    href: 'https://github.com/vanioljantunes/easydta',
  },
  {
    id: 'nmaplots',
    name: en.packageNmaplotsName,
    description: en.packageNmaplotsDescription,
    href: 'https://github.com/vanioljantunes/nmaplots',
  },
];

/**
 * The author's other R packages (FR-026). Each card is one link. On wide screens the page grid
 * puts this section under the author block; on phones it follows History so the tool stays high.
 */
export function Packages() {
  return (
    <section className="packages" aria-labelledby="packages-heading">
      <h2 className="packages-caption" id="packages-heading">
        {en.packagesHeading}
      </h2>
      <ul className="package-list">
        {PACKAGES.map(({ id, name, description, href }) => (
          <li key={id}>
            <a
              className="package-card"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-labelledby={`package-${id}-name package-${id}-where`}
              aria-describedby={`package-${id}-description`}
            >
              <span className="package-name" id={`package-${id}-name`}>
                {name}
              </span>
              <span className="visually-hidden" id={`package-${id}-where`}>
                {en.packageLinkHidden}
              </span>
              <span className="package-description" id={`package-${id}-description`}>
                {description}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
