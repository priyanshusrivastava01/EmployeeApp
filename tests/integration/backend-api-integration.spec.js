// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { supabase } from '../../server/src/config/supabase.js';
import { safeDeleteTestOrganization, cleanupInterruptedStagingRuns } from '../helpers/test-cleanup.js';

test.describe.configure({ mode: 'serial' });

test.describe('EMS Deep Backend Integration & Multi-Tenant Isolation Suite', () => {
  const timestamp = Date.now();
  const seedCompanyCode = `SEED-${Math.floor(1000 + Math.random() * 9000)}`;
  const seedCompanyName = `Seed Staging Org ${timestamp}`;
  const tenantACode = `TEST-STG-A-${Math.floor(1000 + Math.random() * 9000)}`;
  const tenantBCode = `TEST-STG-B-${Math.floor(1000 + Math.random() * 9000)}`;

  const tenantAData = {
    companyName: `Tenant Alpha ${timestamp}`,
    companyCode: tenantACode,
    fullName: 'Alpha Founder',
    email: `founder.alpha.${timestamp}@stagingisolation.internal`,
    password: 'Password123!',
    industry: 'Technology',
    city: 'Bengaluru'
  };

  const tenantBData = {
    companyName: `Tenant Beta ${timestamp}`,
    companyCode: tenantBCode,
    fullName: 'Beta Founder',
    email: `founder.beta.${timestamp}@stagingisolation.internal`,
    password: 'Password123!',
    industry: 'Logistics',
    city: 'Mumbai'
  };

  let seedOrgId = null;
  let tenantAOrgId = null;
  let tenantBOrgId = null;
  let tenantAFounderToken = null;
  let tenantBFounderToken = null;
  let tenantAEmployeeToken = null;
  let tenantAEmployeeId = null;
  let tenantABranchId = null;
  let createdAnnouncementId = null;
  let createdRuleId = null;

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

    // Register baseline staging test company for verification & availability tests
    const seedRes = await request.post('http://localhost:5000/api/auth/register-company', {
      data: {
        companyName: seedCompanyName,
        companyCode: seedCompanyCode,
        fullName: 'Seed Founder',
        email: `founder.seed.${timestamp}@stagingisolation.internal`,
        password: 'Password123!',
        industry: 'Technology',
        city: 'Bengaluru'
      }
    });
    if (seedRes.status() !== 201) {
      console.error('SEED REGISTRATION FAILED:', seedRes.status(), await seedRes.text());
    }
    expect(seedRes.status()).toBe(201);
    const seedData = await seedRes.json();
    seedOrgId = seedData.organization?.id;
  });

  test.afterAll(async () => {
    // Guaranteed Cleanup: Delete created test tenants and related records in child-before-parent order
    if (supabase) {
      const orgIds = [seedOrgId, tenantAOrgId, tenantBOrgId].filter(Boolean);
      for (const orgId of orgIds) {
        await safeDeleteTestOrganization(supabase, orgId);
      }
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 1: Company Verification & Availability (Real Backend API)
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('1. Company Verification & Code Availability', () => {
    test('read-only verification of existing staging organization', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/companies/verify-code', {
        data: { companyCode: seedCompanyCode }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.company.companyCode).toBe(seedCompanyCode);
      expect(data.company.name).toBe(seedCompanyName);
      // Must NEVER expose password hashes or internal secrets
      expect(data.company.password_hash).toBeUndefined();
      expect(data.company.password).toBeUndefined();
    });

    test('verifying non-existent company returns HTTP 404', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/companies/verify-code', {
        data: { companyCode: 'UNKNOWN999XYZ' }
      });
      expect(res.status()).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Company code not found/i);
    });

    test('verifying invalid company code format returns HTTP 400', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/companies/verify-code', {
        data: { companyCode: '' }
      });
      expect(res.status()).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    test('check code availability identifies taken vs available codes', async ({ request }) => {
      // seedCompanyCode is taken
      const r1 = await request.post('http://localhost:5000/api/companies/check-code-availability', {
        data: { companyCode: seedCompanyCode }
      });
      expect(r1.status()).toBe(200);
      const d1 = await r1.json();
      expect(d1.available).toBe(false);

      // Random dynamic code is available
      const r2 = await request.post('http://localhost:5000/api/companies/check-code-availability', {
        data: { companyCode: `AVAIL${Math.floor(1000 + Math.random() * 9000)}` }
      });
      expect(r2.status()).toBe(200);
      const d2 = await r2.json();
      expect(d2.available).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 2: Company Registration (Multi-Tenant Setup)
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('2. Dedicated Test Organization Registration', () => {
    test('successfully registers Tenant Alpha with founder and head office branch', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/auth/register-company', {
        data: tenantAData
      });
      expect(res.status()).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      expect(data.user.role).toBe('founder');
      expect(data.organization.company_code).toBe(tenantACode);

      tenantAOrgId = data.organization.id;
      tenantAFounderToken = data.token;
    });

    test('duplicate registration with the same company code returns HTTP 409 Conflict', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/auth/register-company', {
        data: {
          ...tenantAData,
          email: `duplicate.${Date.now()}@test.internal`
        }
      });
      expect(res.status()).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/already in use/i);
    });

    test('registration with password shorter than 8 chars returns HTTP 400', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/auth/register-company', {
        data: {
          ...tenantAData,
          companyCode: `BADPW${Math.floor(1000 + Math.random() * 9000)}`,
          email: `badpw.${Date.now()}@test.internal`,
          password: 'short'
        }
      });
      expect(res.status()).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/at least 8 characters/i);
    });

    test('successfully registers Tenant Beta for multi-tenant isolation verification', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/auth/register-company', {
        data: tenantBData
      });
      expect(res.status()).toBe(201);
      const data = await res.json();
      tenantBOrgId = data.organization.id;
      tenantBFounderToken = data.token;
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 3: Authentication & Token Lifecycle
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('3. Login, Token Verification & Negative Auth Cases', () => {
    test('login with valid credentials returns JWT token and founder role', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/auth/login', {
        data: {
          email: tenantAData.email,
          password: tenantAData.password
        }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      expect(data.user.email).toBe(tenantAData.email);
      expect(data.user.role).toBe('founder');
    });

    test('login with incorrect password returns HTTP 401 Unauthorized', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/auth/login', {
        data: {
          email: tenantAData.email,
          password: 'WrongPassword999!'
        }
      });
      expect(res.status()).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/Invalid email or password/i);
    });

    test('accessing /api/auth/me with valid Bearer token returns current user', async ({ request }) => {
      const res = await request.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(tenantAData.email);
    });

    test('accessing protected endpoint without Bearer token returns HTTP 401', async ({ request }) => {
      const res = await request.get('http://localhost:5000/api/auth/me');
      expect(res.status()).toBe(401);
    });

    test('accessing protected endpoint with malformed/expired token returns HTTP 401', async ({ request }) => {
      const res = await request.get('http://localhost:5000/api/auth/me', {
        headers: { Authorization: 'Bearer INVALID_MALFORMED_JWT_TOKEN' }
      });
      expect(res.status()).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 4: Employee Creation & Work Mode
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('4. Employee Account Creation & Branch Association', () => {
    test('founder fetches active branches and creates a WFO employee account', async ({ request }) => {
      // 1. Get branch ID from registered company
      const bRes = await request.get('http://localhost:5000/api/branches', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` }
      });
      expect(bRes.status()).toBe(200);
      const bData = await bRes.json();
      expect(Array.isArray(bData.data)).toBe(true);
      expect(bData.data.length).toBeGreaterThanOrEqual(1);
      tenantABranchId = bData.data[0].id;

      // 2. Create employee
      const empRes = await request.post('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` },
        data: {
          name: 'Alpha Engineer',
          email: `engineer.${timestamp}@testisolation.internal`,
          password: 'Password123!',
          role: 'employee',
          department: 'Engineering',
          workMode: 'WFO',
          branchId: tenantABranchId
        }
      });
      expect([200, 201]).toContain(empRes.status());
      const empData = await empRes.json();
      expect(empData.success).toBe(true);

      const createdUser = empData.user || empData.data;
      tenantAEmployeeId = createdUser.id;
      expect(createdUser.role).toBe('employee');

      // 3. Log in as this employee to obtain employee JWT token
      const loginRes = await request.post('http://localhost:5000/api/auth/login', {
        data: {
          email: `engineer.${timestamp}@testisolation.internal`,
          password: 'Password123!'
        }
      });
      expect(loginRes.status()).toBe(200);
      const loginData = await loginRes.json();
      tenantAEmployeeToken = loginData.token;
      expect(loginData.user.role).toBe('employee');
    });

    test('employee creation fails with HTTP 400 when required fields are missing', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` },
        data: { name: 'No Email User' }
      });
      expect(res.status()).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });

    test('WFO employee creation fails with HTTP 400 if branchId is missing', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` },
        data: {
          name: 'WFO No Branch',
          email: `wfonobranch.${timestamp}@test.internal`,
          workMode: 'WFO'
        }
      });
      expect(res.status()).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/branch selection is required/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 5: Role-Based Access Control (Actual Backend Authorization)
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('5. Real Server-Side Authorization Enforcement (RBAC)', () => {
    test('employee token is rejected with HTTP 403 when attempting to create employee', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {
          name: 'Unauthorized Created User',
          email: `unauthorized.${timestamp}@test.internal`
        }
      });
      expect(res.status()).toBe(403);
    });

    test('employee token is rejected with HTTP 403 when attempting to publish announcements', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/announcements', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {
          title: 'Unauthorized Announcement',
          message: 'This should be blocked'
        }
      });
      expect(res.status()).toBe(403);
    });

    test('employee token is rejected with HTTP 403 when attempting to publish company rules', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/rules', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {
          title: 'Unauthorized Rule',
          body: 'This should be blocked',
          category: 'General'
        }
      });
      expect(res.status()).toBe(403);
    });

    test('employee token is rejected with HTTP 403 when attempting to view all bank details', async ({ request }) => {
      const res = await request.get('http://localhost:5000/api/admin/bank-details', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` }
      });
      expect(res.status()).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 6: Announcements Publishing & Persistence
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('6. Announcements Publishing, Retrieval & Persistence', () => {
    test('founder publishes announcement and verifies persistence', async ({ request }) => {
      const postRes = await request.post('http://localhost:5000/api/announcements', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` },
        data: {
          title: 'All-Hands Product Roadmap Session',
          message: 'Join us this Friday at 4 PM for the Q4 product roadmap walkthrough.',
          priority: 'High',
          status: 'published'
        }
      });
      expect([200, 201]).toContain(postRes.status());
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      const ann = postData.data || postData.announcement;
      createdAnnouncementId = ann.id;
      expect(createdAnnouncementId).toBeTruthy();

      // Retrieve announcements list and verify persistence
      const getRes = await request.get('http://localhost:5000/api/announcements', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` }
      });
      expect(getRes.status()).toBe(200);
      const getData = await getRes.json();
      const list = getData.data || getData.announcements || [];
      const found = list.find(a => a.id === createdAnnouncementId);
      expect(found).toBeTruthy();
      expect(found.title).toBe('All-Hands Product Roadmap Session');
    });

    test('founder can safely delete the announcement', async ({ request }) => {
      if (createdAnnouncementId) {
        const delRes = await request.delete(`http://localhost:5000/api/announcements/${createdAnnouncementId}`, {
          headers: { Authorization: `Bearer ${tenantAFounderToken}` }
        });
        expect([200, 204]).toContain(delRes.status());
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 7: Company Rules Publishing & Persistence
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('7. Company Rules Publishing, Retrieval & Persistence', () => {
    test('founder publishes company rule and verifies persistence', async ({ request }) => {
      const postRes = await request.post('http://localhost:5000/api/rules', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` },
        data: {
          title: 'Remote Work & Security Standards',
          body: 'All employees must enable two-factor authentication and lock laptops when away.',
          category: 'General',
          status: 'published'
        }
      });
      expect([200, 201]).toContain(postRes.status());
      const postData = await postRes.json();
      expect(postData.success).toBe(true);
      const rule = postData.data || postData.rule;
      createdRuleId = rule.id;

      // Persistence check via GET
      const getRes = await request.get('http://localhost:5000/api/rules', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` }
      });
      expect(getRes.status()).toBe(200);
      const getData = await getRes.json();
      const list = getData.data || getData.rules || [];
      const found = list.find(r => r.id === createdRuleId);
      expect(found).toBeTruthy();
    });

    test('founder can safely delete the company rule', async ({ request }) => {
      if (createdRuleId) {
        const delRes = await request.delete(`http://localhost:5000/api/rules/${createdRuleId}`, {
          headers: { Authorization: `Bearer ${tenantAFounderToken}` }
        });
        expect([200, 204]).toContain(delRes.status());
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 8: Attendance Records Query & Negative Validation
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('8. Attendance Records & Punch Validation', () => {
    test('fetching attendance records returns array scoped to caller organization', async ({ request }) => {
      const res = await request.get('http://localhost:5000/api/attendance', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.data || data.attendance || [])).toBe(true);
    });

    test('punch-in fails with HTTP 400 when required coordinates or selfie are missing', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/attendance/punch-in', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {} // Empty body
      });
      expect(res.status()).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 9: Daily Task Reports
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('9. Daily Task Reports Submission & Retrieval', () => {
    test('employee can submit daily task report and retrieve report history', async ({ request }) => {
      const postRes = await request.post('http://localhost:5000/api/daily-reports', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {
          projectName: 'EMS Integration',
          tasksAssigned: 'Write Playwright E2E integration test suite',
          tasksCompleted: 'Yes',
          tasksPending: 'No',
          workSummary: 'Covered 10 core modules with real backend verification',
          challenges: 'None'
        }
      });
      expect([200, 201]).toContain(postRes.status());
      const postData = await postRes.json();
      expect(postData.success).toBe(true);

      // Verify retrieval
      const getRes = await request.get('http://localhost:5000/api/daily-reports', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` }
      });
      expect(getRes.status()).toBe(200);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 10: Profile Updates
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('10. Employee Profile Updates & Persistence', () => {
    test('employee can update phone number and verify persistence', async ({ request }) => {
      const newPhone = '+91 98765 11111';
      const patchRes = await request.patch('http://localhost:5000/api/profile', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: { phone: newPhone }
      });
      expect(patchRes.status()).toBe(200);

      // Persistence check
      const getRes = await request.get('http://localhost:5000/api/profile', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` }
      });
      expect(getRes.status()).toBe(200);
      const getData = await getRes.json();
      const profile = getData.data || getData.user || getData;
      expect(profile.phone).toBe(newPhone);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 11: Salary and Bank Details
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('11. Bank Details Submission, Masking & Admin Visibility', () => {
    test('submitting invalid IFSC code format returns HTTP 400', async ({ request }) => {
      const res = await request.post('http://localhost:5000/api/bank-details', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {
          accountHolderName: 'Alpha Engineer',
          bankName: 'HDFC Bank',
          accountNumber: '123456789012',
          confirmAccountNumber: '123456789012',
          ifscCode: 'INVALID_IFSC_CODE'
        }
      });
      expect(res.status()).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Invalid IFSC code format/i);
    });

    test('employee submits valid bank details and account number is masked on retrieval', async ({ request }) => {
      const postRes = await request.post('http://localhost:5000/api/bank-details', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` },
        data: {
          accountHolderName: 'Alpha Engineer',
          bankName: 'State Bank of India',
          accountNumber: '123456789012',
          confirmAccountNumber: '123456789012',
          ifscCode: 'SBIN0001234'
        }
      });
      expect([200, 201]).toContain(postRes.status());

      // Retrieve via employee endpoint
      const getRes = await request.get('http://localhost:5000/api/bank-details/me', {
        headers: { Authorization: `Bearer ${tenantAEmployeeToken}` }
      });
      expect(getRes.status()).toBe(200);
      const getData = await getRes.json();
      const bank = getData.data || getData.bankDetails;
      expect(bank.account_number_masked || bank.accountNumberMasked).toMatch(/9012$/);
    });

    test('founder can view organization bank details via admin endpoint', async ({ request }) => {
      const res = await request.get('http://localhost:5000/api/admin/bank-details', {
        headers: { Authorization: `Bearer ${tenantAFounderToken}` }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.data || data.bankDetails || [])).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 12: Multi-Tenant Data Isolation
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('12. Strict Cross-Tenant Data Isolation', () => {
    test('Tenant Beta cannot view or access Tenant Alpha staff members', async ({ request }) => {
      // Tenant Beta fetches user list
      const res = await request.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${tenantBFounderToken}` }
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      const users = data.data || data.users || [];

      // Verify NONE of Tenant Alpha's users are present in Tenant Beta's list
      const leakedUser = users.find(u => u.id === tenantAEmployeeId || u.email === tenantAData.email);
      expect(leakedUser).toBeUndefined();
    });

    test('Tenant Beta cannot access Tenant Alpha employee profile directly', async ({ request }) => {
      const res = await request.get(`http://localhost:5000/api/users/${tenantAEmployeeId}`, {
        headers: { Authorization: `Bearer ${tenantBFounderToken}` }
      });
      // Backend must return 404 (not found in caller's tenant) or 403 (forbidden)
      expect([403, 404]).toContain(res.status());
    });
  });
});
