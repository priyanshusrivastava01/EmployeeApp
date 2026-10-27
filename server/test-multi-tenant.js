/**
 * Comprehensive Automated Multi-Tenant & RBAC Verification Test Suite
 * Tests all requirements from Prompt Section 25.
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   EMS MULTI-ORGANIZATION AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  try {
    // ── 1. AUTHENTICATION TESTS ─────────────────────────────────────────
    console.log('1. AUTHENTICATION & LOGIN');

    // 1.1 Invalid credentials
    const invalidRes = await request('POST', '/api/auth/login', {
      email: 'admin@acmetech.com',
      password: 'wrong-password'
    });
    assert(invalidRes.status === 401, 'Invalid credentials returns HTTP 401');

    // 1.2 Admin login (Acme Tech)
    const acmeAdminRes = await request('POST', '/api/auth/login', {
      email: 'admin@acmetech.com',
      password: 'admin123'
    });
    assert(acmeAdminRes.status === 200 && acmeAdminRes.body.token, 'Acme Admin logs in successfully and receives JWT');
    const acmeAdminToken = acmeAdminRes.body.token;
    const acmeOrgId = acmeAdminRes.body.organization.id;

    // 1.3 Admin login (Nexus Solutions - Org 2)
    const nexusAdminRes = await request('POST', '/api/auth/login', {
      email: 'admin@nexussolutions.in',
      password: 'admin123'
    });
    assert(nexusAdminRes.status === 200 && nexusAdminRes.body.token, 'Nexus Admin (Org 2) logs in successfully');
    const nexusAdminToken = nexusAdminRes.body.token;
    const nexusOrgId = nexusAdminRes.body.organization.id;

    assert(acmeOrgId !== nexusOrgId, 'Acme and Nexus have distinct organization IDs');

    // 1.4 Team Leader login
    const tlRes = await request('POST', '/api/auth/login', {
      email: 'priya.n@acmetech.com',
      password: 'admin123'
    });
    assert(tlRes.status === 200 && tlRes.body.user.role === 'team_leader', 'Team Leader logs in with verified role "team_leader"');
    const tlToken = tlRes.body.token;

    // 1.5 Employee login
    const empRes = await request('POST', '/api/auth/login', {
      email: 'aarav.sharma@acmetech.com',
      password: 'admin123'
    });
    assert(empRes.status === 200 && empRes.body.user.role === 'employee', 'Employee logs in with verified role "employee"');
    const empToken = empRes.body.token;

    // 1.6 Unauthenticated request rejection
    const unauthRes = await request('GET', '/api/auth/me');
    assert(unauthRes.status === 401, 'Protected route without token is rejected with 401');

    // ── 2. AUTHORIZATION & RBAC TESTS ──────────────────────────────────
    console.log('\n2. ROLE-BASED ACCESS CONTROL (RBAC)');

    // 2.1 Employee cannot create users (Admin only)
    const empCreateUser = await request('POST', '/api/users', {
      name: 'Hacker User',
      email: 'hack@test.com',
      password: 'password123',
      role: 'admin'
    }, empToken);
    assert(empCreateUser.status === 403, 'Employee is rejected from creating users (HTTP 403)');

    // 2.2 Team Leader cannot create users
    const tlCreateUser = await request('POST', '/api/users', {
      name: 'TL Created',
      email: 'tlcreate@test.com',
      password: 'password123'
    }, tlToken);
    assert(tlCreateUser.status === 403, 'Team Leader is rejected from creating users (HTTP 403)');

    // 2.3 Admin CAN create a new employee in their org
    const newEmpEmail = `test.staff.${Date.now()}@acmetech.com`;
    const adminCreateUser = await request('POST', '/api/users', {
      name: 'Automated Test Staff',
      email: newEmpEmail,
      password: 'Password123!',
      role: 'employee',
      department: 'QA Testing',
      designation: 'Test Automation Engineer'
    }, acmeAdminToken);
    assert(adminCreateUser.status === 201 && adminCreateUser.body.success, 'Admin successfully creates new employee');
    const createdUserId = adminCreateUser.body.data.id;

    // ── 3. MULTI-TENANCY & DATA ISOLATION TESTS ────────────────────────
    console.log('\n3. MULTI-TENANT DATA ISOLATION');

    // 3.1 Acme Admin lists users -> sees Acme users
    const acmeUsersRes = await request('GET', '/api/users', null, acmeAdminToken);
    const hasAcmeUser = acmeUsersRes.body.data.some(u => u.id === createdUserId);
    assert(hasAcmeUser, 'Acme Admin sees newly created Acme staff member');

    // 3.2 Nexus Admin lists users -> CANNOT see Acme staff member
    const nexusUsersRes = await request('GET', '/api/users', null, nexusAdminToken);
    const nexusSeesAcme = nexusUsersRes.body.data.some(u => u.id === createdUserId);
    assert(!nexusSeesAcme, 'Nexus Admin CANNOT see Acme staff members (Data Isolation Verified)');

    // 3.3 Nexus Admin tries to access Acme user directly by ID -> 404/403
    const directAccessRes = await request('GET', `/api/users/${createdUserId}`, null, nexusAdminToken);
    assert(directAccessRes.status === 404, 'Direct object reference to another organization user rejected with 404');

    // Authenticate as the newly created employee for idempotent attendance and report tests
    const freshLoginRes = await request('POST', '/api/auth/login', {
      email: newEmpEmail,
      password: 'Password123!',
      portal: 'employee'
    });
    const freshEmpToken = freshLoginRes.body.token || empToken;

    // ── 4. ATTENDANCE WORKFLOW TESTS ───────────────────────────────────
    console.log('\n4. ATTENDANCE & GEOFENCE WORKFLOW');

    // 4.1 Valid Punch In
    const punchInRes = await request('POST', '/api/attendance/punch-in', {
      mode: 'WFO',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: 'file://selfie-punch-in-test.jpg'
    }, freshEmpToken);
    assert(punchInRes.status === 201 && punchInRes.body.success, 'Employee submits valid Punch In');

    // 4.2 Duplicate Punch In rejected
    const dupPunchInRes = await request('POST', '/api/attendance/punch-in', {
      mode: 'WFO',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: 'file://dup.jpg'
    }, freshEmpToken);
    assert(dupPunchInRes.status === 409, 'Duplicate Punch In on the same day is rejected with HTTP 409');

    // 4.3 Valid Punch Out
    const punchOutRes = await request('POST', '/api/attendance/punch-out', {
      latitude: 12.9718,
      longitude: 77.5948,
      accuracy: 12,
      photoPath: 'file://selfie-punch-out-test.jpg'
    }, freshEmpToken);
    assert(punchOutRes.status === 200 && punchOutRes.body.data.punch_out_time, 'Employee submits valid Punch Out; session linked');

    // 4.4 Punch Out when no active session
    const noSessionPunchOut = await request('POST', '/api/attendance/punch-out', {
      latitude: 12.9718,
      longitude: 77.5948
    }, freshEmpToken);
    assert(noSessionPunchOut.status === 400, 'Punch Out with no active session is rejected with HTTP 400');

    // ── 5. DAILY TASK REPORT TESTS ─────────────────────────────────────
    console.log('\n5. DAILY TASK REPORT & RATINGS');

    // 5.1 Submit daily task summary
    const taskReportRes = await request('POST', '/api/daily-reports', {
      projectName: 'Multi-Tenant EMS Architecture',
      tasksAssigned: 'Refactor backend auth and add mobile admin router',
      tasksCompleted: 'Yes',
      tasksPending: 'No',
      ratingSpeed: 9,
      ratingUnderstanding: 10,
      ratingProblemSolving: 9,
      ratingTalkingBehaviour: 9,
      ratingWorkQuality: 10,
      ratingDiscipline: 9,
      workSummary: 'Completed multi-tenant migration and verification test suite.'
    }, freshEmpToken);
    assert(taskReportRes.status === 201 && taskReportRes.body.data.rating_average_overall, 'Daily task report submitted with calculated rating average');

    // 5.2 Duplicate task report rejected
    const dupReportRes = await request('POST', '/api/daily-reports', {
      projectName: 'Duplicate',
      ratingSpeed: 8
    }, freshEmpToken);
    assert(dupReportRes.status === 409, 'Duplicate daily report on the same day is rejected with HTTP 409');

    // ── 6. LEAVE MANAGEMENT TESTS ──────────────────────────────────────
    console.log('\n6. LEAVE MANAGEMENT & APPROVAL');

    // 6.1 Employee submits leave
    const leaveRes = await request('POST', '/api/leaves', {
      leaveType: 'Vacation',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      durationDays: 3,
      reason: 'Attending family celebration'
    }, empToken);
    assert(leaveRes.status === 201 && leaveRes.body.data.status === 'pending', 'Employee submits leave request with status "pending"');
    const leaveId = leaveRes.body.data.id;

    // 6.2 Admin approves leave
    const approveRes = await request('PATCH', `/api/leaves/${leaveId}`, {
      status: 'approved',
      decisionComment: 'Approved. Enjoy your vacation!'
    }, acmeAdminToken);
    assert(approveRes.status === 200 && approveRes.body.data.status === 'approved', 'Admin approves leave request with decision comment');

    // ── 7. ANNOUNCEMENTS & RULES ───────────────────────────────────────
    console.log('\n7. ANNOUNCEMENTS & RULES CRUD');

    // 7.1 Admin creates announcement
    const annRes = await request('POST', '/api/announcements', {
      title: 'Annual Performance Reviews Scheduled',
      message: 'Reviews will take place next month. Please ensure task summaries are updated.',
      priority: 'high',
      audience: 'all'
    }, acmeAdminToken);
    assert(annRes.status === 201 && annRes.body.data.title, 'Admin publishes company announcement');
    const annId = annRes.body.data.id;

    // 7.2 Nexus Admin cannot see Acme announcement
    const nexusAnnRes = await request('GET', '/api/announcements', null, nexusAdminToken);
    const nexusSeesAnn = nexusAnnRes.body.data.some(a => a.id === annId);
    assert(!nexusSeesAnn, 'Nexus Admin cannot see Acme announcements (Org isolation)');

    // ── 8. ORGANIZATION SETTINGS ───────────────────────────────────────
    console.log('\n8. ORGANIZATION SETTINGS ISOLATION');

    // 8.1 Admin updates settings
    const patchSettingsRes = await request('PATCH', '/api/org/settings', {
      late_threshold_minutes: 25,
      office_radius_meters: 220
    }, acmeAdminToken);
    assert(patchSettingsRes.status === 200 && patchSettingsRes.body.data.late_threshold_minutes === 25, 'Admin updates organization shift policy');

    // 8.2 Verify Nexus settings untouched
    const nexusSettingsRes = await request('GET', '/api/org/settings', null, nexusAdminToken);
    assert(nexusSettingsRes.body.data.late_threshold_minutes !== 25, 'Nexus organization settings unaffected by Acme changes');

    console.log('\n====================================================');
    console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
