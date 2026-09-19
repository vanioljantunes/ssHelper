import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Fails the test when axe finds WCAG 2.x A or AA violations on the current page. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  // The site bar and tools row are pinned. axe's target-size rule counts a control half hidden
  // under them as too small, which depends only on the scroll position, so audit from the top.
  // Every other rule checks the whole document regardless of scroll.
  await page.evaluate(() => window.scrollTo(0, 0));
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
  expect(summary).toEqual([]);
}
