import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { SectionNav } from '../../src/ui/SectionNav';

const SECTIONS = [
  { name: 'About', href: '#about' },
  { name: 'Search strategy', href: '#strategy' },
  { name: 'Search', href: '#search' },
  { name: 'Known studies', href: '#studies' },
  { name: 'History', href: '#history' },
];

function renderApp() {
  return render(<App countQuery={vi.fn()} lookupLabel={vi.fn()} defaultContactEmail="" />);
}

describe('SectionNav (FR-026)', () => {
  it('renders one anchor per page section inside a "Page sections" nav', () => {
    render(<SectionNav />);
    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(SECTIONS.map((s) => s.name));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(SECTIONS.map((s) => s.href));
  });

  it('points every anchor at an element on the page', () => {
    renderApp();
    for (const { href } of SECTIONS) {
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }
    expect(document.getElementById('strategy')).toContainElement(
      screen.getByRole('heading', { level: 2, name: 'Search strategy' }),
    );
    expect(document.getElementById('studies')).toContainElement(
      screen.getByRole('heading', { level: 2, name: 'Known studies' }),
    );
  });

  it('marks the clicked section as current', async () => {
    const user = userEvent.setup();
    renderApp();
    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    const studies = within(nav).getByRole('link', { name: 'Known studies' });
    await user.click(studies);
    expect(studies).toHaveAttribute('aria-current', 'true');
    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(current).toEqual([studies]);
  });
});
