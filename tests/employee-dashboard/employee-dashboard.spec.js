// @ts-check
import { test, expect } from '@playwright/test';
import { injectSession, TEST_EMPLOYEE, TEST_ORG } from '../helpers/test-users';

test.describe('Employee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, TEST_EMPLOYEE, TEST_ORG);
    await page.goto('/');
  });

  test('renders employee profile and staff portal tag in sidebar', async ({ page }) => {
    await expect(page.getByText('Staff Portal')).toBeVisible();
    await expect(page.getByText(TEST_EMPLOYEE.email)).toBeVisible();
    await expect(page.getByText(TEST_EMPLOYEE.name).first()).toBeVisible();
  });

  test('employee can navigate to announcements and company rules', async ({ page }) => {
    const nav = page.locator('nav');

    // Announcements
    await nav.getByRole('button', { name: /Announcements/i }).click();
    await expect(page.getByRole('heading', { name: 'Announcements & Broadcasts', exact: true })).toBeVisible();

    // Notes & Rules
    await nav.getByRole('button', { name: /Notes & Rules/i }).click();
    await expect(page.getByRole('heading', { name: 'Company Notes & Rules' })).toBeVisible();
  });
});
