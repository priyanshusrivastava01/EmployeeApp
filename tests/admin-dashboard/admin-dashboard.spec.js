// @ts-check
import { test, expect } from '@playwright/test';
import { injectSession, TEST_ADMIN, TEST_ORG } from '../helpers/test-users';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectSession(page, TEST_ADMIN, TEST_ORG);
    await page.goto('/');
  });

  test('renders organization admin role and header correctly', async ({ page }) => {
    await expect(page.getByText('Organization Admin')).toBeVisible();
    await expect(page.getByText(TEST_ADMIN.name)).toBeVisible();
  });

  test('admin can navigate to Staff Directory and view employee controls', async ({ page }) => {
    const nav = page.locator('nav');
    await nav.getByRole('button', { name: /Staff Directory/i }).click();

    await expect(page.getByRole('heading', { name: 'Staff & Team Directory' })).toBeVisible();

    // Search input field
    const searchInput = page.getByPlaceholder('Search employee by name, email, or designation...');
    await expect(searchInput).toBeVisible();

    // Add employee button
    const addBtn = page.getByRole('button', { name: 'Add Employee' });
    await expect(addBtn).toBeVisible();
  });

  test('admin can open and close Add New Employee modal', async ({ page }) => {
    // Intercept backend API requests so offline tests don't delay on connection timeout
    await page.route('**/api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] })
    }));

    const nav = page.locator('nav');
    await nav.getByRole('button', { name: /Staff Directory/i }).click();
    await expect(page.getByRole('heading', { name: 'Staff & Team Directory' })).toBeVisible();

    // Click Add Employee button in header
    const addBtn = page.getByRole('button', { name: 'Add Employee' });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Modal appears
    await expect(page.getByRole('heading', { name: 'Add New Employee' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('e.g. Aarav Sharma')).toBeVisible();

    // Click Cancel to safely close modal without submitting
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Employee' })).not.toBeVisible();
  });
});
