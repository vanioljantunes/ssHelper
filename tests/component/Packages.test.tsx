import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Packages } from '../../src/ui/Packages';

const PACKAGES = [
  {
    name: 'easyDTA',
    description: 'Diagnostic test accuracy meta-analysis in R',
    href: 'https://github.com/vanioljantunes/easydta',
  },
  {
    name: 'nmaplots',
    description: 'Network meta-analysis plots in R',
    href: 'https://github.com/vanioljantunes/nmaplots',
  },
];

describe('Packages (FR-026)', () => {
  it('shows the caption and two package cards, each one link to GitHub in a new tab', () => {
    render(<Packages />);
    const region = screen.getByRole('region', { name: 'R packages by Vanio' });
    const links = within(region).getAllByRole('link');
    expect(links).toHaveLength(2);

    links.forEach((link, i) => {
      const { name, description, href } = PACKAGES[i]!;
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link).toHaveAccessibleName(`${name} on GitHub (opens in a new tab)`);
      expect(link).toHaveAccessibleDescription(description);
      expect(link).toHaveTextContent(name);
      expect(link).toHaveTextContent(description);
    });
  });
});
