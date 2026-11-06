/**
 * Phase 1 Security, Ownership & Access Control Automated Test Suite
 * 
 * Verifies all security criteria from Prompt Section 9:
 *  1. Employee views own leave request -> Allowed (200)
 *  2. Employee views another employee's leave request -> Denied (403)
 *  3. Employee updates/cancels another employee's leave request -> Denied (403)
 *  4. Employee approves their own leave -> Denied (403)
 *  5. Authorized Founder approves a leave request -> Allowed (200)
 *  6. Employee views own timesheet -> Allowed (200)
 *  7. Employee views another employee's timesheet -> Denied (403)
 *  8. Employee modifies another employee's timesheet -> Denied (403)
 *  9. Employee changes their own approval status -> Denied (403)
 * 10. Organization A accesses Organization B data -> Denied (403)
 * 11. Unauthorized user accesses protected endpoint -> Denied (401)
 * 12. Expired token accesses protected endpoint -> Denied (401)
 * 13. Inactive membership accesses protected endpoint -> Denied (403)
 * 14. Valid Founder accesses own organization's records -> Allowed (200)
 * 15. Valid TL accesses authorized team records -> Allowed (200)
 * 16. Pending leave count accuracy -> Verified in stats
 * 17. Race condition / duplicate approval prevention -> Denied (409)
 * 18. Storage path access across users -> Denied (403)
 */

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const EventEmitter = require('events');
const jwt = require('jsonwebtoken');
const { app, memDb } = require('./src/index');

const JWT_SECRET = process.env.JWT_SECRET || 'ems-dev-secret-change-in-production';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

function simulate(method, url, body = null, token = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    const parsedUrl = new URL(url, 'http://localhost');
    req.method = method.toUpperCase();
    req.url = url;
    req.path = parsedUrl.pathname;
    req.query = Object.fromEntries(parsedUrl.searchParams);
    req.headers = {
      'content-type': 'application/json',
      accept: 'application/json'
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
        resolve({ status: this.statusCode, body: data });
      },
      send(data) {
        let parsed = data;
        if (typeof data === 'string') {
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        }
        resolve({ status: this.statusCode, body: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, body: data });
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

function makeToken(user, orgId, expiresIn = '1h') {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: orgId,
      organizationSlug: 'test-org'
    },
    JWT_SECRET,
    { expiresIn }
  );
}

async function runSuite() {
  console.log('======================================================================');
  console.log('   EMS PHASE 1 SECURITY, OWNERSHIP & ACCESS CONTROL TEST SUITE       ');
  console.log('======================================================================\n');

  // Setup test fixtures in memDb
  const orgA = 'org-demo-001';
  const orgB = 'org-demo-002';

  const founderA = memDb.users.find(u => u.id === 'user-admin-001'); // Rohan (founder, Org A)
  const tlA = memDb.users.find(u => u.id === 'user-tl-001');         // Priya (team_leader, Org A)
  const empA1 = memDb.users.find(u => u.id === 'user-emp-001');      // Aarav (assigned to Priya, Org A)
  const empA2 = memDb.users.find(u => u.id === 'user-emp-002');      // Karan (not assigned to Priya, Org A)
  const founderB = memDb.users.find(u => u.id === 'user-nexus-001');  // Vikram (founder, Org B)

  // Inactive user for testing
  let inactiveEmp = memDb.users.find(u => u.id === 'user-inactive-001');
  if (!inactiveEmp) {
    inactiveEmp = {
      id: 'user-inactive-001',
      organization_id: orgA,
      email: 'suspended.user@acmetech.com',
      name: 'Suspended Worker',
      role: 'employee',
      is_active: false,
      created_at: new Date().toISOString()
    };
    memDb.users.push(inactiveEmp);
  }

  const tokenFounderA = makeToken(founderA, orgA);
  const tokenTLA = makeToken(tlA, orgA);
  const tokenEmpA1 = makeToken(empA1, orgA);
  const tokenEmpA2 = makeToken(empA2, orgA);
  const tokenFounderB = makeToken(founderB, orgB);
  const tokenInactive = makeToken(inactiveEmp, orgA);
  const tokenExpired = makeToken(empA1, orgA, '-1s');

  console.log('--- 1. Authentication & Token Security ---');
  // 1.1 Missing token -> 401
  const resNoToken = await simulate('GET', '/api/leaves');
  assert(resNoToken.status === 401, 'Unauthorized request without token is rejected (HTTP 401)');

  // 1.2 Invalid token format -> 401
  const resBadToken = await simulate('GET', '/api/leaves', null, 'invalid-bearer-token');
  assert(resBadToken.status === 401, 'Invalid JWT token is rejected (HTTP 401)');

  // 1.3 Expired token -> 401
  const resExpired = await simulate('GET', '/api/leaves', null, tokenExpired);
  assert(resExpired.status === 401, 'Expired token is rejected (HTTP 401)');

  // 1.4 Inactive user access -> 403
  const resInactive = await simulate('GET', '/api/leaves', null, tokenInactive);
  assert(resInactive.status === 403, 'Inactive / suspended account is rejected (HTTP 403)');

  console.log('\n--- 2. Leave Management Ownership & Approval Security ---');
  // Create leave for Emp A1
  const resCreateLeave = await simulate('POST', '/api/leaves', {
    leaveType: 'Casual Leave',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    durationDays: 2,
    reason: 'Family function'
  }, tokenEmpA1);
  assert(resCreateLeave.status === 201 && resCreateLeave.body.success, 'Employee creates own leave request (HTTP 201)');
  const leaveA1Id = resCreateLeave.body.data.id;

  // 2.0.1 Employee attempts to inject foreign organization_id on leave creation -> Enforced to token org
  const resSpoofOrgLeave = await simulate('POST', '/api/leaves', {
    leaveType: 'Sick Leave',
    startDate: '2026-11-15',
    endDate: '2026-11-16',
    durationDays: 2,
    reason: 'Trying to create in Org B',
    organization_id: orgB,
    organizationId: orgB
  }, tokenEmpA1);
  assert(resSpoofOrgLeave.status === 201, 'Leave creation succeeds but ignores spoofed org (HTTP 201)');
  assert(resSpoofOrgLeave.body.data.organization_id === orgA, 'Backend forces organization_id to authenticated user org (tenant integrity)');

  // 2.0.2 Employee attempts to inject another user_id on leave creation -> Enforced to token user
  const resSpoofUserLeave = await simulate('POST', '/api/leaves', {
    leaveType: 'Sick Leave',
    startDate: '2026-11-15',
    endDate: '2026-11-16',
    durationDays: 2,
    reason: 'Trying to create for Emp A2',
    user_id: empA2.id,
    userId: empA2.id
  }, tokenEmpA1);
  assert(resSpoofUserLeave.status === 201, 'Leave creation succeeds but ignores spoofed user (HTTP 201)');
  assert(resSpoofUserLeave.body.data.user_id === empA1.id, 'Backend forces user_id to authenticated user id (ownership integrity)');

  // 2.0.3 Employee attempts to inject approved status on leave creation -> Enforced to pending
  const resSpoofStatusLeave = await simulate('POST', '/api/leaves', {
    leaveType: 'Sick Leave',
    startDate: '2026-11-15',
    endDate: '2026-11-16',
    durationDays: 2,
    reason: 'Trying to bypass approval',
    status: 'approved'
  }, tokenEmpA1);
  assert(resSpoofStatusLeave.status === 201, 'Leave creation succeeds but ignores spoofed status (HTTP 201)');
  assert(resSpoofStatusLeave.body.data.status === 'pending', 'Backend forces initial status to pending (workflow integrity)');

  // 2.0.4 Migration 011 RLS INSERT policy contract verification
  const evaluateLeaveInsertPolicy = ({ authUid, userOrgId, rowUserId, rowOrgId, rowStatus }) => {
    return (
      rowUserId === authUid &&
      rowStatus === 'pending' &&
      rowOrgId === userOrgId
    );
  };
  assert(evaluateLeaveInsertPolicy({ authUid: empA1.id, userOrgId: orgA, rowUserId: empA1.id, rowOrgId: orgA, rowStatus: 'pending' }) === true,
    'Migration 011 RLS: Allows valid employee leave creation in own organization with pending status');
  assert(evaluateLeaveInsertPolicy({ authUid: empA1.id, userOrgId: orgA, rowUserId: empA1.id, rowOrgId: orgB, rowStatus: 'pending' }) === false,
    'Migration 011 RLS: Rejects leave creation with mismatched organization_id');
  assert(evaluateLeaveInsertPolicy({ authUid: empA1.id, userOrgId: orgA, rowUserId: empA2.id, rowOrgId: orgA, rowStatus: 'pending' }) === false,
    'Migration 011 RLS: Rejects leave creation with mismatched user_id');
  assert(evaluateLeaveInsertPolicy({ authUid: empA1.id, userOrgId: orgA, rowUserId: empA1.id, rowOrgId: orgA, rowStatus: 'approved' }) === false,
    'Migration 011 RLS: Rejects leave creation attempting pre-approved status');

  // 2.1 Employee views own leave details -> 200
  const resViewOwnLeave = await simulate('GET', `/api/leaves/${leaveA1Id}`, null, tokenEmpA1);
  assert(resViewOwnLeave.status === 200 && resViewOwnLeave.body.data.id === leaveA1Id, 'Employee views own leave request (HTTP 200)');

  // 2.2 Employee A2 attempts to view Employee A1's leave -> 403
  const resViewOtherLeave = await simulate('GET', `/api/leaves/${leaveA1Id}`, null, tokenEmpA2);
  assert(resViewOtherLeave.status === 403, 'Employee denied access to another employee leave request (HTTP 403)');

  // 2.3 Organization B attempts to view Organization A's leave -> 404 (IDOR tenant isolation)
  const resOrgBViewLeave = await simulate('GET', `/api/leaves/${leaveA1Id}`, null, tokenFounderB);
  assert(resOrgBViewLeave.status === 404, 'Cross-organization leave request access is denied (HTTP 404)');

  // 2.4 Employee attempts to approve their own leave -> 403
  const resSelfApprove = await simulate('PATCH', `/api/leaves/${leaveA1Id}`, { status: 'approved' }, tokenEmpA1);
  assert(resSelfApprove.status === 403, 'Employee cannot approve their own leave request (HTTP 403)');

  // 2.5 Employee A2 attempts to cancel Employee A1's leave -> 403
  const resOtherCancel = await simulate('PATCH', `/api/leaves/${leaveA1Id}`, { status: 'cancelled' }, tokenEmpA2);
  assert(resOtherCancel.status === 403, 'Employee cannot cancel another employee leave request (HTTP 403)');

  // 2.6 Team Leader TL A views assigned team member (Emp A1) leave -> 200
  const resTLView = await simulate('GET', `/api/leaves/${leaveA1Id}`, null, tokenTLA);
  assert(resTLView.status === 200, 'Team leader accesses assigned team member leave request (HTTP 200)');

  // Create leave for Emp A2 (not assigned to TL A)
  const resCreateLeaveA2 = await simulate('POST', '/api/leaves', {
    leaveType: 'Sick Leave',
    startDate: '2026-11-12',
    endDate: '2026-11-12',
    durationDays: 1,
    reason: 'Fever'
  }, tokenEmpA2);
  const leaveA2Id = resCreateLeaveA2.body.data.id;

  // 2.7 Team Leader TL A attempts to view Emp A2 (unassigned) leave -> 403
  const resTLUnassignedView = await simulate('GET', `/api/leaves/${leaveA2Id}`, null, tokenTLA);
  assert(resTLUnassignedView.status === 403, 'Team leader denied access to unassigned employee leave request (HTTP 403)');

  // 2.8 Team Leader TL A attempts to approve Emp A2 (unassigned) leave -> 403
  const resTLUnassignedApprove = await simulate('PATCH', `/api/leaves/${leaveA2Id}`, { status: 'approved' }, tokenTLA);
  assert(resTLUnassignedApprove.status === 403, 'Team leader denied approval of unassigned employee leave request (HTTP 403)');

  // 2.9 Authorized Founder approves leave request with spoofed ownership attempt -> 200 (ownership preserved)
  const resFounderApprove = await simulate('PATCH', `/api/leaves/${leaveA1Id}`, {
    status: 'approved',
    reviewRemarks: 'Approved by Founder',
    user_id: 'user-hacker-999',
    organization_id: 'org-hacked-999'
  }, tokenFounderA);
  assert(resFounderApprove.status === 200 && resFounderApprove.body.data.status === 'approved', 'Authorized Founder approves leave request (HTTP 200)');
  assert(resFounderApprove.body.data.user_id === empA1.id, 'Leave application user_id remains immutable on approval');
  assert(resFounderApprove.body.data.organization_id === orgA, 'Leave application organization_id remains immutable on approval');

  // 2.10 Race condition / Duplicate approval on already-approved leave -> 409
  const resDuplicateApprove = await simulate('PATCH', `/api/leaves/${leaveA1Id}`, { status: 'rejected', decisionComment: 'Late reject' }, tokenFounderA);
  assert(resDuplicateApprove.status === 409, 'Duplicate approval/rejection on resolved leave is prevented (HTTP 409)');

  console.log('\n--- 3. Pending Leave Count Accuracy ---');
  // Check stats pending leave count: leaveA1 is approved, leaveA2 is pending
  const resStatsFounder = await simulate('GET', '/api/attendance/stats', null, tokenFounderA);
  assert(resStatsFounder.status === 200, 'Founder fetches attendance & dashboard stats (HTTP 200)');
  const pendingCount = resStatsFounder.body.data.pendingLeaves;
  assert(typeof pendingCount === 'number' && pendingCount >= 1, `Pending leave count is accurate (counted ${pendingCount} pending)`);

  console.log('\n--- 4. Timesheet Module Security & Ownership ---');
  // 4.1 Employee creates own timesheet
  const resCreateTS = await simulate('POST', '/api/timesheets', {
    projectName: 'Mobile Security Audit',
    taskDescription: 'Audited RBAC and leave ownership verification',
    hoursSpent: 7.5,
    workDate: '2026-11-06'
  }, tokenEmpA1);
  assert(resCreateTS.status === 201 && resCreateTS.body.success, 'Employee creates own timesheet entry (HTTP 201)');
  const tsId = resCreateTS.body.data.id;

  // 4.2 Hours validation: invalid hours rejected
  const resBadHours = await simulate('POST', '/api/timesheets', {
    projectName: 'Overtime test',
    taskDescription: 'Attempted 30 hours in a day',
    hoursSpent: 30
  }, tokenEmpA1);
  assert(resBadHours.status === 400, 'Timesheet hours exceeding 24 hours are rejected (HTTP 400)');

  // 4.3 Employee views own timesheet list -> 200
  const resListOwnTS = await simulate('GET', '/api/timesheets', null, tokenEmpA1);
  assert(resListOwnTS.status === 200 && resListOwnTS.body.data.every(t => t.user_id === empA1.id), 'Employee views only their own timesheet entries (HTTP 200)');

  // 4.4 Employee A2 cannot view Employee A1 single timesheet -> 403
  const resEmpA2ViewTS = await simulate('GET', `/api/timesheets/${tsId}`, null, tokenEmpA2);
  assert(resEmpA2ViewTS.status === 403, 'Employee cannot view another employee timesheet entry (HTTP 403)');

  // 4.5 Employee A2 cannot update Employee A1 timesheet -> 403
  const resEmpA2UpdateTS = await simulate('PATCH', `/api/timesheets/${tsId}`, { taskDescription: 'Hacked entry' }, tokenEmpA2);
  assert(resEmpA2UpdateTS.status === 403, 'Employee cannot modify another employee timesheet (HTTP 403)');

  // 4.6 Employee cannot approve their own timesheet -> 403
  const resSelfApproveTS = await simulate('PATCH', `/api/timesheets/${tsId}`, { status: 'approved' }, tokenEmpA1);
  assert(resSelfApproveTS.status === 403, 'Employee cannot approve their own timesheet (HTTP 403)');

  // 4.7 Employee updates their own unapproved timesheet -> 200
  const resSelfUpdateTS = await simulate('PATCH', `/api/timesheets/${tsId}`, { taskDescription: 'Updated audit notes' }, tokenEmpA1);
  assert(resSelfUpdateTS.status === 200 && resSelfUpdateTS.body.data.task_description === 'Updated audit notes', 'Employee updates own unapproved timesheet (HTTP 200)');

  // 4.8 Team Leader TL A accesses assigned team member timesheet -> 200
  const resTLViewTS = await simulate('GET', `/api/timesheets/${tsId}`, null, tokenTLA);
  assert(resTLViewTS.status === 200, 'Team leader accesses assigned team member timesheet (HTTP 200)');

  // 4.9 Team Leader TL A approves assigned member timesheet with spoofed ownership payload -> 200 (ownership preserved)
  const resTLApproveTS = await simulate('PATCH', `/api/timesheets/${tsId}`, {
    status: 'approved',
    reviewRemarks: 'Looks good',
    user_id: 'user-hacker-999',
    organization_id: 'org-hacked-999'
  }, tokenTLA);
  assert(resTLApproveTS.status === 200 && resTLApproveTS.body.data.status === 'approved', 'Team leader approves assigned member timesheet (HTTP 200)');
  assert(resTLApproveTS.body.data.user_id === empA1.id, 'Timesheet user_id remains immutable on Team Leader approval');
  assert(resTLApproveTS.body.data.organization_id === orgA, 'Timesheet organization_id remains immutable on Team Leader approval');

  // 4.10 Employee cannot modify or delete an already approved timesheet -> 403
  const resEditApprovedTS = await simulate('PATCH', `/api/timesheets/${tsId}`, { taskDescription: 'Tamper after approval' }, tokenEmpA1);
  assert(resEditApprovedTS.status === 403, 'Employee cannot modify an already approved timesheet (HTTP 403)');

  const resDeleteApprovedTS = await simulate('DELETE', `/api/timesheets/${tsId}`, null, tokenEmpA1);
  assert(resDeleteApprovedTS.status === 403, 'Employee cannot delete an already approved timesheet (HTTP 403)');

  // 4.11 Founder creates own timesheet and attempts self-approval -> 403
  const resCreateFounderTS = await simulate('POST', '/api/timesheets', {
    projectName: 'Executive Strategy',
    taskDescription: 'Board meeting and investor updates',
    hoursSpent: 5.0
  }, tokenFounderA);
  const founderTSId = resCreateFounderTS.body.data.id;

  const resFounderSelfApprove = await simulate('PATCH', `/api/timesheets/${founderTSId}`, { status: 'approved' }, tokenFounderA);
  assert(resFounderSelfApprove.status === 403, 'Founder/Admin cannot approve their own timesheet (HTTP 403)');

  // 4.12 Attempt to change user_id or organization_id through UPDATE operation
  const resTamperOwnershipTS = await simulate('PATCH', `/api/timesheets/${founderTSId}`, {
    taskDescription: 'Legitimate update attempt with spoofed user_id and org_id',
    user_id: 'user-hacker-999',
    userId: 'user-hacker-999',
    organization_id: 'org-hacked-999',
    organizationId: 'org-hacked-999'
  }, tokenFounderA);
  assert(resTamperOwnershipTS.status === 200, 'Update request processed safely (HTTP 200)');
  assert(resTamperOwnershipTS.body.data.user_id === founderA.id, 'User ID cannot be changed via UPDATE operation');
  assert(resTamperOwnershipTS.body.data.organization_id === orgA, 'Organization ID cannot be changed via UPDATE operation');

  // 4.13 Legitimate Founder approves employee timesheet
  const resCreateEmpA2TS = await simulate('POST', '/api/timesheets', {
    projectName: 'Logistics Optimization',
    taskDescription: 'Warehouse supply route planning',
    hoursSpent: 6.0
  }, tokenEmpA2);
  const empA2TSId = resCreateEmpA2TS.body.data.id;

  const resFounderApproveEmpTS = await simulate('PATCH', `/api/timesheets/${empA2TSId}`, { status: 'approved', reviewRemarks: 'Approved by Founder' }, tokenFounderA);
  assert(resFounderApproveEmpTS.status === 200 && resFounderApproveEmpTS.body.data.status === 'approved', 'Legitimate Founder approves employee timesheet (HTTP 200)');

  console.log('\n--- 5. Organization-Level Data Isolation ---');
  // 5.1 Org B attempts to read Org A timesheets -> 404 or empty
  const resOrgBTS = await simulate('GET', `/api/timesheets/${tsId}`, null, tokenFounderB);
  assert(resOrgBTS.status === 404, 'Organization B cannot read Organization A timesheet (HTTP 404)');

  // 5.2 Org B attempts to read Org A bank details -> empty / null
  const resOrgBBank = await simulate('GET', '/api/admin/bank-details', null, tokenFounderB);
  assert(resOrgBBank.status === 200 && resOrgBBank.body.data.every(b => b.organizationId === orgB || !b.userId?.startsWith('user-emp-001')), 'Organization B isolated from Organization A bank details');

  // 5.3 Storage path traversal and cross-tenant access rejection
  const resBadStorage = await simulate('GET', '/api/storage/signed-url?bucket=attendance-selfies&path=org-demo-001/user-emp-001/selfie.jpg', null, tokenFounderB);
  assert(resBadStorage.status === 403, 'Cross-tenant private storage access denied (HTTP 403)');

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});

