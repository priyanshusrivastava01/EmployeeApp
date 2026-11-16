// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Authentication & Login Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any previous session
    await page.goto('/');
  });

  test('application opens successfully and displays correct title and brand header', async ({ page }) => {
    await expect(page).toHaveTitle(/EMS — Founder & Admin Command Center/);
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();
    await expect(page.getByText('Multi-Organization Management Platform')).toBeVisible();
  });

  test('login screen renders required form fields and controls', async ({ page }) => {
    // Email input field
    const emailInput = page.getByPlaceholder('admin@company.com');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('required', '');

    // Password input field
    const passwordInput = page.getByPlaceholder('Enter password');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('required', '');

    // Sign in button
    const submitBtn = page.getByRole('button', { name: /Sign In to Dashboard/i });
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('preset credential buttons populate form inputs correctly', async ({ page }) => {
    const emailInput = page.getByPlaceholder('admin@company.com');
    const passwordInput = page.getByPlaceholder('Enter password');

    // Click Nexus Admin preset
    await page.getByRole('button', { name: /Nexus Admin/i }).click();
    await expect(emailInput).toHaveValue('admin@nexussolutions.in');
    await expect(passwordInput).toHaveValue('admin123');

    // Click Team Leader preset
    await page.getByRole('button', { name: /Team Leader/i }).click();
    await expect(emailInput).toHaveValue('priya.n@acmetech.com');
    await expect(passwordInput).toHaveValue('admin123');

    // Click Employee preset
    await page.getByRole('button', { name: /^Employee/i }).click();
    await expect(emailInput).toHaveValue('aarav.sharma@acmetech.com');
    await expect(passwordInput).toHaveValue('admin123');

    // Click Acme Admin preset back
    await page.getByRole('button', { name: /Acme Admin/i }).click();
    await expect(emailInput).toHaveValue('admin@acmetech.com');
    await expect(passwordInput).toHaveValue('admin123');
  });

  test('theme toggle switches between light and dark modes', async ({ page }) => {
    const themeBtn = page.getByRole('button', { name: /Dark|Light/i });
    await expect(themeBtn).toBeVisible();

    const initialTheme = (await page.locator('html').getAttribute('data-theme')) || 'light';

    // Click theme toggle
    await themeBtn.click();
    const newTheme = await page.locator('html').getAttribute('data-theme');
    expect(newTheme).not.toEqual(initialTheme);

    // Toggle back
    await themeBtn.click();
    const restoredTheme = (await page.locator('html').getAttribute('data-theme')) || 'light';
    expect(restoredTheme).toEqual(initialTheme);
  });
});
