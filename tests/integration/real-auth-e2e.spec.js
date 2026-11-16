// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { supabase } from '../../server/src/config/supabase.js';
import { safeDeleteTestOrganization, cleanupInterruptedStagingRuns } from '../helpers/test-cleanup.js';

test.describe('Real Authentication, Persistence & Logout (Web UI + Staging Backend)', () => {
  const timestamp = Date.now();
  const testCompanyCode = `TEST-STG-${Math.floor(1000 + Math.random() * 9000)}`;
  const testOrgName = `E2E Staging Org ${timestamp}`;
  const testEmail = `founder.${timestamp}@stagingisolation.internal`;
  const testPassword = 'Password123!';

  let createdOrgId = null;

  test.beforeAll(async ({ request }) => {
    // 0. Strict Pre-Flight Environment Safety Check
    const testEnvPath = path.resolve(__dirname, '../../server/.env.test');
    if (!fs.existsSync(testEnvPath)) {
      throw new Error(
        '\n===============================================================================\n' +
        '[SAFETY GUARD] Integration tests blocked: server/.env.test is missing!\n' +
        'Tests require a dedicated STAGING Supabase project to protect production.\n' +
        'Please copy server/.env.test.example to server/.env.test and enter staging credentials.\n' +
        '===============================================================================\n'
      );
    }

    // Clean up any lingering staging records from previous interrupted runs
    if (supabase) {
      await cleanupInterruptedStagingRuns(supabase);
    }

    // 1. Register a dedicated test company through the real backend API
    const res = await request.post('http://localhost:5000/api/auth/register-company', {
      data: {
        companyName: testOrgName,
        companyCode: testCompanyCode,
        fullName: 'Real Staging Founder',
        email: testEmail,
        password: testPassword,
        industry: 'Testing & QA',
        city: 'Bengaluru'
      }
    });

    if (res.status() !== 201) {
      console.error('REAL AUTH REGISTER FAILED:', res.status(), await res.text());
    }
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    createdOrgId = data.organization.id;
  });

  test.afterAll(async () => {
    // Strict Child-before-Parent Cleanup with Verification
    if (createdOrgId && supabase) {
      await safeDeleteTestOrganization(supabase, createdOrgId);
    }
  });

  test('complete authentic user session: login -> session persistence across reload -> logout', async ({ page }) => {
    await page.goto('/');

    // 1. Ensure we are on the login portal
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();

    const emailInput = page.getByPlaceholder('admin@company.com');
    const passwordInput = page.getByPlaceholder('Enter password');

    // 2. Clear any preloaded defaults and enter real test credentials
    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);

    // 3. Submit form to trigger live fetch to http://localhost:5000/api/auth/login
    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    // 4. Verify dashboard renders with real organization name and role from Supabase
    await expect(page.getByRole('heading', { name: testOrgName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Real Staging Founder')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Founder Command Dashboard' })).toBeVisible();

    // 5. Verify real JWT token was stored in localStorage
    const storedToken = await page.evaluate(() => localStorage.getItem('ems_web_token'));
    expect(storedToken).toBeTruthy();
    expect(storedToken?.length).toBeGreaterThan(20);

    // 6. Test Persistence: Reload browser page
    await page.reload();

    // Dashboard must remain active and not revert to Login View
    await expect(page.getByRole('heading', { name: testOrgName })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).not.toBeVisible();

    // 7. Test Logout: Click Sign Out button
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Verify redirection to login view
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible({ timeout: 5000 });

    // Verify session token was deleted from localStorage
    const clearedToken = await page.evaluate(() => localStorage.getItem('ems_web_token'));
    expect(clearedToken).toBeNull();
  });

  test('submitting wrong password to real backend displays live 401 error message', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByPlaceholder('admin@company.com');
    const passwordInput = page.getByPlaceholder('Enter password');

    await emailInput.fill(testEmail);
    await passwordInput.fill('IncorrectPassword999!');

    await page.getByRole('button', { name: /Sign In to Dashboard/i }).click();

    // Live backend returns HTTP 401 with "Invalid email or password."
    const errorBanner = page.locator('div').filter({ hasText: /Invalid email or password/i }).first();
    await expect(errorBanner).toBeVisible({ timeout: 5000 });

    // Verify user remained on login screen
    await expect(page.getByRole('heading', { name: 'EMS Admin Portal' })).toBeVisible();
  });
});
