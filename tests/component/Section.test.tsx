import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';

function renderApp() {
  render(<App countQuery={vi.fn()} lookupLabel={vi.fn()} defaultContactEmail="" />);
  return userEvent.setup();
}

const toggle = (name: string) => {
  const heading = screen.getByRole('heading', { level: 2, name });
  return within(heading).getByRole('button');
};

describe('Collapsible sections', () => {
  it('starts with every tool section folded', () => {
    renderApp();
    for (const name of ['No search strategy yet?', 'Search strategy', 'Search', 'History']) {
      expect(toggle(name)).toHaveAttribute('aria-expanded', 'false');
    }
    expect(document.getElementById('strategy-body')).not.toBeVisible();
  });

  it('opens and closes a section from its heading', async () => {
    const user = renderApp();
    await user.click(toggle('Search strategy'));
    expect(toggle('Search strategy')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Fill arms' })).toBeVisible();
    await user.click(toggle('Search strategy'));
    expect(document.getElementById('strategy-body')).not.toBeVisible();
  });

  it('opens the section a nav link points at', async () => {
    const user = renderApp();
    const nav = screen.getByRole('navigation', { name: 'Page sections' });
    await user.click(within(nav).getByRole('link', { name: 'History' }));
    expect(toggle('History')).toHaveAttribute('aria-expanded', 'true');
  });

  it('expands and collapses everything at once', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(toggle('Other databases')).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(toggle('Other databases')).toHaveAttribute('aria-expanded', 'false');
  });
});
