import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { mockPubmed } from './pubmed-mock';

const pasted = `("Bladder cancer" OR "Bladder neoplasm*" OR "Bladder tumor*" OR
"Urinary bladder cancer" OR "Urinary bladder neoplasm*" OR
"Urothelial carcinoma" OR "Bladder carcinoma")
AND
("Apparent diffusion coefficient" OR "Apparent diffusion coefficient value*" OR
ADC OR "ADC value*" OR "Diffusion-weighted imaging" OR
"Diffusion weighted imaging" OR DWI OR
"Diffusion-weighted MRI" OR "Diffusion weighted MRI")`;

const box = (page: Page) => page.getByRole('textbox', { name: 'Paste a search strategy' });
const fillArms = (page: Page) => page.getByRole('button', { name: 'Fill arms' });
const arms = (page: Page) => page.getByRole('group', { name: /^Arm \d+$/ });
const terms = (page: Page, n: number) =>
  page.getByRole('group', { name: `Arm ${n}`, exact: true }).getByTestId('term');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('pasting a strategy fills arms with the terms as written and searches it', async ({
  page,
}) => {
  const requested = await mockPubmed(page, { count: 431, metaCount: 38 });

  await box(page).fill(pasted);
  await fillArms(page).click();

  await expect(arms(page)).toHaveCount(2);
  await expect(terms(page, 1)).toHaveCount(7);
  await expect(terms(page, 2)).toHaveCount(9);
  await expect(terms(page, 1).nth(1)).toHaveAttribute('data-text', '"Bladder neoplasm*"');
  await expect(terms(page, 2).nth(2)).toHaveAttribute('data-text', 'ADC');
  await expect(page.getByText('Filled 2 arms with 16 terms.')).toBeVisible();
  await expect(box(page)).toHaveValue('');

  const expectedQuery =
    '("Bladder cancer" OR "Bladder neoplasm*" OR "Bladder tumor*" OR "Urinary bladder cancer" OR ' +
    '"Urinary bladder neoplasm*" OR "Urothelial carcinoma" OR "Bladder carcinoma") AND ' +
    '("Apparent diffusion coefficient" OR "Apparent diffusion coefficient value*" OR ADC OR ' +
    '"ADC value*" OR "Diffusion-weighted imaging" OR "Diffusion weighted imaging" OR DWI OR ' +
    '"Diffusion-weighted MRI" OR "Diffusion weighted MRI")';
  await expect(page.getByTestId('query-preview')).toHaveText(expectedQuery);

  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByTestId('search-results')).toContainText('431');
  expect(requested[0]).toBe(expectedQuery);

  await expectNoAxeViolations(page);
});

test('an unsupported strategy shows an error and leaves the arms unchanged', async ({ page }) => {
  await box(page).fill('bladder cancer NOT review');
  await fillArms(page).click();
  await expect(page.getByRole('alert')).toContainText('NOT is not supported');
  await expect(arms(page)).toHaveCount(3);
});

test('replacing existing terms asks for confirmation first', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'New term for arm 1' });
  await input.fill('diabetes');
  await input.press('Enter');

  await box(page).fill('(a OR b) AND c');
  await fillArms(page).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(terms(page, 1)).toHaveCount(1);

  await fillArms(page).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(arms(page)).toHaveCount(2);
  await expect(terms(page, 1)).toHaveCount(2);
});
