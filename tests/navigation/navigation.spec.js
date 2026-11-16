// @ts-check
import { test, expect } from '@playwright/test';
import { injectSession, TEST_FOUNDER, TEST_ORG } from '../helpers/test-users';

test.describe('Role-Based Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, TEST_FOUNDER, TEST_ORG);
    await page.goto('/');
  });

  test('navigates seamlessly between all management dashboard tabs', async ({ page }) => {
    const nav = page.locator('nav');

    // 1. Overview
    await expect(page.getByRole('heading', { name: 'Founder Command Dashboard' })).toBeVisible();

    // 2. Staff Directory
    await nav.getByRole('button', { name: /Staff Directory/i }).click();
    await expect(page.getByRole('heading', { name: 'Staff & Team Directory' })).toBeVisible();

    // 3. Attendance Logs
    await nav.getByRole('button', { name: /Attendance Logs/i }).click();
    await expect(page.getByRole('heading', { name: 'Daily Attendance & Geofence Logs' })).toBeVisible();

    // 4. Daily Task Reports
    await nav.getByRole('button', { name: /Daily Task Reports/i }).click();
    await expect(page.getByRole('heading', { name: 'Daily Work & EOD Reports' })).toBeVisible();

    // 5. Leader Audits & Ratings
    await nav.getByRole('button', { name: /Leader Audits & Ratings/i }).click();
    await expect(page.getByRole('heading', { name: 'Team Leader Performance Audits' })).toBeVisible();

    // 6. Office Geofencing
    await nav.getByRole('button', { name: /Office Geofencing/i }).click();
    await expect(page.getByRole('heading', { name: 'Office Geofencing Perimeter' })).toBeVisible();

    // 7. Announcements
    await nav.getByRole('button', { name: /Announcements/i }).click();
    await expect(page.getByRole('heading', { name: 'Announcements & Broadcasts', exact: true })).toBeVisible();

    // 8. Notes & Rules
    await nav.getByRole('button', { name: /Notes & Rules/i }).click();
    await expect(page.getByRole('heading', { name: 'Company Notes & Rules' })).toBeVisible();

    // Return to Overview
    await nav.getByRole('button', { name: /Overview/i }).click();
    await expect(page.getByRole('heading', { name: 'Founder Command Dashboard' })).toBeVisible();
  });
});
