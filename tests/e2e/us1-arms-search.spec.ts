import { expect, test, type Page } from '@playwright/test';
import { failPubmed, mockPubmed } from './pubmed-mock';

const arm = (page: Page, n: number) => page.getByRole('group', { name: `Arm ${n}`, exact: true });
const input = (page: Page, n: number) =>
  page.getByRole('textbox', { name: `New term for arm ${n}` });
const terms = (page: Page, n: number) => arm(page, n).getByTestId('term');
const searchButton = (page: Page) => page.getByRole('button', { name: 'Search', exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('scenario 1: three empty arms, AND between them, Search disabled', async ({ page }) => {
  await expect(page.getByRole('group', { name: /^Arm \d+$/ })).toHaveCount(3);
  await expect(page.getByText('AND', { exact: true })).toHaveCount(2);
  await expect(searchButton(page)).toBeDisabled();
  await expect(page.getByText('Add at least one term.')).toBeVisible();
  await expect(page.getByText(/Counts come from PubMed at the time of the run/)).toBeVisible();
});

test('scenarios 2-7: build, unquote, requote, auto-commit, and get both counts', async ({
  page,
}) => {
  const requested = await mockPubmed(page, { count: 2014896, metaCount: 7977 });

  // 2
  await input(page, 1).fill('heart failure');
  await input(page, 1).press('Enter');
  await input(page, 1).fill('cardiac failure');
  await input(page, 1).press('Enter');
  await expect(terms(page, 1)).toHaveCount(2);
  await expect(terms(page, 1).nth(0)).toHaveAttribute('data-text', '"heart failure"');
  await expect(terms(page, 1).nth(1)).toHaveAttribute('data-text', '"cardiac failure"');
  await expect(arm(page, 1).getByText('OR', { exact: true })).toHaveCount(2);
  await expect(input(page, 1)).toBeFocused();

  // 3
  await input(page, 3).fill('diabetes');
  await input(page, 3).press('Enter');
  await expect(terms(page, 3).nth(0)).toHaveAttribute('data-text', 'diabetes');

  // 4
  await terms(page, 1).nth(1).getByRole('button', { name: 'Remove quotes' }).first().click();
  await expect(terms(page, 1).nth(1)).toHaveAttribute('data-text', 'cardiac failure');
  await expect(arm(page, 1).getByRole('textbox', { name: /Edit term/ })).toHaveCount(0);

  // 5
  await terms(page, 1).nth(1).getByRole('button', { name: 'cardiac failure' }).click();
  await expect(arm(page, 1).getByRole('textbox', { name: /Edit term/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(terms(page, 1).nth(1)).toHaveAttribute('data-text', '"cardiac failure"');

  // 6
  await input(page, 3).fill('sglt2 inhibitors');
  await searchButton(page).click();
  await expect(terms(page, 3).nth(1)).toHaveAttribute('data-text', '"sglt2 inhibitors"');
  const query = '("heart failure" OR "cardiac failure") AND (diabetes OR "sglt2 inhibitors")';
  await expect(page.getByTestId('query-preview')).toHaveText(query);

  // 7 (counts from the mocked PubMed; comparison with pubmed.ncbi.nlm.nih.gov is manual/live)
  const results = page.getByTestId('search-results');
  await expect(results.getByTestId('result-count')).toHaveText(/^2[^0-9]?014[^0-9]?896$/);
  await expect(results.getByTestId('meta-result-count')).toHaveText(/^7[^0-9]?977$/);
  expect(requested).toEqual([query, `${query} AND ("meta-analysis")`]);
});

test('scenario 11: add an arm, delete the middle arm', async ({ page }) => {
  await input(page, 1).fill('a');
  await input(page, 1).press('Enter');
  await input(page, 2).fill('b');
  await input(page, 2).press('Enter');
  await input(page, 3).fill('c');
  await input(page, 3).press('Enter');
  await page.getByRole('button', { name: 'Add arm' }).click();
  await expect(page.getByRole('group', { name: /^Arm \d+$/ })).toHaveCount(4);
  await expect(page.getByText('AND', { exact: true })).toHaveCount(3);

  await page.getByRole('button', { name: 'Delete arm 2' }).click();
  await expect(page.getByRole('group', { name: /^Arm \d+$/ })).toHaveCount(3);
  await expect(page.getByText('AND', { exact: true })).toHaveCount(2);
  await expect(page.getByTestId('query-preview')).toHaveText('(a) AND (c)');
});

test('scenario 12: an unbalanced term disables Search', async ({ page }) => {
  await input(page, 1).fill('(heart');
  await input(page, 1).press('Enter');
  await expect(terms(page, 1).first()).toHaveClass(/invalid/);
  await expect(page.getByText('Term (heart has unbalanced parentheses.')).toBeVisible();
  await expect(searchButton(page)).toBeDisabled();
});

test('scenario 13: offline shows a message and no counts', async ({ page }) => {
  await failPubmed(page);
  await input(page, 1).fill('diabetes');
  await input(page, 1).press('Enter');
  await searchButton(page).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Both PubMed requests failed. No history row was saved.',
  );
  const results = page.getByTestId('search-results');
  await expect(results.getByTestId('result-count')).toHaveText('Error');
  await expect(results.getByTestId('meta-result-count')).toHaveText('Error');
});
