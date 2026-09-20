import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { SiteBar } from '../../src/ui/SiteBar';

const SITE = 'https://vanioantunes.com';

describe('SiteBar (same bar as vanioantunes.com)', () => {
  it('links home and to the three site sections, with Tools as the current page', () => {
    render(<SiteBar />);
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('link', { name: 'Vanio Antunes' })).toHaveAttribute(
      'href',
      `${SITE}/`,
    );

    const nav = within(bar).getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Who am I', `${SITE}/about/`],
      ['Tools', `${SITE}/tools/`],
      ['R packages', `${SITE}/packages/`],
    ]);
    expect(within(nav).getByRole('link', { name: 'Tools' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows Google Scholar, LinkedIn and X right after the name, opening in a new tab', () => {
    render(<SiteBar />);
    const profiles = within(screen.getByRole('banner')).getByRole('list', { name: 'Profiles' });
    const links = within(profiles).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://scholar.google.com/citations?user=JOZkTg0AAAAJ&hl=en',
      'https://www.linkedin.com/in/vanio-antunes/',
      'https://x.com/VanioAntunes',
    ]);
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Google Scholar (opens in a new tab)',
      'LinkedIn (opens in a new tab)',
      'X (opens in a new tab)',
    ]);
    for (const link of links) expect(link).toHaveAttribute('target', '_blank');
  });

  it('has a tools sub-navigation with ssHelper as the current tool', () => {
    render(<SiteBar />);
    const sub = within(screen.getByRole('banner')).getByRole('navigation', { name: 'Tools' });
    const links = within(sub).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['All tools', `${SITE}/tools/`],
      ['ssHelper', `${SITE}/tools/ssHelper/`],
      ['triageHelperbeta', `${SITE}/tools/triageHelper/`],
      ['Diagnostic calculator', `${SITE}/tools/diagnostic/`],
      ['Combine means and SDs', `${SITE}/tools/combine/`],
      ['Median to mean', `${SITE}/tools/median/`],
    ]);
    expect(within(sub).getByRole('link', { name: 'ssHelper' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('is the only banner and sits above the tool in the app', () => {
    render(<App countQuery={vi.fn()} lookupLabel={vi.fn()} defaultContactEmail="" />);
    const bar = screen.getByRole('banner');
    const title = screen.getByRole('heading', { level: 1, name: 'ssHelper' });
    expect(bar.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
