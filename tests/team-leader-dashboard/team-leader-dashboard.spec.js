// @ts-check
import { test, expect } from '@playwright/test';
import { injectSession, TEST_TEAM_LEADER, TEST_ORG } from '../helpers/test-users';

test.describe('Team Leader Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, TEST_TEAM_LEADER, TEST_ORG);
    await page.goto('/');
  });

  test('renders team leader profile in sidebar', async ({ page }) => {
    await expect(page.getByText(TEST_TEAM_LEADER.name)).toBeVisible();
    await expect(page.getByText(TEST_TEAM_LEADER.email)).toBeVisible();
  });

  test('team leader can view Daily Task Reports section', async ({ page }) => {
    const nav = page.locator('nav');
    await nav.getByRole('button', { name: /Daily Task Reports/i }).click();

    await expect(page.getByRole('heading', { name: 'Daily Work & EOD Reports' })).toBeVisible();
  });

  test('team leader can view Performance Audits section', async ({ page }) => {
    const nav = page.locator('nav');
    await nav.getByRole('button', { name: /Leader Audits & Ratings/i }).click();

    await expect(page.getByRole('heading', { name: 'Team Leader Performance Audits' })).toBeVisible();
  });
});
