import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { mockPubmed } from './pubmed-mock';

const FOUND = '10.1000/found.1';
const MISSED = '10.1000/missed.2';
const ABSENT = '10.1000/absent.3';

/** FOUND is retrieved by the strategy, MISSED is in PubMed but not retrieved, ABSENT is not in PubMed. */
function countFor(term: string): number | undefined {
  if (term === `"${MISSED}"[doi]`) return 1;
  if (term.includes(`"${FOUND}"[doi]`)) return 1;
  if (term.includes(`"${MISSED}"[doi]`) || term.includes(`"${ABSENT}"[doi]`)) return 0;
  return undefined;
}

const doiInput = (page: Page, n: number) =>
  page.getByRole('textbox', { name: `DOI for study ${n}` });
const studyRows = (page: Page) => page.getByTestId('study-row');
const historyRows = (page: Page) => page.locator('.history-table tbody tr');

async function addTerm(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'New term for arm 1' });
  await input.fill(text);
  await input.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('search checks each DOI: found, not found, not in PubMed', async ({ page }) => {
  const requested = await mockPubmed(page, { count: 120, metaCount: 9, countFor });
  await addTerm(page, 'heart failure');
  await expect(studyRows(page)).toHaveCount(3);
  await doiInput(page, 1).fill(`https://doi.org/${FOUND}`);
  await doiInput(page, 2).fill(`doi:${MISSED}`);
  await doiInput(page, 3).fill(ABSENT);

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByTestId('studies-summary')).toContainText('Found 1 of 2 studies.');
  await expect(page.getByTestId('studies-summary')).toContainText('1 DOI not in PubMed');

  const found = studyRows(page).nth(0);
  const missed = studyRows(page).nth(1);
  const absent = studyRows(page).nth(2);
  await expect(found).toHaveAttribute('data-status', 'found');
  await expect(found).toContainText('Found by the strategy');
  await expect(found.getByTestId('study-icon-check')).toBeVisible();
  await expect(missed).toHaveAttribute('data-status', 'not_found');
  await expect(missed).toContainText('Not found by the strategy');
  await expect(missed.getByTestId('study-icon-x')).toBeVisible();
  await expect(absent).toHaveAttribute('data-status', 'not_in_pubmed');
  await expect(absent).toContainText('DOI not found in PubMed');
  await expect(absent.getByTestId('study-icon-unknown')).toBeVisible();

  const query = '("heart failure")';
  expect(requested).toEqual([
    query,
    `${query} AND ("meta-analysis")`,
    `${query} AND ("${FOUND}"[doi])`,
    `${query} AND ("${MISSED}"[doi])`,
    `"${MISSED}"[doi]`,
    `${query} AND ("${ABSENT}"[doi])`,
    `"${ABSENT}"[doi]`,
  ]);
  await expect(historyRows(page)).toHaveCount(1);
  await expectNoAxeViolations(page);

  // Editing a box clears only its status.
  await doiInput(page, 1).fill(`${FOUND}x`);
  await expect(found).not.toHaveAttribute('data-status');
  await expect(missed).toHaveAttribute('data-status', 'not_found');
});

test('Check studies runs the checks without adding a history row', async ({ page }) => {
  const requested = await mockPubmed(page, { countFor });
  const check = page.getByRole('button', { name: 'Check studies' });
  await expect(check).toBeDisabled();

  await addTerm(page, 'heart failure');
  await doiInput(page, 1).fill(FOUND);
  await doiInput(page, 2).fill('not a doi');
  await expect(check).toBeEnabled();
  await check.click();

  await expect(studyRows(page).nth(0)).toHaveAttribute('data-status', 'found');
  await expect(studyRows(page).nth(1)).toHaveAttribute('data-status', 'invalid');
  await expect(studyRows(page).nth(1)).toContainText('Not a valid DOI');
  await expect(page.getByTestId('studies-summary')).toContainText('Found 1 of 1 studies.');
  expect(requested).toEqual([`("heart failure") AND ("${FOUND}"[doi])`]);
  await expect(page.getByText('No searches yet.')).toBeVisible();

  // Changing the strategy hides results checked against the old query.
  await addTerm(page, 'cardiac failure');
  await expect(studyRows(page).nth(0)).not.toHaveAttribute('data-status');
});

test('add and remove study boxes; inputs persist after reload', async ({ page }) => {
  await expect(studyRows(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Add study' }).click();
  await expect(studyRows(page)).toHaveCount(4);
  await doiInput(page, 4).fill(FOUND);
  for (const n of [3, 2, 1]) {
    await page.getByRole('button', { name: `Remove study ${n}` }).click();
  }
  await expect(studyRows(page)).toHaveCount(1);
  await expect(doiInput(page, 1)).toHaveValue(FOUND);
  await page.getByRole('button', { name: 'Remove study 1' }).click();
  await expect(studyRows(page)).toHaveCount(1);
  await expect(doiInput(page, 1)).toHaveValue('');

  await doiInput(page, 1).fill(MISSED);
  await page.reload();
  await expect(studyRows(page)).toHaveCount(1);
  await expect(doiInput(page, 1)).toHaveValue(MISSED);
  await expectNoAxeViolations(page);
});
