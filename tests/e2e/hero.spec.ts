import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations } from './a11y';
import { resetStorage } from './pubmed-mock';

const LINKS = [
  { network: 'X', href: 'https://x.com/VanioAntunes' },
  { network: 'LinkedIn', href: 'https://www.linkedin.com/in/vanio-antunes/' },
];

const PACKAGES = [
  { name: 'easyDTA', href: 'https://github.com/vanioljantunes/easydta' },
  { name: 'nmaplots', href: 'https://github.com/vanioljantunes/nmaplots' },
];

/** Phone budget: the top of the first tool heading, measured without scrolling. */
const PHONE_HEADING_MAX = 360;
const PHONE_ZOOM_HEADING_MAX = 520;

const authorCard = (page: Page) => page.getByRole('complementary', { name: /made by/i });
const packages = (page: Page) => page.getByRole('region', { name: 'R packages by Vanio' });
const sectionNav = (page: Page) => page.getByRole('navigation', { name: 'Page sections' });
const strategyHeading = (page: Page) =>
  page.getByRole('heading', { level: 2, name: 'Search strategy', exact: true });

async function expectHero(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'ssHelper' })).toBeVisible();
  await expect(page.getByText('Build and test systematic review search strategies')).toBeVisible();
  await expect(authorCard(page)).toBeVisible();
  await expect(authorCard(page).getByText('Vanio Antunes', { exact: true })).toBeVisible();
  await expect(page.getByText(/metahub/i)).toHaveCount(0);

  const links = authorCard(page).getByRole('link');
  await expect(links).toHaveCount(2);
  for (const [i, { network, href }] of LINKS.entries()) {
    const link = links.nth(i);
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAccessibleName(`Vanio Antunes on ${network} (opens in a new tab)`);
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(32);
    expect(box?.height).toBeGreaterThanOrEqual(32);
  }
}

async function expectPackages(page: Page) {
  const links = packages(page).getByRole('link');
  await expect(links).toHaveCount(2);
  for (const [i, { name, href }] of PACKAGES.entries()) {
    const link = links.nth(i);
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAccessibleName(`${name} on GitHub (opens in a new tab)`);
  }
}

async function expectNoHorizontalScroll(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width);
}

async function headingTop(page: Page) {
  // Page coordinates: bounding box top plus the current scroll (expected to be 0).
  return page.evaluate(() => {
    const heading = document.getElementById('arms-heading')!;
    return heading.getBoundingClientRect().top + window.scrollY;
  });
}

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('hero, package cards and section sidebar at 1440px', async ({ page }) => {
    await page.goto('/');
    await expectHero(page);
    await expect(authorCard(page).getByRole('img', { name: 'Vanio Antunes' })).toBeVisible();
    await expect(page.getByText('How it works')).toBeHidden();
    await expect(page.getByRole('list', { name: /what ssHelper does/i })).toBeVisible();
    await expectPackages(page);

    // One hero card: the author block sits right of the title inside it; packages follow the tool.
    const title = (await page.getByRole('heading', { level: 1, name: 'ssHelper' }).boundingBox())!;
    const card = (await authorCard(page).boundingBox())!;
    const hero = (await page.getByRole('region', { name: 'ssHelper' }).boundingBox())!;
    const pkgs = (await packages(page).boundingBox())!;
    const history = (await page.getByRole('heading', { level: 2, name: 'History' }).boundingBox())!;
    expect(card.x).toBeGreaterThan(title.x + title.width);
    expect(card.x + card.width).toBeLessThanOrEqual(hero.x + hero.width);
    expect(card.y).toBeGreaterThanOrEqual(hero.y);
    expect(card.y + card.height).toBeLessThanOrEqual(hero.y + hero.height);
    expect(pkgs.y).toBeGreaterThan(history.y);

    // Sidebar left of the content column.
    const nav = sectionNav(page);
    await expect(nav).toBeVisible();
    const navBox = (await nav.boundingBox())!;
    expect(navBox.x + navBox.width).toBeLessThanOrEqual(title.x);
    await expect(nav.getByRole('link')).toHaveCount(5);

    await expectNoHorizontalScroll(page, 1440);
    await expectNoAxeViolations(page);
  });

  test('clicking a sidebar link scrolls to the section and marks it current', async ({ page }) => {
    await page.goto('/');
    const nav = sectionNav(page);
    const link = nav.getByRole('link', { name: 'Known studies' });
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'true');
    await expect(nav.locator('[aria-current]')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Known studies' })).toBeInViewport();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // The sidebar stays in view while the page scrolls.
    await expect(nav).toBeInViewport();
    await expectNoAxeViolations(page);
  });
});

test('sidebar at 1024px passes axe', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/');
  await expectHero(page);
  const nav = sectionNav(page);
  await expect(nav).toBeVisible();
  const navBox = (await nav.boundingBox())!;
  const title = (await page.getByRole('heading', { level: 1, name: 'ssHelper' }).boundingBox())!;
  expect(navBox.x + navBox.width).toBeLessThanOrEqual(title.x);
  await expectNoHorizontalScroll(page, 1024);
  await expectNoAxeViolations(page);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('compact hero keeps the tool in view at 390x844', async ({ page }) => {
    await page.goto('/');
    await expectHero(page);
    await expect(authorCard(page).getByRole('img', { name: 'Vanio Antunes' })).toBeVisible();

    // Author strip first, then the title.
    const title = (await page.getByRole('heading', { level: 1, name: 'ssHelper' }).boundingBox())!;
    const card = (await authorCard(page).boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(title.y);

    // Steps collapsed under "How it works".
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByRole('list', { name: /what ssHelper does/i })).toBeHidden();

    const top = await headingTop(page);
    console.log(`phone heading top: ${top}px`);
    expect(top).toBeLessThanOrEqual(PHONE_HEADING_MAX);
    await expect(strategyHeading(page)).toBeInViewport();

    // Section links as a bar; package cards at the end of the page, after History.
    await expect(sectionNav(page)).toBeVisible();
    await expectPackages(page);
    const history = (await page.getByRole('heading', { level: 2, name: 'History' }).boundingBox())!;
    const pkgs = (await packages(page).boundingBox())!;
    expect(pkgs.y).toBeGreaterThan(history.y);
    await packages(page).getByRole('link').first().scrollIntoViewIfNeeded();
    await expect(packages(page).getByRole('link').first()).toBeInViewport();

    await expectNoHorizontalScroll(page, 390);
    await expectNoAxeViolations(page);
  });

  test('section bar link scrolls the heading into view below the sticky bar', async ({ page }) => {
    await page.goto('/');
    const nav = sectionNav(page);
    const link = nav.getByRole('link', { name: 'Known studies' });
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'true');
    const heading = page.getByRole('heading', { level: 2, name: 'Known studies' });
    await expect(heading).toBeInViewport();
    await expect
      .poll(async () => {
        const navBox = (await nav.boundingBox())!;
        const headingBox = (await heading.boundingBox())!;
        return headingBox.y >= navBox.y + navBox.height;
      })
      .toBe(true);
  });
});

test.describe('phone at 125% text size', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test('first tool heading stays near the top with larger default text', async ({ page }) => {
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'html { font-size: 125%; }';
        document.head.append(style);
      });
    });
    await page.goto('/');
    await expect(strategyHeading(page)).toBeVisible();
    const fontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(fontSize).toBe('20px');

    const top = await headingTop(page);
    console.log(`phone 125% heading top: ${top}px`);
    expect(top).toBeLessThanOrEqual(PHONE_ZOOM_HEADING_MAX);
    await expectNoHorizontalScroll(page, 390);
  });
});

for (const [name, width, height] of [
  ['desktop', 1280, 800],
  ['phone', 390, 844],
] as const) {
  test(`site bar stays pinned to the top while scrolling (${name})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await resetStorage(page);
    await page.reload();
    const bar = page.getByRole('banner');
    await page.getByRole('heading', { level: 2, name: 'History' }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 400);
    const barBox = (await bar.boundingBox())!;
    expect(Math.round(barBox.y)).toBe(0);
    await expect(bar.getByRole('link', { name: 'Tools' })).toBeInViewport();
    // The sticky section nav sits under the bar, never behind it.
    const navBox = (await sectionNav(page).boundingBox())!;
    expect(navBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
  });
}
