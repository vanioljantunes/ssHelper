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

  it('is the only banner and sits above the tool in the app', () => {
    render(<App countQuery={vi.fn()} lookupLabel={vi.fn()} defaultContactEmail="" />);
    const bar = screen.getByRole('banner');
    const title = screen.getByRole('heading', { level: 1, name: 'ssHelper' });
    expect(bar.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
