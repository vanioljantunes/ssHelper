import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { resetStorage } from './pubmed-mock';

const LINKS = [
  { network: 'GitHub', href: 'https://github.com/vanioljantunes' },
  { network: 'LinkedIn', href: 'https://www.linkedin.com/in/vanio-antunes/' },
  { network: 'X', href: 'https://x.com/VanioAntunes' },
  { network: 'Instagram', href: 'https://www.instagram.com/vanio.antunes/' },
];

const authorCard = (page: Page) => page.getByRole('complementary', { name: /made by/i });

async function expectHero(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'ssHelper' })).toBeVisible();
  await expect(page.getByText('Build and test systematic review search strategies')).toBeVisible();
  await expect(authorCard(page)).toBeVisible();
  await expect(authorCard(page).getByText('Vanio Antunes', { exact: true })).toBeVisible();

  const links = authorCard(page).getByRole('link');
  await expect(links).toHaveCount(4);
  for (const [i, { network, href }] of LINKS.entries()) {
    const link = links.nth(i);
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAccessibleName(`Vanio Antunes on ${network} (opens in a new tab)`);
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
}

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test('hero with author card is visible and accessible at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectHero(page);
  await expect(authorCard(page).getByRole('img', { name: 'Vanio Antunes' })).toBeVisible();

  // Two columns: the author card sits to the right of the title.
  const title = await page.getByRole('heading', { level: 1, name: 'ssHelper' }).boundingBox();
  const card = await authorCard(page).boundingBox();
  expect(card!.x).toBeGreaterThan(title!.x + title!.width);
  await expectNoAxeViolations(page);
});

test('hero shows a compact author strip first and keeps the tool in view on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expectHero(page);
  await expect(authorCard(page).getByRole('img', { name: 'Vanio Antunes' })).toBeVisible();

  const title = await page.getByRole('heading', { level: 1, name: 'ssHelper' }).boundingBox();
  const card = await authorCard(page).boundingBox();
  expect(card!.y + card!.height).toBeLessThanOrEqual(title!.y);

  const strategy = await page
    .getByRole('heading', { level: 2, name: 'Search strategy', exact: true })
    .boundingBox();
  expect(strategy!.y).toBeLessThan(844);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
  await expectNoAxeViolations(page);
});
