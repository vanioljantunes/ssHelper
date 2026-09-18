import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { mockPubmed, resetStorage } from './pubmed-mock';

const HINT = 'Enter your email to search. PubMed asks every tool to identify a contact.';
const TYPED = 'visitor@example.org';

const emailInput = (page: Page) => page.getByRole('textbox', { name: /^Your email/ });
const searchButton = (page: Page) => page.getByRole('button', { name: 'Search', exact: true });
const checkButton = (page: Page) => page.getByRole('button', { name: 'Check studies' });

async function addTerm(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'New term for arm 1' });
  await input.fill(text);
  await input.press('Enter');
}

test.beforeEach(async ({ page }) => {
  // No saved email: the field starts empty even when a local .env.local sets a default.
  await resetStorage(page, '');
});

test('with no email, Search and Check studies are disabled and the hint shows', async ({
  page,
}) => {
  await addTerm(page, 'diabetes');
  await expect(emailInput(page)).toHaveValue('');
  await expect(searchButton(page)).toBeDisabled();
  await expect(checkButton(page)).toBeDisabled();
  await expect(page.getByText(HINT)).toBeVisible();
  await expect(searchButton(page)).toHaveAccessibleDescription(HINT);
  await expect(emailInput(page)).toHaveAccessibleDescription(HINT);
  await expectNoAxeViolations(page);
});

test('entering an email enables Search and it persists after reload', async ({ page }) => {
  await addTerm(page, 'diabetes');
  await emailInput(page).fill('visitor@example');
  await expect(searchButton(page)).toBeDisabled();
  await expect(emailInput(page)).toHaveAttribute('aria-invalid', 'true');

  await emailInput(page).fill(TYPED);
  await expect(searchButton(page)).toBeEnabled();
  await expect(checkButton(page)).toBeEnabled();
  await expect(page.getByText(HINT)).toHaveCount(0);
  await expectNoAxeViolations(page);

  await page.reload();
  await expect(emailInput(page)).toHaveValue(TYPED);
  await expect(searchButton(page)).toBeEnabled();
});

test('PubMed and Crossref requests carry the typed email', async ({ page }) => {
  await mockPubmed(page, { count: 10, metaCount: 2 });
  const urls: URL[] = [];
  page.on('request', (request) => urls.push(new URL(request.url())));

  await emailInput(page).fill(TYPED);
  await addTerm(page, 'diabetes');
  await page.getByRole('textbox', { name: 'DOI for study 1' }).fill('10.1002/jmri.29184');
  await searchButton(page).click();
  await expect(page.getByTestId('result-count')).toHaveText('10');
  await expect(page.getByRole('textbox', { name: 'Name for study 1' })).toHaveValue('Gong, 2024');

  const esearch = urls.filter((url) => url.hostname === 'eutils.ncbi.nlm.nih.gov');
  expect(esearch.length).toBeGreaterThan(0);
  for (const url of esearch) {
    expect(url.searchParams.get('email')).toBe(TYPED);
    expect(url.searchParams.get('tool')).toBe('ssHelper');
  }
  const crossref = urls.filter((url) => url.hostname === 'api.crossref.org');
  expect(crossref.map((url) => url.searchParams.get('mailto'))).toEqual([TYPED]);
});
