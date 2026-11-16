// @ts-check
import { test, expect } from '@playwright/test';
import { injectSession, TEST_FOUNDER, TEST_ORG } from '../helpers/test-users';

test.describe('Founder Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, TEST_FOUNDER, TEST_ORG);
    await page.goto('/');
  });

  test('renders founder command center with organization and profile info', async ({ page }) => {
    // Header title for Founder overview
    await expect(page.getByRole('heading', { name: 'Founder Command Dashboard' })).toBeVisible();

    // Organization name in sidebar
    await expect(page.getByRole('heading', { name: TEST_ORG.name })).toBeVisible();

    // User profile in bottom sidebar
    await expect(page.getByText(TEST_FOUNDER.name)).toBeVisible();
    await expect(page.getByText(TEST_FOUNDER.email)).toBeVisible();
  });

  test('founder dashboard renders all primary management tabs', async ({ page }) => {
    const nav = page.locator('nav');

    await expect(nav.getByRole('button', { name: /Overview/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Staff Directory/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Attendance Logs/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Daily Task Reports/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Leader Audits & Ratings/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Office Geofencing/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Announcements/i })).toBeVisible();
    await expect(nav.getByRole('button', { name: /Notes & Rules/i })).toBeVisible();
  });

  test('founder can sign out safely and return to login screen', async ({ page }) => {
    const signOutBtn = page.getByTitle('Sign Out');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Should return to login portal
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();
    await expect(page.getByPlaceholder('admin@company.com')).toBeVisible();

    // Verify localStorage auth tokens were removed
    const storedToken = await page.evaluate(() => localStorage.getItem('ems_web_token'));
    const storedUser = await page.evaluate(() => localStorage.getItem('ems_web_user'));
    expect(storedToken).toBeNull();
    expect(storedUser).toBeNull();
  });
});
