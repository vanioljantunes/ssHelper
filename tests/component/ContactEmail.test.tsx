import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CountOutcome } from '../../src/core/types';
import type { Settings, SettingsStore } from '../../src/storage/types';
import { App } from '../../src/ui/App';

const LABEL =
  'Your email (sent to PubMed and Crossref with each request, saved only in this browser)';
const HINT = 'Enter your email to search. PubMed asks every tool to identify a contact.';

const ok: CountOutcome = { status: 'ok', count: 3, queryTranslation: '', warnings: [] };

function memorySettings(initial: Settings | null = null) {
  let saved = initial;
  const save = vi.fn((settings: Settings) => {
    saved = settings;
    return { ok: true as const };
  });
  const store: SettingsStore = { load: () => saved, save };
  return { store, save, saved: () => saved };
}

function renderApp({
  settings = memorySettings(),
  defaultContactEmail = '',
}: { settings?: ReturnType<typeof memorySettings>; defaultContactEmail?: string } = {}) {
  const user = userEvent.setup();
  const countQuery = vi.fn(async () => ok);
  const lookupLabel = vi.fn(async () => ({ status: 'error' as const, message: 'x' }));
  render(
    <App
      countQuery={countQuery}
      lookupLabel={lookupLabel}
      settingsStore={settings.store}
      defaultContactEmail={defaultContactEmail}
    />,
  );
  const emailInput = () => screen.getByRole('textbox', { name: LABEL });
  const searchButton = () => screen.getByRole('button', { name: 'Search' });
  const checkButton = () => screen.getByRole('button', { name: 'Check studies' });
  const addTerm = () =>
    user.type(screen.getByRole('textbox', { name: 'New term for arm 1' }), 'diabetes{Enter}');
  return { user, countQuery, emailInput, searchButton, checkButton, addTerm };
}

describe('Contact email (FR-025)', () => {
  it('with no email, Search and Check studies are disabled and the hint describes them', async () => {
    const { emailInput, searchButton, checkButton, addTerm } = renderApp();
    await addTerm();
    expect(emailInput()).toHaveValue('');
    expect(searchButton()).toBeDisabled();
    expect(checkButton()).toBeDisabled();
    const hint = screen.getByText(HINT);
    expect(hint.id).not.toBe('');
    for (const element of [emailInput(), searchButton(), checkButton()]) {
      expect(element.getAttribute('aria-describedby')?.split(' ')).toContain(hint.id);
    }
  });

  it('an invalid email keeps Search disabled and is not saved', async () => {
    const settings = memorySettings();
    const { user, emailInput, searchButton, addTerm } = renderApp({ settings });
    await addTerm();
    await user.type(emailInput(), 'you@example');
    expect(searchButton()).toBeDisabled();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(HINT)).toBeInTheDocument();
    expect(settings.save).not.toHaveBeenCalled();
  });

  it('a valid email enables Search, removes the hint and is saved trimmed', async () => {
    const settings = memorySettings();
    const { user, emailInput, searchButton, checkButton, countQuery, addTerm } = renderApp({
      settings,
    });
    await addTerm();
    await user.type(emailInput(), ' you@example.org ');
    expect(searchButton()).toBeEnabled();
    expect(checkButton()).toBeEnabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(searchButton()).not.toHaveAttribute('aria-describedby');
    expect(settings.saved()).toEqual({ contactEmail: 'you@example.org' });
    await user.click(searchButton());
    expect(countQuery).toHaveBeenCalled();
  });

  it('clearing the field removes the saved email', async () => {
    const settings = memorySettings({ contactEmail: 'you@example.org' });
    const { user, emailInput, searchButton } = renderApp({ settings });
    await user.clear(emailInput());
    expect(searchButton()).toBeDisabled();
    expect(settings.saved()).toEqual({ contactEmail: '' });
  });

  it('restores the saved email, which wins over the build default', () => {
    const { emailInput } = renderApp({
      settings: memorySettings({ contactEmail: 'saved@example.org' }),
      defaultContactEmail: 'default@example.org',
    });
    expect(emailInput()).toHaveValue('saved@example.org');
  });

  it('pre-fills the build default when nothing is saved', () => {
    const { emailInput, searchButton } = renderApp({ defaultContactEmail: 'default@example.org' });
    expect(emailInput()).toHaveValue('default@example.org');
    expect(searchButton()).toBeDisabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
