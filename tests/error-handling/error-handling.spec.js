// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Error Handling & Protected Routes', () => {
  test('unauthenticated visitor cannot access protected dashboard views', async ({ page }) => {
    // Navigate with completely clean storage
    await page.goto('/');

    // Must show Login View
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();

    // Protected dashboard elements must NOT be visible
    await expect(page.getByRole('heading', { name: 'Founder Command Dashboard' })).not.toBeVisible();
    await expect(page.locator('nav')).not.toBeVisible();
  });

  test('submitting with empty email shows required field validation', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByPlaceholder('admin@company.com');
    await emailInput.fill('');

    // HTML5 validation: check validity of the required email input
    const isEmailValid = await emailInput.evaluate((el) => /** @type {HTMLInputElement} */ (el).checkValidity());
    expect(isEmailValid).toBe(false);
  });

  test('submitting invalid credentials displays an error feedback banner', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByPlaceholder('admin@company.com');
    const passwordInput = page.getByPlaceholder('Enter password');

    await emailInput.fill('unregistered-user@company.com');
    await passwordInput.fill('wrongpassword123');

    // Submit form
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    // Verify error banner is rendered with appropriate message
    const errorBanner = page.locator('div').filter({ hasText: /Failed to fetch|NetworkError|Cannot connect|Invalid|Login failed|Load failed/i }).first();
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
  });

  test('corrupted or invalid local storage data safely falls back to login portal', async ({ page }) => {
    // Inject corrupt JSON into storage
    await page.addInitScript(() => {
      localStorage.setItem('ems_web_user', 'CORRUPT_NOT_JSON');
      localStorage.setItem('ems_web_token', '');
    });

    await page.goto('/');

    // App should not crash with white screen, but safely render Login Portal
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();
  });
});
