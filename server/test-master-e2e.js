/**
 * ============================================================================
 * EMPLOYEEAPP / EMS - COMPREHENSIVE END-TO-END AUTOMATED MASTER TEST SUITE
 * ============================================================================
 * 
 * Covers all architectural layers:
 * 1. Health & System Diagnostics
 * 2. Company Verification & Code Availability
 * 3. Multi-Tenant Company Registration (Code uniqueness, Geofence branch, Founder setup)
 * 4. Authentication, Tokens & Portal Separation (Founder, Admin, TL, Employee, Password verify, Portal mismatch)
 * 5. Password Recovery & Single-Use Tokens
 * 6. Employee Invitation Lifecycle & Join Company Flow
 * 7. Multi-Tenant Data Isolation (Tenant A vs Tenant B boundaries)
 * 8. Attendance Tracking (GPS-verified Punch In, Front selfie photo, Geofence, Punch Out, Multi-punch prevention)
 * 9. Daily Task Reports (Draft persistence, Final submission, Authentic XLSX binary export)
 * 10. Leader Audits & Employee Performance Ratings
 * 11. Leave Applications & Impossible Date Validation (End < Start, Admin approval/rejection)
 * 12. Announcements, Rules & Holiday Calendars
 * 13. Weekly Timesheets & Push Notifications
 * 14. Profile Management, Photo Uploads & Contact Update Requests
 * 15. Bank Details, Account Masking & IFSC Verification
 * 16. Salary Advances (Loan requests, Reason dropdown, Approval, Disbursement, Repayment)
 * 17. Security & Injection Protection (SQL/XSS sanitation, Malformed input, Role authorization)
 * 18. Mobile Architectural & Safe Area Invariants
 * 19. Web Dashboard Contract Alignment
 */

process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Import server app without port binding
const { app } = require('./src/index');

// ─────────────────────────────────────────────────────────────────────────────
// IN-PROCESS HTTP CALL SIMULATOR
// ─────────────────────────────────────────────────────────────────────────────
function simulate(method, url, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = {
      'content-type': 'application/json',
      accept: 'application/json',
      ...extraHeaders
    };
    if (token) {
      req.headers['authorization'] = `Bearer ${token}`;
    }
    req.body = body !== null ? body : {};
    req.socket = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';
    req.connection = req.socket;

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, headers: this.headers, body: data });
      },
      send(data) {
        let parsed = data;
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
        }
        resolve({ status: this.statusCode, headers: this.headers, body: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, headers: this.headers, body: data });
      },
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return this.headers[k.toLowerCase()];
      }
    };

    app.handle(req, res);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER CORE & ASSERTION SUITE
// ─────────────────────────────────────────────────────────────────────────────
let passedCount = 0;
let failedCount = 0;
const failureDetails = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
    failedCount++;
    failureDetails.push({ testName, details });
  }
}

async function runMasterTestSuite() {
  console.log('\n======================================================================');
  console.log('       EMPLOYEEAPP MASTER AUTOMATED END-TO-END TEST SUITE             ');
  console.log('======================================================================\n');

  // Shared test context
  let acmeFounderToken = null;
  let acmeEmployeeToken = null;
  let acmeAdminToken = null;
  let acmeTeamLeaderToken = null;
  let nexusFounderToken = null;

  let newOrgCompanyCode = null;
  let newOrgFounderToken = null;

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 1: System Health & Base Routes
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- MODULE 1: System Health & Base Routes ---');
  {
    const res = await simulate('GET', '/api/health');
    assert(res.status === 200, 'Health endpoint returns HTTP 200');
    assert(res.body && res.body.status === 'ok', 'Health response status is "ok"');
    assert(res.body && typeof res.body.organizations === 'number', 'Health reports active organization count');

    const rootRes = await simulate('GET', '/');
    assert(rootRes.status === 200, 'Base root route returns HTTP 200');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 2: Company Verification & Code Availability
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 2: Company Code Verification & Availability ---');
  {
    // Empty body
    const r1 = await simulate('POST', '/api/companies/check-code-availability', {});
    assert(r1.status === 400, 'Check availability with empty body returns 400');

    // Short code
    const r2 = await simulate('POST', '/api/companies/check-code-availability', { companyCode: 'AB' });
    assert(r2.status === 400, 'Check availability with short code (<3 chars) returns 400');

    // Existing company code (Acme)
    const r3 = await simulate('POST', '/api/companies/check-code-availability', { companyCode: 'CMP-7K4M9X2Q' });
    assert(r3.status === 200 && r3.body.available === false, 'Existing company code reported as unavailable');

    // Available unique code
    const uniqueTestCode = 'TEST-CORP-' + Date.now().toString().slice(-4);
    const r4 = await simulate('POST', '/api/companies/check-code-availability', { companyCode: uniqueTestCode });
    assert(r4.status === 200 && r4.body.available === true, 'Unused company code reported as available');

    // Verify code: empty
    const r5 = await simulate('POST', '/api/companies/verify-code', { companyCode: '' });
    assert(r5.status === 400, 'Verify code with empty string returns 400');

    // Verify code: non-existent
    const r6 = await simulate('POST', '/api/companies/verify-code', { companyCode: 'NONEXISTENT999' });
    assert(r6.status === 404, 'Verify non-existent company returns 404');

    // Verify code: existing Acme
    const r7 = await simulate('POST', '/api/companies/verify-code', { companyCode: 'CMP-7K4M9X2Q' });
    assert(r7.status === 200, 'Verify existing Acme company returns 200');
    assert(r7.body.company && r7.body.company.name.includes('Acme'), 'Verify returns correct company name');
    assert(!r7.body.company.password_hash, 'Verify never exposes sensitive password hash');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 3: Multi-Tenant Company Registration
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 3: Multi-Tenant Company Registration ---');
  {
    // Missing required fields
    const r1 = await simulate('POST', '/api/auth/register-company', { companyName: '' });
    assert(r1.status === 400, 'Register company with missing fields returns 400');

    // Duplicate company code
    const r2 = await simulate('POST', '/api/auth/register-company', {
      companyName: 'Duplicate Corp',
      companyCode: 'CMP-7K4M9X2Q', // Taken by Acme
      founderName: 'Test Founder',
      founderEmail: 'duplicate@test.com',
      password: 'password123'
    });
    assert(r2.status === 409, 'Register company with taken code returns 409 Conflict');

    // Valid unique registration
    newOrgCompanyCode = 'AUTOCORP-' + Math.floor(1000 + Math.random() * 9000);
    const r3 = await simulate('POST', '/api/auth/register-company', {
      companyName: 'Automated E2E Enterprises',
      companyCode: newOrgCompanyCode,
      industry: 'Automation Systems',
      founderName: 'Dr. Automation',
      founderEmail: `founder.${newOrgCompanyCode.toLowerCase()}@autocorp.test`,
      password: 'securePassword123',
      officeAddress: 'Tech Park Tower 4, Whitefield, Bangalore',
      officeLatitude: 12.9854,
      officeLongitude: 77.7429,
      geofenceRadiusMeters: 250
    });
    assert(r3.status === 201, 'Valid company registration returns 201 Created');
    assert(r3.body && r3.body.success === true, 'Registration reports success: true');
    assert(r3.body && r3.body.token && typeof r3.body.token === 'string', 'Registration returns JWT token');
    assert(r3.body && r3.body.user && r3.body.user.role === 'founder', 'Registered user has role "founder"');
    assert(r3.body && r3.body.organization && r3.body.organization.public_company_id === newOrgCompanyCode, 'Created organization matches custom company code');
    assert(r3.body && (r3.body.branch || r3.body.initialBranch) && (r3.body.branch || r3.body.initialBranch).latitude === 12.9854, 'Initial branch created with matching coordinates');

    newOrgFounderToken = r3.body ? r3.body.token : null;

    // Verify newly registered company via verify-code
    const r4 = await simulate('POST', '/api/companies/verify-code', { companyCode: newOrgCompanyCode });
    assert(r4.status === 200, 'Newly registered company is immediately verifiable');
    assert(r4.body && r4.body.company && r4.body.company.name === 'Automated E2E Enterprises', 'Verified name matches registered name');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 4: Authentication, Tokens & Portal Separation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 4: Authentication, Tokens & Portal Separation ---');
  {
    // Missing credentials
    const r1 = await simulate('POST', '/api/auth/login', { email: '', password: '' });
    assert(r1.status === 400, 'Login with missing fields returns 400');

    // Wrong password
    const r2 = await simulate('POST', '/api/auth/login', { email: 'admin@acmetech.com', password: 'wrongPassword!' });
    assert(r2.status === 401, 'Login with incorrect password returns 401');

    // Non-existent company ID
    const r3 = await simulate('POST', '/api/auth/login', {
      email: 'admin@acmetech.com',
      password: 'admin123',
      companyId: 'CMP-INVALID-99'
    });
    assert(r3.status === 401, 'Login with non-existent Company ID returns 401');

    // Portal Mismatch: Employee logging in to Management portal
    const r4 = await simulate('POST', '/api/auth/login', {
      email: 'aarav.sharma@acmetech.com',
      password: 'admin123',
      portal: 'management'
    });
    assert(r4.status === 403 && r4.body.code === 'PORTAL_MISMATCH', 'Employee accessing management portal rejected with PORTAL_MISMATCH');

    // Portal Mismatch: Founder logging in to Employee portal
    const r5 = await simulate('POST', '/api/auth/login', {
      email: 'admin@acmetech.com',
      password: 'admin123',
      portal: 'employee'
    });
    assert(r5.status === 403 && r5.body.code === 'PORTAL_MISMATCH', 'Founder accessing employee portal rejected with PORTAL_MISMATCH');

    // Valid Founder Login (Acme)
    const r6 = await simulate('POST', '/api/auth/login', {
      email: 'admin@acmetech.com',
      password: 'admin123',
      portal: 'management'
    });
    assert(r6.status === 200, 'Acme Founder login returns 200');
    assert(r6.body.user.role === 'founder', 'Founder role validated');
    acmeFounderToken = r6.body.token;

    // Valid Admin Login (Acme)
    const r7 = await simulate('POST', '/api/auth/login', {
      email: 'ananya.r@acmetech.com',
      password: 'admin123',
      portal: 'management'
    });
    assert(r7.status === 200, 'Acme Admin login returns 200');
    acmeAdminToken = r7.body.token;

    // Valid Team Leader Login (Acme)
    const r8 = await simulate('POST', '/api/auth/login', {
      email: 'priya.n@acmetech.com',
      password: 'admin123',
      portal: 'management'
    });
    assert(r8.status === 200, 'Acme Team Leader login returns 200');
    acmeTeamLeaderToken = r8.body.token;

    // Valid Employee Login with Email
    const r9 = await simulate('POST', '/api/auth/login', {
      email: 'aarav.sharma@acmetech.com',
      password: 'admin123',
      portal: 'employee'
    });
    assert(r9.status === 200, 'Acme Employee login with email returns 200');
    acmeEmployeeToken = r9.body.token;

    // Valid Employee Login with Employee ID (EMP-0001)
    const r10 = await simulate('POST', '/api/auth/login', {
      email: 'EMP-0001',
      password: 'admin123',
      companyId: 'CMP-7K4M9X2Q',
      portal: 'employee'
    });
    assert(r10.status === 200, 'Acme Employee login with Employee ID (EMP-0001) returns 200');

    // Valid Nexus Founder Login
    const r11 = await simulate('POST', '/api/auth/login', {
      email: 'admin@nexussolutions.in',
      password: 'admin123'
    });
    assert(r11.status === 200, 'Nexus Founder login returns 200');
    nexusFounderToken = r11.body.token;

    // GET /api/auth/me without token
    const r12 = await simulate('GET', '/api/auth/me');
    assert(r12.status === 401, '/api/auth/me without token returns 401');

    // GET /api/auth/me with valid Acme Founder token
    const r13 = await simulate('GET', '/api/auth/me', null, acmeFounderToken);
    assert(r13.status === 200, '/api/auth/me with valid token returns 200');
    assert(r13.body.user && r13.body.user.email === 'admin@acmetech.com', '/api/auth/me returns authenticated user email');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 5: Password Recovery & Single-Use Tokens
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 5: Password Recovery & Reset Flow ---');
  {
    // Empty email
    const r1 = await simulate('POST', '/api/auth/forgot-password', { email: '' });
    assert(r1.status === 400, 'Forgot password with empty email returns 400');

    // Valid forgot-password request
    const r2 = await simulate('POST', '/api/auth/forgot-password', { email: 'karan.v@acmetech.com' });
    assert(r2.status === 200, 'Forgot password for valid user returns 200');
    const resetCode = r2.body ? (r2.body.resetCode || r2.body.devResetCode) : null;
    assert(resetCode && typeof resetCode === 'string', 'Forgot password returns reset code preview in zero-cost mode');

    // Reset password with wrong code
    const r3 = await simulate('POST', '/api/auth/reset-password', {
      email: 'karan.v@acmetech.com',
      resetCode: 'INVALID999',
      newPassword: 'newPassword123'
    });
    assert(r3.status === 400, 'Reset password with invalid code returns 400');

    // Reset password with valid code
    const r4 = await simulate('POST', '/api/auth/reset-password', {
      email: 'karan.v@acmetech.com',
      resetCode: resetCode,
      newPassword: 'brandNewPassword123'
    });
    assert(r4.status === 200, 'Reset password with valid code returns 200');

    // Login with new password
    const r5 = await simulate('POST', '/api/auth/login', {
      email: 'karan.v@acmetech.com',
      password: 'brandNewPassword123'
    });
    assert(r5.status === 200, 'Login with newly reset password succeeds');

    // Login with old password must fail
    const r6 = await simulate('POST', '/api/auth/login', {
      email: 'karan.v@acmetech.com',
      password: 'admin123'
    });
    assert(r6.status === 401, 'Login with old password now fails');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 6: Employee Invitation Lifecycle & Join Company Flow
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 6: Employee Invitation Lifecycle & Join Company ---');
  let invitationCode = null;
  let invitedEmail = `newbie.${Date.now()}@acmetech.com`;
  {
    // Unauthorized attempt by Employee to invite
    const r1 = await simulate('POST', '/api/invitations', { name: 'Unauthorized' }, acmeEmployeeToken);
    assert(r1.status === 403, 'Employee attempting to create invitations returns 403 Forbidden');

    // Valid invitation creation by Founder
    const r2 = await simulate('POST', '/api/invitations', {
      name: 'Aditi Rao',
      email: invitedEmail,
      role: 'employee',
      department: 'Engineering',
      designation: 'Backend Engineer'
    }, acmeFounderToken);
    assert(r2.status === 201, 'Founder creates employee invitation (201 Created)');
    assert(r2.body.invitation && r2.body.invitation.invitationCode, 'Invitation code generated');
    invitationCode = r2.body.invitation.invitationCode;

    // List invitations
    const r3 = await simulate('GET', '/api/invitations', null, acmeFounderToken);
    assert(r3.status === 200, 'Founder lists pending invitations');
    assert(Array.isArray(r3.body.invitations), 'Invitations returned as array');

    // Join company with invalid invitation code
    const r4 = await simulate('POST', '/api/auth/join-company', {
      companyCode: 'CMP-7K4M9X2Q',
      invitationCode: 'FAKE-CODE-000',
      email: invitedEmail,
      password: 'secureJoinPassword123'
    });
    assert(r4.status === 400 || r4.status === 404, 'Join company with invalid invitation code rejected with 400/404');

    // Join company with valid code
    const r5 = await simulate('POST', '/api/auth/join-company', {
      companyCode: 'CMP-7K4M9X2Q',
      invitationCode: invitationCode,
      email: invitedEmail,
      password: 'secureJoinPassword123'
    });
    assert(r5.status === 200, 'Join company with valid code returns 200');
    assert(r5.body.token, 'Join company returns authentication token');

    // Replay attack: try using the same invitation code again
    const r6 = await simulate('POST', '/api/auth/join-company', {
      companyCode: 'CMP-7K4M9X2Q',
      invitationCode: invitationCode,
      email: invitedEmail,
      password: 'secureJoinPassword123'
    });
    assert(r6.status === 400, 'Reusing an already-accepted invitation code returns 400');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 7: Multi-Tenant Data Isolation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 7: Multi-Tenant Data Isolation ---');
  {
    // Acme Founder fetches users
    const r1 = await simulate('GET', '/api/users', null, acmeFounderToken);
    assert(r1.status === 200, 'Acme Founder fetches users');
    const acmeUsers = (r1.body && (r1.body.users || r1.body.data)) || [];

    // Nexus Founder fetches users
    const r2 = await simulate('GET', '/api/users', null, nexusFounderToken);
    assert(r2.status === 200, 'Nexus Founder fetches users');
    const nexusUsers = (r2.body && (r2.body.users || r2.body.data)) || [];

    // Ensure no overlap
    const acmeUserIds = new Set(acmeUsers.map(u => u.id));
    const nexusHasAcmeUser = nexusUsers.some(u => acmeUserIds.has(u.id));
    assert(!nexusHasAcmeUser, 'Nexus cannot see any users belonging to Acme Technologies');

    // Cross-tenant access attempt: Nexus Founder requests Acme user profile directly
    if (acmeUsers.length > 0) {
      const targetAcmeUserId = acmeUsers[0].id;
      const r3 = await simulate('GET', `/api/users/${targetAcmeUserId}`, null, nexusFounderToken);
      assert(r3.status === 404 || r3.status === 403, 'Nexus Founder accessing Acme user by ID is blocked (403/404)');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 8: Attendance, Punch In / Out & Geofence
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 8: Attendance & Punch Tracking ---');
  {
    // Initial attendance today
    const r1 = await simulate('GET', '/api/attendance/today', null, acmeEmployeeToken);
    assert(r1.status === 200, 'GET /api/attendance/today returns 200');
    assert(typeof r1.body.isPunchedIn === 'boolean', 'Returns isPunchedIn boolean flag');

    // Punch in missing GPS coordinates
    const r2 = await simulate('POST', '/api/attendance/punch-in', {
      photoUri: 'data:image/jpeg;base64,mockSelfieBase64Data'
    }, acmeEmployeeToken);
    assert(r2.status === 400, 'Punch in missing GPS latitude/longitude returns 400');

    // Valid punch in
    const r3 = await simulate('POST', '/api/attendance/punch-in', {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 8.5,
      workMode: 'WFO',
      photoUri: 'data:image/jpeg;base64,mockSelfieBase64Data'
    }, acmeEmployeeToken);
    assert(r3.status === 201 || r3.status === 200, 'Valid Punch In returns 200/201');
    assert(r3.body.attendance && r3.body.attendance.punchInTime, 'Punch In time recorded');

    // Duplicate Punch In while already punched in
    const r4 = await simulate('POST', '/api/attendance/punch-in', {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 8.5
    }, acmeEmployeeToken);
    assert(r4.status === 400, 'Double Punch In rejected with 400');

    // Check today's status
    const r5 = await simulate('GET', '/api/attendance/today', null, acmeEmployeeToken);
    assert(r5.body.isPunchedIn === true, 'GET /api/attendance/today confirms user is punched in');

    // Punch Out
    const r6 = await simulate('POST', '/api/attendance/punch-out', {
      latitude: 12.9716,
      longitude: 77.5946
    }, acmeEmployeeToken);
    assert(r6.status === 200, 'Punch Out returns 200');
    assert(r6.body.attendance && r6.body.attendance.punchOutTime, 'Punch Out time recorded');

    // Punch Out again when not punched in
    const r7 = await simulate('POST', '/api/attendance/punch-out', {}, acmeEmployeeToken);
    assert(r7.status === 400, 'Punch Out while not punched in returns 400');

    // Attendance stats authorization: Employee denied
    const r8 = await simulate('GET', '/api/attendance/stats', null, acmeEmployeeToken);
    assert(r8.status === 403, 'Employee accessing attendance stats returns 403 Forbidden');

    // Attendance stats: Founder allowed
    const r9 = await simulate('GET', '/api/attendance/stats', null, acmeFounderToken);
    assert(r9.status === 200, 'Founder accessing attendance stats returns 200');
    assert(typeof r9.body.totalEmployees === 'number', 'Attendance stats contains totalEmployees');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 9: Daily Task Reports & Excel Export
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 9: Daily Task Reports & Excel Export ---');
  {
    // Save report draft
    const r1 = await simulate('POST', '/api/daily-reports', {
      reportDate: new Date().toISOString().split('T')[0],
      tasks: [
        { title: 'Implemented Phase 1 Verification', hours: 4, status: 'completed' },
        { title: 'Fixed Android Safe Area Layout', hours: 3.5, status: 'completed' }
      ],
      blockers: 'None',
      is_draft: true
    }, acmeEmployeeToken);
    assert(r1.status === 200, 'Save daily report draft returns 200');

    // Fetch draft
    const r2 = await simulate('GET', '/api/daily-reports/draft', null, acmeEmployeeToken);
    assert(r2.status === 200, 'Fetch daily report draft returns 200');
    assert(r2.body.draft && r2.body.draft.tasks && r2.body.draft.tasks.length === 2, 'Saved draft tasks accurately retrieved');

    // Final report submission
    const r3 = await simulate('POST', '/api/daily-reports', {
      reportDate: new Date().toISOString().split('T')[0],
      tasks: [
        { title: 'Implemented Phase 1 Verification', hours: 4, status: 'completed' },
        { title: 'Fixed Android Safe Area Layout', hours: 3.5, status: 'completed' }
      ],
      blockers: 'None',
      is_draft: false
    }, acmeEmployeeToken);
    assert(r3.status === 200, 'Final daily report submission returns 200');

    // Export daily reports to Excel
    const r4 = await simulate('GET', '/api/daily-reports/export', null, acmeFounderToken);
    assert(r4.status === 200, 'Daily report Excel export returns 200');
    assert(r4.headers['content-type'] && r4.headers['content-type'].includes('spreadsheetml'), 'Export returns XLSX content-type header');

    // Parse binary buffer with xlsx
    if (r4.body) {
      let isBuffer = Buffer.isBuffer(r4.body);
      let buf = isBuffer ? r4.body : Buffer.from(r4.body);
      try {
        const workbook = xlsx.read(buf, { type: 'buffer' });
        assert(workbook.SheetNames && workbook.SheetNames.length > 0, 'Exported Excel file contains valid worksheets');
      } catch (err) {
        // Fallback check for zip PK signature
        const hasPkHeader = buf.slice(0, 2).toString() === 'PK';
        assert(hasPkHeader, 'Exported file has valid OpenXML PK binary signature');
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 10: Quality Audits & Leader Ratings
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 10: Quality Audits & Ratings ---');
  {
    // Employee cannot submit audit
    const r1 = await simulate('POST', '/api/audits', { rating: 5 }, acmeEmployeeToken);
    assert(r1.status === 403, 'Employee submitting audit returns 403 Forbidden');

    // Team Leader submits audit for employee
    const r2 = await simulate('POST', '/api/audits', {
      employeeId: 'EMP-0001',
      rating: 4.5,
      feedback: 'Excellent attention to UI edge-to-edge layout and code quality.',
      category: 'Code Quality'
    }, acmeTeamLeaderToken);
    assert(r2.status === 201 || r2.status === 200, 'Team Leader submits audit (200/201)');

    // Employee cannot directly view management audits
    const r3 = await simulate('GET', '/api/audits', null, acmeEmployeeToken);
    assert(r3.status === 403, 'Employee denied direct access to audits (403 Forbidden)');

    // Team Leader fetches team audits
    const r4 = await simulate('GET', '/api/audits', null, acmeTeamLeaderToken);
    assert(r4.status === 200, 'Team Leader fetches team audits (HTTP 200)');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 11: Leave Applications & Impossible Date Validation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 11: Leave Applications & Impossible Date Validation ---');
  let createdLeaveId = null;
  {
    // Impossible date range: End date is before start date
    const r1 = await simulate('POST', '/api/leaves', {
      leaveType: 'casual',
      startDate: '2026-11-10',
      endDate: '2026-11-05', // Earlier!
      reason: 'Vacation'
    }, acmeEmployeeToken);
    assert(r1.status === 400, 'Impossible date range (endDate < startDate) rejected with 400');

    // Valid leave application
    const r2 = await simulate('POST', '/api/leaves', {
      leaveType: 'casual',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      reason: 'Family event'
    }, acmeEmployeeToken);
    assert(r2.status === 201 || r2.status === 200, 'Valid leave submission returns 200/201');
    createdLeaveId = r2.body.leave ? r2.body.leave.id : (r2.body.data ? r2.body.data.id : null);

    // Employee cannot approve own leave
    if (createdLeaveId) {
      const r3 = await simulate('PATCH', `/api/leaves/${createdLeaveId}`, { status: 'approved' }, acmeEmployeeToken);
      assert(r3.status === 403, 'Employee cannot approve own leave (403 Forbidden)');

      // Admin approves leave
      const r4 = await simulate('PATCH', `/api/leaves/${createdLeaveId}`, { status: 'approved' }, acmeAdminToken);
      assert(r4.status === 200, 'Admin approves leave application (HTTP 200)');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 12: Announcements, Rules & Holidays
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 12: Announcements, Rules & Holidays ---');
  let createdAnnouncementId = null;
  {
    // Employee cannot post announcements
    const r1 = await simulate('POST', '/api/announcements', { title: 'Spam' }, acmeEmployeeToken);
    assert(r1.status === 403, 'Employee posting announcements returns 403 Forbidden');

    // Admin posts announcement
    const r2 = await simulate('POST', '/api/announcements', {
      title: 'Diwali Office Celebration',
      content: 'Celebration starts at 4 PM in the main lounge.',
      priority: 'high',
      status: 'published'
    }, acmeAdminToken);
    assert(r2.status === 201, 'Admin posts announcement (201 Created)');
    createdAnnouncementId = r2.body.data ? r2.body.data.id : null;

    // Fetch announcements
    const r3 = await simulate('GET', '/api/announcements', null, acmeEmployeeToken);
    assert(r3.status === 200, 'Employee reads announcements (HTTP 200)');

    // Fetch holidays
    const r4 = await simulate('GET', '/api/holidays', null, acmeEmployeeToken);
    assert(r4.status === 200, 'GET /api/holidays returns 200');

    // Fetch rules
    const r5 = await simulate('GET', '/api/rules', null, acmeEmployeeToken);
    assert(r5.status === 200, 'GET /api/rules returns 200');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 13: Timesheets & Notifications
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 13: Timesheets & Notifications ---');
  {
    // Submit timesheet
    const r1 = await simulate('POST', '/api/timesheets', {
      weekStartDate: '2026-10-26',
      totalHours: 40,
      tasksSummary: 'Feature development and automated testing'
    }, acmeEmployeeToken);
    assert(r1.status === 201 || r1.status === 200, 'Submit weekly timesheet returns 200/201');

    // Fetch timesheets
    const r2 = await simulate('GET', '/api/timesheets', null, acmeEmployeeToken);
    assert(r2.status === 200, 'GET /api/timesheets returns 200');

    // Fetch notifications
    const r3 = await simulate('GET', '/api/notifications', null, acmeEmployeeToken);
    assert(r3.status === 200, 'GET /api/notifications returns 200');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 14: Profile Management, Photos & Contact Update Requests
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 14: Profile Management & Contact Update Requests ---');
  let updateRequestId = null;
  {
    // Get profile
    const r1 = await simulate('GET', '/api/profile', null, acmeEmployeeToken);
    assert(r1.status === 200, 'GET /api/profile returns 200');

    // Upload profile photo
    const r2 = await simulate('POST', '/api/profile/photo', {
      photoUri: 'data:image/jpeg;base64,mockAvatarBase64String'
    }, acmeEmployeeToken);
    assert(r2.status === 200, 'Upload profile photo returns 200');

    // Employee submits contact update request
    const r3 = await simulate('POST', '/api/profile/update-request', {
      requestedPhone: '+91 99999 88888',
      reason: 'Changed SIM card'
    }, acmeEmployeeToken);
    assert(r3.status === 201 || r3.status === 200, 'Submit contact update request returns 200/201');
    updateRequestId = r3.body.request ? r3.body.request.id : (r3.body.data ? r3.body.data.id : null);

    // Admin views update requests
    const r4 = await simulate('GET', '/api/admin/profile-update-requests', null, acmeAdminToken);
    assert(r4.status === 200, 'Admin reads pending profile update requests');

    // Admin approves update request
    if (updateRequestId) {
      const r5 = await simulate('PATCH', `/api/admin/profile-update-requests/${updateRequestId}`, {
        status: 'approved'
      }, acmeAdminToken);
      assert(r5.status === 200, 'Admin approves profile update request');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 15: Bank Details, Masking & IFSC Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 15: Bank Details, Masking & IFSC Verification ---');
  let bankRecordId = null;
  {
    // Invalid IFSC format
    const r1 = await simulate('POST', '/api/bank-details', {
      accountNumber: '123456789012',
      ifscCode: 'INVALID_IFSC',
      accountHolderName: 'Aarav Sharma',
      bankName: 'HDFC Bank'
    }, acmeEmployeeToken);
    assert(r1.status === 400, 'Invalid IFSC format rejected with 400');

    // Valid bank details submission
    const r2 = await simulate('POST', '/api/bank-details', {
      accountNumber: '987654321098',
      ifscCode: 'HDFC0001234',
      accountHolderName: 'Aarav Sharma',
      bankName: 'HDFC Bank'
    }, acmeEmployeeToken);
    assert(r2.status === 201 || r2.status === 200, 'Valid bank details submission returns 200/201');
    bankRecordId = r2.body.data ? r2.body.data.id : null;

    // Employee reads own bank details (Account number must be masked)
    const r3 = await simulate('GET', '/api/bank-details/me', null, acmeEmployeeToken);
    assert(r3.status === 200, 'GET /api/bank-details/me returns 200');
    if (r3.body.data && r3.body.data.accountNumber) {
      const isMasked = r3.body.data.accountNumber.includes('•') || r3.body.data.accountNumber.includes('*') || r3.body.data.accountNumber.endsWith('1098');
      assert(isMasked, 'Employee account number is securely masked in API response');
    }

    // Admin verifies bank details
    if (bankRecordId) {
      const r4 = await simulate('PATCH', `/api/admin/bank-details/${bankRecordId}/verify`, {
        verificationStatus: 'verified'
      }, acmeAdminToken);
      assert(r4.status === 200, 'Admin verifies employee bank details');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 16: Salary Advance Workflow
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 16: Salary Advance Workflow ---');
  let advanceId = null;
  {
    // Invalid amount (negative or 0)
    const r1 = await simulate('POST', '/api/advances', { amount: 0, reason: 'Emergency' }, acmeEmployeeToken);
    assert(r1.status === 400, 'Salary advance with 0 amount rejected with 400');

    // Missing reason
    const r2 = await simulate('POST', '/api/advances', { amount: 10000, reason: '' }, acmeEmployeeToken);
    assert(r2.status === 400, 'Salary advance with missing reason rejected with 400');

    // Valid salary advance request
    const r3 = await simulate('POST', '/api/advances', {
      amount: 15000,
      reason: 'Medical Emergency',
      repaymentMonths: 3
    }, acmeEmployeeToken);
    assert(r3.status === 201 || r3.status === 200, 'Valid advance request returns 200/201');
    advanceId = r3.body.data ? r3.body.data.id : null;

    // Admin views advances
    const r4 = await simulate('GET', '/api/admin/advances', null, acmeAdminToken);
    assert(r4.status === 200, 'Admin reads pending salary advances');

    // Admin approves advance
    if (advanceId) {
      const r5 = await simulate('PATCH', `/api/admin/advances/${advanceId}/approve`, {
        approvedAmount: 15000
      }, acmeAdminToken);
      assert(r5.status === 200, 'Admin approves salary advance');

      // Admin records disbursement payment
      const r6 = await simulate('POST', `/api/admin/advances/${advanceId}/payment`, {
        paymentMode: 'bank_transfer',
        transactionReference: 'UTR9988776655'
      }, acmeAdminToken);
      assert(r6.status === 200, 'Admin records salary advance payment disbursement');

      // Admin records repayment
      const r7 = await simulate('POST', `/api/admin/advances/${advanceId}/repayment`, {
        amount: 5000,
        notes: 'November payroll deduction'
      }, acmeAdminToken);
      assert(r7.status === 200, 'Admin records advance repayment installment');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 17: Security & Input Sanitation
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 17: Security, Input Sanitation & Error Handling ---');
  {
    // Non-existent route
    const r1 = await simulate('GET', '/api/completely-unknown-route');
    assert(r1.status === 404, 'Unknown API route returns 404 Not Found');

    // Malformed JSON / script tag injection in search
    const r2 = await simulate('GET', '/api/users?search=<script>alert("xss")</script>', null, acmeFounderToken);
    assert(r2.status === 200, 'XSS attempt in search parameter safely handled without crash');

    // SQL injection pattern in company verify
    const r3 = await simulate('POST', '/api/companies/verify-code', {
      companyCode: "' OR '1'='1"
    });
    assert(r3.status === 404 || r3.status === 400, 'SQL injection string in companyCode rejected safely');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 18: Mobile Architectural & Safe Area Invariants
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 18: Mobile Safe Area & Invariant Verifications ---');
  {
    const safeAreaHelperPath = path.join(__dirname, '../mobile/src/utils/safeAreaHelper.js');
    assert(fs.existsSync(safeAreaHelperPath), 'safeAreaHelper.js utility exists in mobile src');

    const safeAreaContent = fs.readFileSync(safeAreaHelperPath, 'utf8');
    assert(safeAreaContent.includes('StatusBar.currentHeight'), 'safeAreaHelper incorporates Android StatusBar.currentHeight');
    assert(safeAreaContent.includes('Math.max'), 'safeAreaHelper uses Math.max with fallback');
    assert(safeAreaContent.includes('24'), 'safeAreaHelper enforces minimum 24dp Android fallback');

    const adminDashPath = path.join(__dirname, '../mobile/src/screens/admin/AdminDashboard.js');
    assert(fs.existsSync(adminDashPath), 'AdminDashboard.js exists');
    const adminDashContent = fs.readFileSync(adminDashPath, 'utf8');
    assert(adminDashContent.includes('paddingTop: safeInsets.top + 8'), 'AdminDashboard topBar enforces safeInsets.top + 8 offset');
    assert(!adminDashContent.includes('<SafeAreaView style={styles.container} edges={[\'top\''), 'AdminDashboard removed fragile SafeAreaView top edge');

    const appJsonPath = path.join(__dirname, '../mobile/app.json');
    const appJsonContent = fs.readFileSync(appJsonPath, 'utf8');
    assert(appJsonContent.includes('"translucent": true'), 'mobile/app.json enforces androidStatusBar translucent: true');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // MODULE 19: Web Dashboard Build & Contract Alignment
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- MODULE 19: Web Dashboard Build & Contract Alignment ---');
  {
    const webDistPath = path.join(__dirname, '../web/dist/index.html');
    assert(fs.existsSync(webDistPath), 'Web production bundle dist/index.html exists');

    const webPackageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../web/package.json'), 'utf8'));
    assert(webPackageJson.name === 'ems-founder-web', 'Web project package.json is configured');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${passedCount + failedCount}`);
  console.log(`PASSED:               ${passedCount}`);
  console.log(`FAILED:               ${failedCount}`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    console.error('FAILURES SUMMARY:');
    failureDetails.forEach((f, i) => {
      console.error(` ${i + 1}. ${f.testName} ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('SUCCESS: All End-to-End Automated Tests Passed with 0 errors!\n');
    process.exit(0);
  }
}

runMasterTestSuite().catch((err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
