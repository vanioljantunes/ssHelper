import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { failPubmed, mockPubmed, resetStorage } from './pubmed-mock';

const input = (page: Page, n: number) =>
  page.getByRole('textbox', { name: `New term for arm ${n}` });
const arm = (page: Page, n: number) => page.getByRole('group', { name: `Arm ${n}`, exact: true });
const historyRows = (page: Page) => page.locator('.history-table tbody tr');
const searchButton = (page: Page) => page.getByRole('button', { name: 'Search', exact: true });

async function addTerm(page: Page, armNumber: number, text: string) {
  await input(page, armNumber).fill(text);
  await input(page, armNumber).press('Enter');
}

async function search(page: Page) {
  await searchButton(page).click();
  await expect(page.getByTestId('search-results')).toBeVisible();
  await expect(searchButton(page)).toBeEnabled();
}

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await resetStorage(page);
});

test('scenarios 8-10: row added, persists after reload, copy gives exact query', async ({
  page,
}) => {
  await mockPubmed(page, { count: 1234, metaCount: 56 });
  await expect(page.getByText('No searches yet.')).toBeVisible();

  await addTerm(page, 1, 'heart failure');
  await addTerm(page, 1, 'cardiac failure');
  await addTerm(page, 3, 'sglt2 inhibitors');
  const before = Date.now();
  await search(page);

  // 8
  const query = '("heart failure" OR "cardiac failure") AND ("sglt2 inhibitors")';
  await expect(historyRows(page)).toHaveCount(1);
  const cells = historyRows(page).first().locator('td');
  await expect(cells.nth(1)).toHaveText(query);
  await expect(cells.nth(2)).toHaveText(/^1[^0-9]?234$/);
  await expect(cells.nth(3)).toHaveText('56');
  const datetime = await cells.nth(0).locator('time').getAttribute('datetime');
  expect(Math.abs(new Date(datetime ?? '').getTime() - before)).toBeLessThan(60_000);
  await expect(cells.nth(0)).toHaveText(/\d{1,2}:\d{2}/);

  // 9
  await page.reload();
  await expect(historyRows(page)).toHaveCount(1);
  await expect(historyRows(page).first().locator('td').nth(1)).toHaveText(query);
  await expect(arm(page, 1).getByTestId('term')).toHaveCount(2);
  await expect(arm(page, 3).getByTestId('term')).toHaveAttribute('data-text', '"sglt2 inhibitors"');

  // 10
  await historyRows(page).first().getByRole('button', { name: 'Copy' }).click();
  await expect(historyRows(page).first().getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(query);
});

test('scenario 13 (history): offline run adds no row', async ({ page }) => {
  await failPubmed(page);
  await addTerm(page, 1, 'diabetes');
  await searchButton(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('No searches yet.')).toBeVisible();
});

test('scenarios 14-15: load an older row, delete a row, clear history', async ({ page }) => {
  await mockPubmed(page);
  await addTerm(page, 1, 'diabetes');
  await search(page);
  await page.getByRole('button', { name: 'Delete arm 1' }).click();
  await addTerm(page, 1, 'heart failure');
  await search(page);
  await page.getByRole('button', { name: 'Add arm' }).click();
  await addTerm(page, 3, 'obesity');
  await search(page);
  await expect(historyRows(page)).toHaveCount(3);
  await expect(historyRows(page).nth(2).locator('td').nth(1)).toHaveText('(diabetes)');

  // 14: current arms have terms, so Load asks first
  await historyRows(page).nth(2).getByRole('button', { name: 'Load' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Replace the current arms with this search?');
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByTestId('query-preview')).toHaveText('(diabetes)');
  await expect(page.getByRole('group', { name: /^Arm \d+$/ })).toHaveCount(3);
  await expect(arm(page, 1).getByTestId('term')).toHaveAttribute('data-text', 'diabetes');

  // Delete a single row
  await historyRows(page).nth(1).getByRole('button', { name: 'Delete' }).click();
  await expect(historyRows(page)).toHaveCount(2);

  // 15
  await page.getByRole('button', { name: 'Clear history' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('No searches yet.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No searches yet.')).toBeVisible();
});

test('accessibility: axe on history with rows, error cells, and dialogs', async ({ page }) => {
  await expectNoAxeViolations(page);
  let calls = 0;
  await page.route(
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi**',
    async (route) => {
      calls += 1;
      if (calls % 2 === 0) {
        await route.fulfill({ status: 404, body: 'not found' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ esearchresult: { count: '9', querytranslation: 'x' } }),
      });
    },
  );
  await addTerm(page, 1, 'diabetes');
  await search(page);
  await expect(historyRows(page).first().locator('td').nth(3).locator('.error-text')).toHaveText(
    'Error',
  );
  await expectNoAxeViolations(page);
  await historyRows(page).first().getByRole('button', { name: 'Load' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(
    page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }),
  ).toBeFocused();
  await expectNoAxeViolations(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear history' }).click();
  await expectNoAxeViolations(page);
});
