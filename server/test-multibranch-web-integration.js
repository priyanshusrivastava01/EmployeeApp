/**
 * Automated Verification Suite for Multi-Branch Web Integration
 * Tests:
 * 1. WFO employee creation with branch selection (success)
 * 2. WFO employee creation without branch (400 rejection)
 * 3. WFH employee creation (success, branch_id is null)
 * 4. Employee branch reassignment
 * 5. Switching from WFO to WFH (branch_id cleared to null)
 * 6. Switching from WFH to WFO (branch_id assigned)
 * 7. Verification that existing employee directory & profile integrity remains unchanged
 */

process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const JWT_SECRET = process.env.JWT_SECRET || 'ems-super-secret-jwt-key-2026-production';
const { app, memDb } = require('./src/index');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${message}`);
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

function generateTestToken(userId, role, organizationId) {
  return jwt.sign(
    {
      id: userId,
      userId: userId,
      role: role,
      organizationId: organizationId,
      companySlug: 'multi-branch-org'
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function runSuite() {
  console.log('======================================================================');
  console.log('   MULTI-BRANCH WEB INTEGRATION & EMPLOYEE WORKFLOW TEST SUITE');
  console.log('======================================================================\n');

  // Non-UUID ID ensures memory sandbox isolation (preserves live database completely)
  const ORG_ID = 'org-web-integration-test';
  const FOUNDER_ID = 'fnd-web-integration-test';
  const founderToken = generateTestToken(FOUNDER_ID, 'founder', ORG_ID);

  // Setup test organization in memDb
  if (!memDb.organizations) memDb.organizations = [];
  memDb.organizations = memDb.organizations.filter(o => o.id !== ORG_ID);
  memDb.organizations.push({
    id: ORG_ID,
    name: 'Acme Test Corp',
    slug: 'acme-test-corp',
    office_lat: 26.8097916,
    office_lng: 83.3515645,
    office_radius_meters: 150,
    wfh_allowed: true,
    is_active: true
  });

  if (!memDb.users) memDb.users = [];
  memDb.users = memDb.users.filter(u => u.organization_id !== ORG_ID);
  memDb.users.push({
    id: FOUNDER_ID,
    organization_id: ORG_ID,
    name: 'Founder User',
    email: 'founder@acmetest.com',
    role: 'founder',
    is_active: true
  });

  // Setup branches via POST /api/branches
  console.log('--- SETUP: Office Branches for Organization ---');
  const hqRes = await simulate('POST', '/api/branches', {
    name: 'Gorakhpur Head Office',
    address: 'Bargadwa, Gorakhpur',
    latitude: 26.8097916,
    longitude: 83.3515645,
    radiusMeters: 150,
    isHeadquarters: true,
    isActive: true
  }, founderToken);
  assert(hqRes.status === 201, 'Head Office branch created (HTTP 201)');
  const hqBranchId = hqRes.body.data?.id;

  const satRes = await simulate('POST', '/api/branches', {
    name: 'Lucknow Regional Branch',
    address: 'Gomti Nagar, Lucknow',
    latitude: 26.8500,
    longitude: 80.9500,
    radiusMeters: 200,
    isHeadquarters: false,
    isActive: true
  }, founderToken);
  assert(satRes.status === 201, 'Secondary Lucknow branch created (HTTP 201)');
  const satBranchId = satRes.body.data?.id;

  // --- TEST 1: WFO Employee Creation with Branch Selection ---
  console.log('\n--- TEST 1: WFO Employee Creation with Branch Selection ---');
  const wfoRes = await simulate('POST', '/api/users', {
    name: 'WFO Test User',
    email: 'wfo.test@company.com',
    role: 'employee',
    department: 'Engineering',
    designation: 'Software Developer',
    workMode: 'WFO',
    branchId: hqBranchId
  }, founderToken);

  assert(wfoRes.status === 201, 'WFO employee creation succeeds (HTTP 201)');
  assert(wfoRes.body.data?.work_mode === 'WFO', 'Employee work_mode is stored as WFO');
  assert(wfoRes.body.data?.branch_id === hqBranchId, 'Employee is correctly linked to Headquarters branch');
  const wfoUserId = wfoRes.body.data?.id;

  // --- TEST 2: WFO Employee Creation without Branch Rejected ---
  console.log('\n--- TEST 2: WFO Employee Missing Branch Rejection ---');
  const invalidWfoRes = await simulate('POST', '/api/users', {
    name: 'Invalid WFO User',
    email: 'invalid.wfo@company.com',
    role: 'employee',
    workMode: 'WFO'
    // missing branchId
  }, founderToken);

  assert(invalidWfoRes.status === 400, 'WFO employee creation without branch rejected (HTTP 400)');
  assert(
    invalidWfoRes.body.error?.includes('branch selection is required'),
    'Clear rejection message returned for missing office branch'
  );

  // --- TEST 3: WFH Employee Creation ---
  console.log('\n--- TEST 3: WFH Employee Creation ---');
  const wfhRes = await simulate('POST', '/api/users', {
    name: 'WFH Remote User',
    email: 'wfh.remote@company.com',
    role: 'employee',
    department: 'Design',
    designation: 'Product Designer',
    workMode: 'WFH',
    branchId: null
  }, founderToken);

  assert(wfhRes.status === 201, 'WFH employee creation succeeds (HTTP 201)');
  assert(wfhRes.body.data?.work_mode === 'WFH', 'Employee work_mode is stored as WFH');
  assert(wfhRes.body.data?.branch_id === null, 'WFH employee branch_id is strictly null');
  const wfhUserId = wfhRes.body.data?.id;

  // --- TEST 4: Employee Branch Reassignment ---
  console.log('\n--- TEST 4: Employee Branch Reassignment ---');
  const reassignRes = await simulate('PATCH', `/api/users/${wfoUserId}`, {
    branch_id: satBranchId
  }, founderToken);

  assert(reassignRes.status === 200, 'Employee branch update succeeds (HTTP 200)');
  assert(reassignRes.body.data?.branch_id === satBranchId, 'Employee branch_id updated to Lucknow Regional Branch');

  // Verify GET /api/branches/my-branch reflects reassigned branch
  const wfoUserToken = generateTestToken(wfoUserId, 'employee', ORG_ID);
  const myBranchRes = await simulate('GET', '/api/branches/my-branch', null, wfoUserToken);
  assert(myBranchRes.status === 200, 'Reassigned user queries /api/branches/my-branch (HTTP 200)');
  assert(myBranchRes.body.branch?.id === satBranchId, 'my-branch correctly returns Lucknow Regional Branch');
  assert(myBranchRes.body.branch?.name === 'Lucknow Regional Branch', 'Branch name accurately reflected');

  // --- TEST 5: Switching from WFO to WFH ---
  console.log('\n--- TEST 5: Switching from WFO to WFH ---');
  const switchToWfhRes = await simulate('PATCH', `/api/users/${wfoUserId}`, {
    work_mode: 'WFH'
  }, founderToken);

  assert(switchToWfhRes.status === 200, 'Switching from WFO to WFH succeeds (HTTP 200)');
  assert(switchToWfhRes.body.data?.work_mode === 'WFH', 'work_mode updated to WFH');
  assert(switchToWfhRes.body.data?.branch_id === null, 'branch_id automatically set to null for WFH');

  // Verify my-branch for WFH user
  const wfhCheckRes = await simulate('GET', '/api/branches/my-branch', null, wfoUserToken);
  assert(wfhCheckRes.status === 200, 'WFH user queries /api/branches/my-branch (HTTP 200)');
  assert(wfhCheckRes.body.workMode === 'WFH', 'workMode confirmed as WFH');
  assert(wfhCheckRes.body.branch === null, 'branch is null for WFH mode');

  // --- TEST 6: Switching from WFH back to WFO with Branch Assignment ---
  console.log('\n--- TEST 6: Switching from WFH back to WFO with Branch Assignment ---');
  const switchToWfoRes = await simulate('PATCH', `/api/users/${wfoUserId}`, {
    work_mode: 'WFO',
    branch_id: hqBranchId
  }, founderToken);

  assert(switchToWfoRes.status === 200, 'Switching from WFH to WFO succeeds (HTTP 200)');
  assert(switchToWfoRes.body.data?.work_mode === 'WFO', 'work_mode updated to WFO');
  assert(switchToWfoRes.body.data?.branch_id === hqBranchId, 'branch_id assigned to Headquarters branch');

  // --- TEST 7: Existing Employee Profile and Directory Functionality ---
  console.log('\n--- TEST 7: Existing Employee Directory & Profile Integrity ---');
  const listUsersRes = await simulate('GET', '/api/users', null, founderToken);
  assert(listUsersRes.status === 200, 'GET /api/users succeeds (HTTP 200)');
  assert(Array.isArray(listUsersRes.body.data), 'Returns users array');
  
  const createdUser = listUsersRes.body.data.find(u => u.id === wfoUserId);
  assert(Boolean(createdUser), 'Created user is listed in directory');
  assert(createdUser.workMode === 'WFO', 'Directory includes workMode');
  assert(createdUser.branchId === hqBranchId, 'Directory includes branchId');
  assert(createdUser.branchName === 'Gorakhpur Head Office', 'Directory enriches branchName correctly');

  // --- TEST 8: Branch Active Filter for Add Employee Modal ---
  console.log('\n--- TEST 8: Active Branches Listing Filter for Modal ---');
  const activeBranchesRes = await simulate('GET', '/api/branches?active=true', null, founderToken);
  assert(activeBranchesRes.status === 200, 'GET /api/branches?active=true succeeds (HTTP 200)');
  assert(activeBranchesRes.body.data.every(b => b.is_active === true), 'All returned branches are active');

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
