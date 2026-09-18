import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from '../../src/ui/Hero';

const LINKS = [
  { network: 'GitHub', href: 'https://github.com/vanioljantunes' },
  { network: 'LinkedIn', href: 'https://www.linkedin.com/in/vanio-antunes/' },
  { network: 'X', href: 'https://x.com/VanioAntunes' },
  { network: 'Instagram', href: 'https://www.instagram.com/vanio.antunes/' },
];

describe('Hero (FR-026)', () => {
  it('shows the title, subtitle, three feature bullets and the privacy line', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1, name: 'ssHelper' })).toBeInTheDocument();
    expect(
      screen.getByText('Build and test systematic review search strategies'),
    ).toBeInTheDocument();

    const list = screen.getByRole('list', { name: /what ssHelper does/i });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Build PubMed strategies in arms, or paste one you already have',
      'Check whether known studies (by DOI) are retrieved by the strategy',
      'Compare result counts over time in your search history',
    ]);
    expect(
      screen.getByText('Free. Your strategies, studies and email stay in your browser.'),
    ).toBeInTheDocument();
  });

  it('shows an author card with the name and bio', () => {
    render(<Hero />);
    const card = screen.getByRole('complementary', { name: /made by/i });
    expect(within(card).getByText('Vanio Antunes')).toBeInTheDocument();
    expect(
      within(card).getByText('Meta-analysis researcher. Coordinator of MetaHub.'),
    ).toBeInTheDocument();
  });

  it('has exactly four social links that open in a new tab', () => {
    render(<Hero />);
    const card = screen.getByRole('complementary', { name: /made by/i });
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(4);

    expect(links.map((link) => link.getAttribute('href'))).toEqual(LINKS.map((l) => l.href));
    links.forEach((link, i) => {
      const { network, href } = LINKS[i]!;
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
      expect(link).toHaveAccessibleName(`Vanio Antunes on ${network} (opens in a new tab)`);
      const icon = link.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
