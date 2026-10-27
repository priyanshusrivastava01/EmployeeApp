/**
 * Automated test suite for Secure Multi-Organization Company Registration & Employee Onboarding
 * Tests all 40 requirements across:
 * 1. Company Registration & First Founder Creation
 * 2. Public Company ID and Founder ID Generation
 * 3. Employee Creation & Invitation Lifecycle
 * 4. Join Company / Account Activation Flow
 * 5. Role-based Management & Employee Login (with Email & Employee ID)
 * 6. Portal Mismatch Validation
 * 7. Password Recovery & Single-Use Reset Codes
 */

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName} ${details ? '- ' + details : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('EMS COMPANY ONBOARDING & AUTHENTICATION TEST SUITE');
  console.log('==================================================\n');

  const timestamp = Date.now();
  const testSlug = `horizon-${timestamp}`;
  let registeredCompanyId = null;
  let registeredFounderId = null;
  let founderToken = null;
  let inviteCode = null;
  let invitedEmployeeId = null;
  let employeeToken = null;

  // 1. Company Registration
  console.log('--- 1. COMPANY REGISTRATION & FIRST FOUNDER ---');
  const regRes = await request('POST', '/auth/register-company', {
    fullName: 'Elena Rostova',
    email: `elena.${timestamp}@horizontech.com`,
    phone: '+91 99887 76655',
    password: 'FounderPassword123!',
    confirmPassword: 'FounderPassword123!',
    companyName: 'Horizon Aerospace Technologies',
    companySlug: testSlug,
    industry: 'Aerospace & Defence',
    country: 'India',
    city: 'Hyderabad',
    timezone: 'Asia/Kolkata',
    employeeSize: '100-250'
  });

  assert(regRes.status === 201, 'Registration returns HTTP 201', `Got status ${regRes.status}`);
  assert(regRes.body.success === true, 'Response reports success: true');
  assert(typeof regRes.body.companyId === 'string' && regRes.body.companyId.startsWith('CMP-'), `Company ID generated with prefix CMP- (Got: ${regRes.body.companyId})`);
  assert(regRes.body.founderId === 'FND-0001', `First Founder ID assigned as FND-0001 (Got: ${regRes.body.founderId})`);
  assert(regRes.body.user && regRes.body.user.role === 'founder', `First user has server-enforced role: founder (Got: ${regRes.body.user?.role})`);
  assert(typeof regRes.body.token === 'string', 'Valid JWT token returned for immediate login');

  registeredCompanyId = regRes.body.companyId;
  registeredFounderId = regRes.body.founderId;
  founderToken = regRes.body.token;

  // 2. Slug Uniqueness
  console.log('\n--- 2. SLUG & EMAIL UNIQUENESS ---');
  const dupSlugRes = await request('POST', '/auth/register-company', {
    fullName: 'Another User',
    email: `other.${timestamp}@test.com`,
    password: 'FounderPassword123!',
    confirmPassword: 'FounderPassword123!',
    companyName: 'Duplicate Slug Corp',
    companySlug: testSlug
  });
  assert(dupSlugRes.status === 409, 'Duplicate company slug rejected with HTTP 409', `Got ${dupSlugRes.status}`);

  const dupEmailRes = await request('POST', '/auth/register-company', {
    fullName: 'Elena Rostova Impersonator',
    email: `elena.${timestamp}@horizontech.com`,
    password: 'FounderPassword123!',
    confirmPassword: 'FounderPassword123!',
    companyName: 'New Company Same Email',
    companySlug: `newslug-${timestamp}`
  });
  assert(dupEmailRes.status === 409, 'Duplicate email rejected with HTTP 409', `Got ${dupEmailRes.status}`);

  // 3. Password Validation
  console.log('\n--- 3. REGISTRATION VALIDATION ---');
  const shortPassRes = await request('POST', '/auth/register-company', {
    fullName: 'Short Pass',
    email: `short.${timestamp}@test.com`,
    password: '123',
    confirmPassword: '123',
    companyName: 'Short Corp',
    companySlug: `short-${timestamp}`
  });
  assert(shortPassRes.status === 400, 'Password < 8 characters rejected with HTTP 400', `Got ${shortPassRes.status}`);

  // 4. Founder Management Login
  console.log('\n--- 4. FOUNDER MANAGEMENT LOGIN ---');
  const founderLoginRes = await request('POST', '/auth/login', {
    email: `elena.${timestamp}@horizontech.com`,
    password: 'FounderPassword123!',
    portal: 'management'
  });
  assert(founderLoginRes.status === 200, 'Founder can log in to Management Portal with email', `Got ${founderLoginRes.status}`);
  assert(founderLoginRes.body.user.employeeId === 'FND-0001', `Founder profile includes employeeId FND-0001 (Got: ${founderLoginRes.body.user?.employeeId})`);
  assert(founderLoginRes.body.organization.companyId === registeredCompanyId, `Founder login response includes public Company ID (Got: ${founderLoginRes.body.organization?.companyId})`);

  // Founder login using Founder ID instead of email
  const founderIdLoginRes = await request('POST', '/auth/login', {
    email: 'FND-0001',
    password: 'FounderPassword123!',
    portal: 'management',
    companyId: registeredCompanyId
  });
  assert(founderIdLoginRes.status === 200, 'Founder can log in with Founder ID (FND-0001) + Company ID', `Got ${founderIdLoginRes.status}`);

  // 5. Founder Company Settings Retrieval
  console.log('\n--- 5. COMPANY SETTINGS & COMPANY ID RETRIEVAL ---');
  const orgSettingsRes = await request('GET', '/org/settings', null, founderToken);
  assert(orgSettingsRes.status === 200, 'Founder can access Company Settings', `Got ${orgSettingsRes.status}`);
  assert(orgSettingsRes.body.data.companyId === registeredCompanyId, `Company ID retrieved from Settings matches registered Company ID (${orgSettingsRes.body.data?.companyId})`);

  // 6. Employee Invitation
  console.log('\n--- 6. EMPLOYEE INVITATION LIFECYCLE ---');
  const inviteRes = await request('POST', '/invitations', {
    name: 'Devin Vance',
    email: `devin.${timestamp}@horizontech.com`,
    role: 'employee',
    department: 'Engineering',
    designation: 'Propulsion Specialist',
    phone: '+91 99112 23344'
  }, founderToken);

  assert(inviteRes.status === 201, 'Founder can invite employee (HTTP 201)', `Got ${inviteRes.status}`);
  assert(typeof inviteRes.body.invitation?.invitationCode === 'string', `Invitation code generated (Got: ${inviteRes.body.invitation?.invitationCode})`);
  assert(inviteRes.body.invitation?.employeeId === 'EMP-0001', `First Employee ID assigned as EMP-0001 (Got: ${inviteRes.body.invitation?.employeeId})`);
  assert(inviteRes.body.invitation?.companyId === registeredCompanyId, `Invitation references correct Company ID`);

  inviteCode = inviteRes.body.invitation.invitationCode;
  invitedEmployeeId = inviteRes.body.invitation.employeeId;

  // Verify second employee gets EMP-0002
  const inviteRes2 = await request('POST', '/invitations', {
    name: 'Sarah Connor',
    email: `sarah.${timestamp}@horizontech.com`,
    role: 'employee',
    department: 'Cybernetics',
    designation: 'Systems Architect'
  }, founderToken);
  assert(inviteRes2.body.invitation?.employeeId === 'EMP-0002', `Second Employee ID sequentially assigned as EMP-0002 (Got: ${inviteRes2.body.invitation?.employeeId})`);

  // Verify list invitations
  const listInvRes = await request('GET', '/invitations', null, founderToken);
  assert(listInvRes.status === 200 && Array.isArray(listInvRes.body.data), 'Founder can list organization invitations');
  assert(listInvRes.body.data.some(i => i.email === `devin.${timestamp}@horizontech.com`), 'Pending invitation appears in list');

  // 7. Inactive Employee Login Blocked Before Activation
  console.log('\n--- 7. INACTIVE USER LOGIN REJECTION ---');
  const preActiveLogin = await request('POST', '/auth/login', {
    email: `devin.${timestamp}@horizontech.com`,
    password: 'AnyPassword123!',
    portal: 'employee'
  });
  assert(preActiveLogin.status === 403, 'Unactivated employee login is rejected with HTTP 403', `Got ${preActiveLogin.status}`);

  // 8. Join Company & Account Activation
  console.log('\n--- 8. JOIN AN EXISTING COMPANY & ACCOUNT ACTIVATION ---');
  // Test wrong company ID
  const wrongCompanyRes = await request('POST', '/auth/join-company', {
    companyId: 'CMP-INVALID99',
    employeeIdOrEmail: invitedEmployeeId,
    invitationCode: inviteCode,
    password: 'EmployeePass123!',
    confirmPassword: 'EmployeePass123!'
  });
  assert(wrongCompanyRes.status === 404, 'Invalid Company ID rejected with HTTP 404', `Got ${wrongCompanyRes.status}`);

  // Test wrong invitation code
  const wrongCodeRes = await request('POST', '/auth/join-company', {
    companyId: registeredCompanyId,
    employeeIdOrEmail: invitedEmployeeId,
    invitationCode: 'INV-FAKE01',
    password: 'EmployeePass123!',
    confirmPassword: 'EmployeePass123!'
  });
  assert(wrongCodeRes.status === 400, 'Invalid invitation code rejected with HTTP 400', `Got ${wrongCodeRes.status}`);

  // Successful Activation
  const joinRes = await request('POST', '/auth/join-company', {
    companyId: registeredCompanyId,
    employeeIdOrEmail: invitedEmployeeId,
    invitationCode: inviteCode,
    password: 'EmployeePass123!',
    confirmPassword: 'EmployeePass123!'
  });
  assert(joinRes.status === 200, 'Account successfully activated (HTTP 200)', `Got ${joinRes.status}`);
  assert(joinRes.body.user?.role === 'employee', `Activated user has role: employee (Got: ${joinRes.body.user?.role})`);
  assert(joinRes.body.user?.employeeId === 'EMP-0001', `Activated user has employeeId: EMP-0001 (Got: ${joinRes.body.user?.employeeId})`);
  assert(typeof joinRes.body.token === 'string', 'JWT token issued on activation');
  employeeToken = joinRes.body.token;

  // Single-use token enforcement
  const reuseRes = await request('POST', '/auth/join-company', {
    companyId: registeredCompanyId,
    employeeIdOrEmail: invitedEmployeeId,
    invitationCode: inviteCode,
    password: 'AnotherPassword123!',
    confirmPassword: 'AnotherPassword123!'
  });
  assert(reuseRes.status === 400 && reuseRes.body.error.includes('already been used'), 'Used invitation code cannot be reused (single-use enforced)');

  // 9. Employee Login
  console.log('\n--- 9. EMPLOYEE LOGIN & PORTAL ENFORCEMENT ---');
  // Login with Email
  const empEmailLogin = await request('POST', '/auth/login', {
    email: `devin.${timestamp}@horizontech.com`,
    password: 'EmployeePass123!',
    portal: 'employee'
  });
  assert(empEmailLogin.status === 200, 'Activated employee can log in with email', `Got ${empEmailLogin.status}`);

  // Login with Employee ID + Company ID
  const empIdLogin = await request('POST', '/auth/login', {
    email: 'EMP-0001',
    password: 'EmployeePass123!',
    portal: 'employee',
    companyId: registeredCompanyId
  });
  assert(empIdLogin.status === 200, 'Activated employee can log in with Employee ID (EMP-0001) + Company ID', `Got ${empIdLogin.status}`);

  // Portal Mismatch: Employee trying to use Management Login
  const empMgmtLogin = await request('POST', '/auth/login', {
    email: `devin.${timestamp}@horizontech.com`,
    password: 'EmployeePass123!',
    portal: 'management'
  });
  assert(empMgmtLogin.status === 403 && empMgmtLogin.body.code === 'PORTAL_MISMATCH', 'Employee accessing Management Login receives PORTAL_MISMATCH (HTTP 403)');

  // Portal Mismatch: Founder trying to use Employee Login
  const founderEmpLogin = await request('POST', '/auth/login', {
    email: `elena.${timestamp}@horizontech.com`,
    password: 'FounderPassword123!',
    portal: 'employee'
  });
  assert(founderEmpLogin.status === 403 && founderEmpLogin.body.code === 'PORTAL_MISMATCH', 'Founder accessing Employee Login receives PORTAL_MISMATCH (HTTP 403)');

  // 10. Role-Based Permissions & Isolation
  console.log('\n--- 10. ROLE-BASED ACCESS & DATA ISOLATION ---');
  // Employee cannot access management API (/invitations)
  const empInviteAttempt = await request('GET', '/invitations', null, employeeToken);
  assert(empInviteAttempt.status === 403, 'Employee cannot access /api/invitations (HTTP 403)', `Got ${empInviteAttempt.status}`);

  // Employee cannot access /api/org/settings PATCH
  const empSettingsAttempt = await request('PATCH', '/org/settings', { name: 'Hacked Name' }, employeeToken);
  assert(empSettingsAttempt.status === 403, 'Employee cannot modify organization settings (HTTP 403)', `Got ${empSettingsAttempt.status}`);

  // 11. Revoke Invitation
  console.log('\n--- 11. INVITATION REVOCATION ---');
  const inviteToRevoke = await request('POST', '/invitations', {
    name: 'Temporary Worker',
    email: `temp.${timestamp}@horizontech.com`,
    role: 'employee'
  }, founderToken);
  const revokeId = inviteToRevoke.body.invitation.id;
  const revokedCode = inviteToRevoke.body.invitation.invitationCode;

  const revokeRes = await request('POST', `/invitations/${revokeId}/revoke`, null, founderToken);
  assert(revokeRes.status === 200, 'Founder can revoke an active invitation', `Got ${revokeRes.status}`);

  const joinRevokedRes = await request('POST', '/auth/join-company', {
    companyId: registeredCompanyId,
    employeeIdOrEmail: `temp.${timestamp}@horizontech.com`,
    invitationCode: revokedCode,
    password: 'NewTempPassword123!',
    confirmPassword: 'NewTempPassword123!'
  });
  assert(joinRevokedRes.status === 400 && joinRevokedRes.body.error.includes('revoked'), 'Revoked invitation cannot be activated', `Got ${joinRevokedRes.status}`);

  // 12. Password Reset Workflow
  console.log('\n--- 12. ZERO-COST PASSWORD RECOVERY ---');
  const forgotRes = await request('POST', '/auth/forgot-password', {
    email: `devin.${timestamp}@horizontech.com`
  });
  assert(forgotRes.status === 200, 'Forgot password initiates successfully (HTTP 200)', `Got ${forgotRes.status}`);
  assert(typeof forgotRes.body.devResetCode === 'string', `Dev reset code returned in zero-cost mode (Got: ${forgotRes.body.devResetCode})`);

  const resetCode = forgotRes.body.devResetCode;

  // Reset password
  const resetRes = await request('POST', '/auth/reset-password', {
    email: `devin.${timestamp}@horizontech.com`,
    resetCode,
    newPassword: 'BrandNewPassword456!',
    confirmPassword: 'BrandNewPassword456!'
  });
  assert(resetRes.status === 200, 'Password reset succeeds with valid reset code', `Got ${resetRes.status}`);

  // Reset code cannot be reused
  const reuseResetRes = await request('POST', '/auth/reset-password', {
    email: `devin.${timestamp}@horizontech.com`,
    resetCode,
    newPassword: 'ThirdPassword789!',
    confirmPassword: 'ThirdPassword789!'
  });
  assert(reuseResetRes.status === 400, 'Password reset code is single-use and cannot be reused', `Got ${reuseResetRes.status}`);

  // Log in with new password
  const newPassLogin = await request('POST', '/auth/login', {
    email: `devin.${timestamp}@horizontech.com`,
    password: 'BrandNewPassword456!',
    portal: 'employee'
  });
  assert(newPassLogin.status === 200, 'Employee can log in with newly reset password', `Got ${newPassLogin.status}`);

  // Old password no longer works
  const oldPassLogin = await request('POST', '/auth/login', {
    email: `devin.${timestamp}@horizontech.com`,
    password: 'EmployeePass123!',
    portal: 'employee'
  });
  assert(oldPassLogin.status === 401, 'Old password is no longer accepted (HTTP 401)', `Got ${oldPassLogin.status}`);

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
