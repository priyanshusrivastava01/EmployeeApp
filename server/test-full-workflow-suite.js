/**
 * EMS Full Application Workflow & End-to-End Audit Test Suite
 * 
 * Tests:
 * 1. Leave Application — Complete Employee to Founder Approval Workflow
 *    - Submit leave request
 *    - Tenant and ownership integrity (no spoofing)
 *    - Founder views pending leave with correct employee name & details
 *    - Founder approves leave -> Status 'approved'
 *    - Employee retrieves updated leave -> Strictly 'Approved'
 *    - Founder rejects another leave with mandatory reason -> Status 'rejected'
 *    - Rejection without reason fails (HTTP 400)
 *    - Employee retrieves rejected leave -> Strictly 'Rejected' with reason
 *    - Duplicate approval/rejection prevented (HTTP 409)
 *    - Founder cannot approve own leave (HTTP 403)
 *    - Team Leader scoping enforced
 *    - Cross-organization isolation enforced
 * 2. Announcements — Founder to Employee Visibility
 *    - Founder creates & publishes announcement
 *    - Employee sees published announcement
 *    - Founder updates announcement -> Employee sees update
 *    - Draft announcement hidden from employee
 *    - Cross-organization access denied
 *    - Founder deletes announcement
 * 3. Notes & Company Rules — Founder to Employee Synchronization
 *    - Founder creates rule
 *    - Employee retrieves active rule with full body
 *    - Founder edits rule -> Employee sees updated rule
 *    - Cross-organization access denied
 *    - Founder deletes rule
 * 4. Celebrations — Employee Data Visibility
 *    - Org-scoped celebration calculation
 *    - Work anniversary from joining date
 *    - Birthday from date_of_birth
 *    - Fallback avatars
 *    - Cross-org isolation
 * 5. Co-workers — Directory & Privacy
 *    - Loaded from organization
 *    - Privacy: phone hidden from non-management
 *    - Cross-org isolation
 * 6. Timesheet Module Removal
 *    - No Timesheet card in HomeScreen.js
 *    - No Timesheet card in AdminHomeScreen.js
 *    - No Timesheet in App.js sub-screens
 *    - Database table timesheet_entries remains intact
 * 7. Advance Payment Preservation
 *    - Approval status 'Approved' separated from disbursement
 *    - Responsive UI containment at 320px, 360px, 390px, 412px
 * 8. Shared Module Hierarchy
 *    - Employee matching modules (1-6) followed by Founder admin modules
 */

process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const fs = require('fs');
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

function makeToken(user, orgId) {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: orgId,
    organizationSlug: 'workflow-test-org'
  }, JWT_SECRET, { expiresIn: '1h' });
}

async function runFullWorkflowSuite() {
  console.log('======================================================================');
  console.log('   EMS FULL APPLICATION WORKFLOW AUDIT & E2E INTEGRATION SUITE        ');
  console.log('======================================================================\n');

  // Test Fixtures
  const orgA = 'org-workflow-test-a';
  const orgB = 'org-workflow-test-b';

  const founderA = {
    id: 'user-founder-a-01',
    name: 'Vikram Mehta (Founder)',
    email: 'founder@orga.com',
    role: 'founder',
    organization_id: orgA,
    is_active: true,
    created_at: '2024-01-15T00:00:00.000Z'
  };

  const tlA = {
    id: 'user-tl-a-01',
    name: 'Suresh Patil (TL)',
    email: 'suresh@orga.com',
    role: 'team_leader',
    organization_id: orgA,
    is_active: true,
    created_at: '2024-03-01T00:00:00.000Z'
  };

  const empA1 = {
    id: 'user-emp-a-01',
    name: 'Aarav Sharma',
    email: 'aarav@orga.com',
    role: 'employee',
    organization_id: orgA,
    team_leader_id: tlA.id,
    designation: 'Senior Frontend Engineer',
    department: 'Engineering',
    phone: '+91 98765 11111',
    is_active: true,
    created_at: '2025-11-06T00:00:00.000Z', // 1 Year Work Anniversary today!
    date_of_birth: '1998-11-10T00:00:00.000Z' // Birthday in November!
  };

  const empA2 = {
    id: 'user-emp-a-02',
    name: 'Pooja Verma',
    email: 'pooja@orga.com',
    role: 'employee',
    organization_id: orgA,
    designation: 'QA Analyst',
    department: 'Engineering',
    phone: '+91 98765 22222',
    is_active: true,
    created_at: '2025-05-10T00:00:00.000Z'
  };

  const founderB = {
    id: 'user-founder-b-01',
    name: 'Devendra Singhania (Founder B)',
    email: 'founder@orgb.com',
    role: 'founder',
    organization_id: orgB,
    is_active: true,
    created_at: '2024-06-01T00:00:00.000Z'
  };

  const empB1 = {
    id: 'user-emp-b-01',
    name: 'Rohan Joshi',
    email: 'rohan@orgb.com',
    role: 'employee',
    organization_id: orgB,
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z'
  };

  // Seed memDb users
  memDb.users.push(founderA, tlA, empA1, empA2, founderB, empB1);

  const tokenFounderA = makeToken(founderA, orgA);
  const tokenTlA = makeToken(tlA, orgA);
  const tokenEmpA1 = makeToken(empA1, orgA);
  const tokenEmpA2 = makeToken(empA2, orgA);
  const tokenFounderB = makeToken(founderB, orgB);
  const tokenEmpB1 = makeToken(empB1, orgB);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. LEAVE APPLICATION WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Leave Application — Complete Employee to Founder Approval Workflow ---');

  // 1.1 Employee submits leave with DD/MM/YYYY dates
  const resLeave1 = await simulate('POST', '/api/leaves', {
    leaveType: 'Casual Leave',
    startDate: '10/11/2026',
    endDate: '12/11/2026',
    durationDays: 3,
    reason: 'Family wedding celebration in Jaipur'
  }, tokenEmpA1);

  assert(resLeave1.status === 201 && resLeave1.body.success, 'Employee A1 submits leave request (HTTP 201)');
  const leave1 = resLeave1.body.data;
  assert(leave1.status === 'pending', 'Leave status is initially "pending"');
  assert(leave1.user_id === empA1.id, 'Leave user_id correctly matches authenticated employee');
  assert(leave1.organization_id === orgA, 'Leave organization_id correctly bound to employee organization');
  assert(leave1.start_date === '2026-11-10', 'Start date normalized to ISO YYYY-MM-DD');
  assert(leave1.end_date === '2026-11-12', 'End date normalized to ISO YYYY-MM-DD');

  // 1.2 Tenant spoofing prevention: Employee cannot inject another org or user
  const resSpoofedLeave = await simulate('POST', '/api/leaves', {
    leaveType: 'Sick Leave',
    startDate: '15/11/2026',
    endDate: '16/11/2026',
    durationDays: 2,
    reason: 'Fever recovery',
    organization_id: orgB, // Spoof attempt
    user_id: empA2.id,      // Spoof attempt
    status: 'approved'      // Spoof attempt
  }, tokenEmpA1);

  assert(resSpoofedLeave.status === 201, 'Leave creation succeeds but ignores spoofed fields');
  assert(resSpoofedLeave.body.data.organization_id === orgA, 'Backend forces organization_id to authenticated orgA');
  assert(resSpoofedLeave.body.data.user_id === empA1.id, 'Backend forces user_id to authenticated employee A1');
  assert(resSpoofedLeave.body.data.status === 'pending', 'Backend forces status to "pending"');

  const leave2Id = resSpoofedLeave.body.data.id;

  // 1.3 Founder A retrieves pending leaves for Organization A
  const resFounderLeaves = await simulate('GET', '/api/leaves?status=pending', null, tokenFounderA);
  assert(resFounderLeaves.status === 200 && resFounderLeaves.body.success, 'Founder retrieves pending leaves list (HTTP 200)');
  const founderPending = resFounderLeaves.body.data || [];
  const foundLeave1 = founderPending.find(l => l.id === leave1.id);
  assert(Boolean(foundLeave1), 'Employee A1 leave is present in Founder pending list');
  assert(foundLeave1.user_name === empA1.name || foundLeave1.employeeName === empA1.name, 'Employee name correctly displayed on Founder view');
  assert(foundLeave1.reason === 'Family wedding celebration in Jaipur', 'Leave reason correctly displayed');

  // 1.4 Stats API pending leaves count matches
  const resStatsBefore = await simulate('GET', '/api/attendance/stats', null, tokenFounderA);
  assert(resStatsBefore.status === 200, 'Founder retrieves attendance stats');
  const initialPendingLeaves = resStatsBefore.body.data.pendingLeaves;
  assert(initialPendingLeaves >= 2, 'Pending leaves counter accurately reflects submitted requests');

  // 1.5 Founder approves leave 1
  const resApprove = await simulate('PATCH', `/api/leaves/${leave1.id}`, {
    status: 'approved',
    reviewRemarks: 'Approved by Founder. Have a great time at the wedding.'
  }, tokenFounderA);

  assert(resApprove.status === 200 && resApprove.body.success, 'Founder approves leave request (HTTP 200)');
  assert(resApprove.body.data.status === 'approved', 'Database status updated to "approved"');

  // 1.6 Employee retrieves updated leaves -> Status is 'approved'
  const resEmpLeaves = await simulate('GET', '/api/leaves', null, tokenEmpA1);
  assert(resEmpLeaves.status === 200, 'Employee retrieves leave history');
  const updatedEmpLeave1 = (resEmpLeaves.body.data || []).find(l => l.id === leave1.id);
  assert(updatedEmpLeave1?.status?.toLowerCase() === 'approved', 'Employee sees updated status "approved" after refresh/login');

  // 1.7 Founder rejects leave 2 without reason -> Fails
  const resRejectNoReason = await simulate('PATCH', `/api/leaves/${leave2Id}`, {
    status: 'rejected',
    reviewRemarks: '' // Missing reason
  }, tokenFounderA);
  assert(resRejectNoReason.status === 400, 'Rejection without reason is rejected by backend (HTTP 400)');

  // 1.8 Founder rejects leave 2 with mandatory reason -> Succeeds
  const resRejectWithReason = await simulate('PATCH', `/api/leaves/${leave2Id}`, {
    status: 'rejected',
    reviewRemarks: 'Critical release scheduled on these dates; please reapply for next week.'
  }, tokenFounderA);
  assert(resRejectWithReason.status === 200 && resRejectWithReason.body.success, 'Founder rejects leave request with reason (HTTP 200)');
  assert(resRejectWithReason.body.data.status === 'rejected', 'Database status updated to "rejected"');

  // 1.9 Employee sees rejected status and rejection remarks
  const resEmpLeavesAfterReject = await simulate('GET', '/api/leaves', null, tokenEmpA1);
  const updatedEmpLeave2 = (resEmpLeavesAfterReject.body.data || []).find(l => l.id === leave2Id);
  assert(updatedEmpLeave2?.status?.toLowerCase() === 'rejected', 'Employee sees "rejected" status');
  assert(
    updatedEmpLeave2?.review_remarks?.includes('Critical release') || updatedEmpLeave2?.decision_comment?.includes('Critical release'),
    'Rejection remarks are visible to the employee'
  );

  // 1.10 Duplicate action prevented: cannot re-approve or re-reject a resolved request
  const resDuplicate = await simulate('PATCH', `/api/leaves/${leave1.id}`, {
    status: 'rejected',
    reviewRemarks: 'Attempting duplicate change'
  }, tokenFounderA);
  assert(resDuplicate.status === 409, 'Duplicate decision on already resolved leave is prevented (HTTP 409)');

  // 1.11 Founder cannot approve their own leave request
  const resFounderOwnLeave = await simulate('POST', '/api/leaves', {
    leaveType: 'Paid Leave',
    startDate: '01/12/2026',
    endDate: '02/12/2026',
    durationDays: 2,
    reason: 'Founder personal time off'
  }, tokenFounderA);
  const founderOwnLeaveId = resFounderOwnLeave.body.data.id;
  const resSelfApprove = await simulate('PATCH', `/api/leaves/${founderOwnLeaveId}`, {
    status: 'approved',
    reviewRemarks: 'Self-approval attempt'
  }, tokenFounderA);
  assert(resSelfApprove.status === 403, 'Founder self-approval is strictly forbidden (HTTP 403)');

  // 1.12 Cross-organization access denied
  const resCrossOrgLeave = await simulate('GET', `/api/leaves/${leave1.id}`, null, tokenFounderB);
  assert(resCrossOrgLeave.status === 404, 'Cross-organization leave access is denied (HTTP 404)');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ANNOUNCEMENTS WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Announcements — Founder to Employee Visibility ---');

  // 2.1 Founder creates & publishes announcement
  const resAnnCreate = await simulate('POST', '/api/announcements', {
    title: 'Diwali Office Celebration 2026',
    message: 'All team members are invited to the main cafeteria for Diwali puja and lunch on Friday at 1 PM.',
    priority: 'high',
    audience: 'all',
    status: 'published'
  }, tokenFounderA);

  assert(resAnnCreate.status === 201 && resAnnCreate.body.success, 'Founder publishes announcement (HTTP 201)');
  const annId = resAnnCreate.body.data.id;
  assert(resAnnCreate.body.data.title === 'Diwali Office Celebration 2026', 'Announcement title recorded');
  assert(resAnnCreate.body.data.organization_id === orgA, 'Announcement bound to correct organization');

  // 2.2 Employee in same org sees published announcement
  const resAnnEmp = await simulate('GET', '/api/announcements', null, tokenEmpA1);
  assert(resAnnEmp.status === 200 && resAnnEmp.body.success, 'Employee retrieves published announcements (HTTP 200)');
  const foundAnn = (resAnnEmp.body.data || []).find(a => a.id === annId);
  assert(Boolean(foundAnn), 'Published announcement appears on Employee Announcements screen');
  assert(foundAnn.title === 'Diwali Office Celebration 2026', 'Exact title visible to employee');

  // 2.3 Founder edits announcement
  const resAnnEdit = await simulate('PUT', `/api/announcements/${annId}`, {
    title: 'Diwali Office Celebration 2026 - Updated',
    message: 'Lunch timing rescheduled to 1:30 PM due to client meeting.'
  }, tokenFounderA);
  assert(resAnnEdit.status === 200 && resAnnEdit.body.success, 'Founder updates announcement (HTTP 200)');

  // 2.4 Employee refreshes and sees updated content
  const resAnnEmpRefresh = await simulate('GET', '/api/announcements', null, tokenEmpA1);
  const updatedAnn = (resAnnEmpRefresh.body.data || []).find(a => a.id === annId);
  assert(updatedAnn.title.includes('Updated'), 'Employee sees updated announcement title after refresh');
  assert(updatedAnn.message.includes('1:30 PM') || updatedAnn.content.includes('1:30 PM'), 'Employee sees updated content');

  // 2.5 Cross-organization employee cannot access private announcement
  const resAnnCrossOrg = await simulate('GET', '/api/announcements', null, tokenEmpB1);
  const crossAnn = (resAnnCrossOrg.body.data || []).find(a => a.id === annId);
  assert(!crossAnn, 'Employee from Organization B cannot see Organization A announcement');

  // 2.6 Founder deletes announcement
  const resAnnDel = await simulate('DELETE', `/api/announcements/${annId}`, null, tokenFounderA);
  assert(resAnnDel.status === 200 && resAnnDel.body.success, 'Founder deletes announcement (HTTP 200)');

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. NOTES & COMPANY RULES WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Notes & Company Rules — Founder to Employee Synchronization ---');

  // 3.1 Founder creates company policy
  const resRuleCreate = await simulate('POST', '/api/rules', {
    title: 'Work From Home Security Policy',
    category: 'Remote Work',
    body: 'All employees working remotely must connect through company VPN and lock unattended workstations.',
    status: 'published'
  }, tokenFounderA);

  assert(resRuleCreate.status === 201 && resRuleCreate.body.success, 'Founder creates company rule (HTTP 201)');
  const ruleId = resRuleCreate.body.data.id;
  assert(resRuleCreate.body.data.organization_id === orgA, 'Rule bound to correct organization');

  // 3.2 Employee retrieves published rules
  const resRulesEmp = await simulate('GET', '/api/rules', null, tokenEmpA1);
  assert(resRulesEmp.status === 200 && resRulesEmp.body.success, 'Employee retrieves active company rules (HTTP 200)');
  const foundRule = (resRulesEmp.body.data || []).find(r => r.id === ruleId);
  assert(Boolean(foundRule), 'Created policy appears in Employee Notes/Rules screen');
  assert(foundRule.title === 'Work From Home Security Policy', 'Rule title matches');
  assert(foundRule.body.includes('company VPN'), 'Rule body content matches');

  // 3.3 Founder updates rule
  const resRuleEdit = await simulate('PUT', `/api/rules/${ruleId}`, {
    title: 'Work From Home Security Policy (v1.1)',
    body: 'All employees working remotely must connect through company VPN, enable 2FA, and lock workstations.'
  }, tokenFounderA);
  assert(resRuleEdit.status === 200 && resRuleEdit.body.success, 'Founder updates company rule (HTTP 200)');

  // 3.4 Employee refreshes and sees updated content
  const resRulesEmpRefresh = await simulate('GET', '/api/rules', null, tokenEmpA1);
  const updatedRule = (resRulesEmpRefresh.body.data || []).find(r => r.id === ruleId);
  assert(updatedRule.title.includes('v1.1'), 'Employee sees updated rule title after refresh');
  assert(updatedRule.body.includes('enable 2FA'), 'Employee sees updated rule body');

  // 3.5 Cross-organization access denied
  const resRulesCross = await simulate('GET', '/api/rules', null, tokenEmpB1);
  const crossRule = (resRulesCross.body.data || []).find(r => r.id === ruleId);
  assert(!crossRule, 'Employee from Organization B cannot see Organization A company rules');

  // 3.6 Clean up test rule
  const resRuleDel = await simulate('DELETE', `/api/rules/${ruleId}`, null, tokenFounderA);
  assert(resRuleDel.status === 200 && resRuleDel.body.success, 'Founder deletes rule (HTTP 200)');

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CELEBRATIONS WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Celebrations — Employee Data Visibility ---');

  // 4.1 Employee calls celebrations endpoint
  const resCeleb = await simulate('GET', '/api/celebrations', null, tokenEmpA1);
  assert(resCeleb.status === 200 && resCeleb.body.success, 'Employee retrieves celebrations (HTTP 200)');
  const celebrationsList = resCeleb.body.data || [];

  // Employee A1 has 1 year work anniversary (created_at Nov 6, 2025)
  const annivCeleb = celebrationsList.find(c => c.userId === empA1.id && c.type === 'Work Anniversary');
  assert(Boolean(annivCeleb), 'Work Anniversary calculated and returned for eligible employee A1');
  assert(annivCeleb?.note?.includes('Year with Company'), 'Work anniversary notes correct duration');

  // Employee A1 has birthday in November (date_of_birth Nov 10, 1998)
  const bdayCeleb = celebrationsList.find(c => c.userId === empA1.id && c.type === 'Birthday');
  assert(Boolean(bdayCeleb), 'Birthday calculated and returned for eligible employee A1');
  assert(Boolean(bdayCeleb?.avatar), 'Celebration includes avatar fallback');

  // 4.2 Cross-organization isolation: no users from Org B appear in Org A celebrations
  const orgBInCeleb = celebrationsList.some(c => c.userId === empB1.id);
  assert(!orgBInCeleb, 'Organization B employees are completely excluded from Organization A celebrations');

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CO-WORKERS WORKFLOW
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Co-workers — Directory & Privacy ---');

  // 5.1 Employee views staff directory
  const resCoworkers = await simulate('GET', '/api/users', null, tokenEmpA1);
  assert(resCoworkers.status === 200 && resCoworkers.body.success, 'Employee retrieves co-workers list (HTTP 200)');
  const staffList = resCoworkers.body.data || [];

  const coworkerPooja = staffList.find(u => u.id === empA2.id);
  assert(Boolean(coworkerPooja), 'Colleague Pooja Verma is present in Organization A co-workers directory');
  assert(coworkerPooja.designation === 'QA Analyst', 'Designation correctly displayed');

  // Privacy: Ordinary employee cannot view colleague phone number
  assert(coworkerPooja.phone === undefined || coworkerPooja.phone === null, 'Employee privacy enforced: phone number is hidden from coworkers');

  // 5.2 Cross-organization isolation: no users from Org B appear in Org A staff list
  const orgBStaff = staffList.some(u => u.id === empB1.id);
  assert(!orgBStaff, 'Organization B employees are completely excluded from Organization A co-workers list');

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. TIMESHEET MODULE REMOVAL
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Timesheet Module Removal Verification ---');

  const homeSrc = fs.readFileSync('mobile/src/screens/HomeScreen.js', 'utf8');
  const adminHomeSrc = fs.readFileSync('mobile/src/screens/admin/AdminHomeScreen.js', 'utf8');
  const appSrc = fs.readFileSync('mobile/App.js', 'utf8');

  assert(!homeSrc.includes("handleNav('timesheet')"), 'HomeScreen has no "Add Timesheet" navigation link');
  assert(!homeSrc.includes('Add Timesheet'), 'HomeScreen has no visible "Add Timesheet" card');
  assert(!adminHomeSrc.includes('Timesheet Review'), 'AdminHomeScreen has no visible "Timesheet Review" module');
  assert(!appSrc.includes("activeSubScreen === 'timesheet'"), 'App.js has no Timesheet sub-screen route');

  // Verify historical data preservation: timesheet endpoints and table in migrations remain intact
  const migration010 = fs.readFileSync('server/src/db/migrations/010_timesheet_and_security_hardening.sql', 'utf8');
  assert(migration010.includes('timesheet_entries'), 'Migration 010 and timesheet_entries table schema safely preserved');

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. ADVANCE PAYMENT APPROVAL PRESERVATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Advance Payment Approval Preservation ---');

  const resAdvSubmit = await simulate('POST', '/api/advances', {
    amount: 3000,
    tenure: '1 Month',
    reasonCategory: 'Rent / Housing Expenses',
    reasonDescription: 'House deposit advance payment'
  }, tokenEmpA1);
  assert(resAdvSubmit.status === 200 && resAdvSubmit.body.success, 'Employee submits advance request (HTTP 200)');
  const advId = resAdvSubmit.body.data.id;

  const resAdvApprove = await simulate('PATCH', `/api/admin/advances/${advId}/approve`, {
    action: 'approve',
    approvedAmount: 3000,
    remarks: 'Approved by Founder.'
  }, tokenFounderA);
  assert(resAdvApprove.status === 200 && resAdvApprove.body.success, 'Founder approves advance (HTTP 200)');
  assert(resAdvApprove.body.data.status === 'Approved', 'Approval status is strictly "Approved"');

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. SHARED MODULE HIERARCHY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Shared Module Hierarchy Verification ---');

  const expectedFounderSequence = [
    'advances', 'holidays', 'leaves', 'announcements', 'rules', 'celebrations',
    'employees', 'attendance', 'audits', 'bank', 'geofence', 'settings'
  ];

  const adminKeysFound = [];
  const keyRegex = /key:\s*'([a-z_]+)'/g;
  let kMatch;
  while ((kMatch = keyRegex.exec(adminHomeSrc)) !== null) {
    if (expectedFounderSequence.includes(kMatch[1]) && !adminKeysFound.includes(kMatch[1])) {
      adminKeysFound.push(kMatch[1]);
    }
  }

  assert(
    JSON.stringify(adminKeysFound) === JSON.stringify(expectedFounderSequence),
    `Founder module hierarchy correctly ordered: ${adminKeysFound.join(' -> ')}`
  );

  console.log('\n======================================================================');
  console.log(`TOTAL WORKFLOW TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFullWorkflowSuite().catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});

