import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { resetStorage } from './pubmed-mock';

const rows = (page: Page) => page.getByRole('list', { name: 'Rows in the table' });
const scopus = (page: Page) => page.getByRole('checkbox', { name: 'Scopus (advanced search)' });
const embase = (page: Page) =>
  page.getByRole('checkbox', { name: 'Embase (Emtree, advanced search)' });

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
  const input = page.getByRole('textbox', { name: 'New term for arm 1' });
  await input.fill('"heart failure"[tiab]');
  await input.press('Enter');
});

test('the table lists PubMed and the checked databases, and follows the checkboxes', async ({
  page,
}) => {
  await expect(rows(page)).toContainText('PubMed');
  await expect(rows(page)).toContainText('Embase');
  await expect(rows(page)).toContainText('Cochrane CENTRAL');
  await expect(rows(page)).not.toContainText('Scopus');

  await scopus(page).check();
  await expect(page.getByTestId('translate-scopus')).toContainText('TITLE-ABS-KEY');
  await expect(rows(page)).toContainText('Scopus');

  await embase(page).uncheck();
  await expect(page.getByTestId('translate-embase')).toHaveCount(0);
  await expect(rows(page)).not.toContainText('Embase');

  await expectNoAxeViolations(page);
});

test('the PDF downloads under a dated name', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^search-strategies-\d{4}-\d{2}-\d{2}\.pdf$/);
  await expect(page.getByText('PDF downloaded.')).toBeVisible();
});

test('the download is disabled until the strategy has a term', async ({ page }) => {
  await page.getByRole('button', { name: 'Remove term' }).first().click();
  const button = page.getByRole('button', { name: 'Download PDF' });
  await expect(button).toBeDisabled();
  await expect(page.getByText('Add at least one term to export the strategies.')).toBeVisible();
});

test('the export section works at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'PDF table' }).click();
  await expect(page.getByRole('heading', { name: 'PDF table' })).toBeInViewport();
  await expectNoAxeViolations(page);
});
