// @ts-check
import { test, expect } from '@playwright/test';
import { injectSession, TEST_FOUNDER, TEST_ORG } from '../helpers/test-users';

test.describe('Responsive UI Layout', () => {
  test('login screen scales cleanly on mobile viewports without horizontal overflow', async ({ page }) => {
    // Set mobile viewport (iPhone SE size)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();

    // Verify no unexpected horizontal page overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('dashboard renders desktop sidebar on 1280x800 desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await injectSession(page, TEST_FOUNDER, TEST_ORG);
    await page.goto('/');

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('button', { name: /Overview/i })).toBeVisible();
  });

  test('dashboard provides mobile hamburger toggle on 390x844 mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await injectSession(page, TEST_FOUNDER, TEST_ORG);
    await page.goto('/');

    // Mobile menu toggle button should be visible on mobile
    const menuToggle = page.getByLabel('Toggle navigation menu');
    await expect(menuToggle).toBeVisible();

    // Open mobile navigation
    await menuToggle.click();

    // Close button should now be visible
    const closeBtn = page.getByLabel('Close menu');
    await expect(closeBtn).toBeVisible();

    // Close mobile menu
    await closeBtn.click();
    await expect(closeBtn).not.toBeVisible();
  });
});
