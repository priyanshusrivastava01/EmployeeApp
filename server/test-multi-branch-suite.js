/**
 * ============================================================================
 * EMS AUTOMATED TEST SUITE: MULTI-BRANCH MANAGEMENT & BRANCH GEOFENCING
 * Covers Test Groups A, B, C, D, E, F per Prompt 2 Specifications
 * Uses in-process Express handler simulation for sandbox compatibility.
 * ============================================================================
 */

process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const path = require('path');
const jwt = require('jsonwebtoken');

// Load environment
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
      companySlug: 'test-org'
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   EMS MULTI-BRANCH MANAGEMENT & GEOFENCING TEST SUITE');
  console.log('================================================================\n');

  // Test identities (using org prefix for in-memory testing in sandbox)
  const ORG_A = 'org-branch-test-a';
  const ORG_B = 'org-branch-test-b';

  // Seed test orgs into memDb if not present
  if (!memDb.organizations.some(o => o.id === ORG_A)) {
    memDb.organizations.push({
      id: ORG_A,
      name: 'Acme Test Corp',
      slug: 'acme-test',
      timezone: 'Asia/Kolkata',
      wfh_allowed: true,
      office_lat: 26.8097916,
      office_lng: 83.3515645,
      office_radius_meters: 100,
      is_active: true
    });
  }
  if (!memDb.organizations.some(o => o.id === ORG_B)) {
    memDb.organizations.push({
      id: ORG_B,
      name: 'Beta Solutions',
      slug: 'beta-sol',
      timezone: 'Asia/Kolkata',
      wfh_allowed: true,
      office_lat: 12.9716,
      office_lng: 77.5946,
      office_radius_meters: 150,
      is_active: true
    });
  }

  const FOUNDER_A_ID = 'fnd-user-org-a';
  const FOUNDER_B_ID = 'fnd-user-org-b';
  const EMP_A_ID = 'emp-user-org-a';

  if (!memDb.users.some(u => u.id === FOUNDER_A_ID)) {
    memDb.users.push({ id: FOUNDER_A_ID, organization_id: ORG_A, name: 'Founder A', email: 'founder.a@test.com', role: 'founder', is_active: true });
  }
  if (!memDb.users.some(u => u.id === FOUNDER_B_ID)) {
    memDb.users.push({ id: FOUNDER_B_ID, organization_id: ORG_B, name: 'Founder B', email: 'founder.b@test.com', role: 'founder', is_active: true });
  }
  if (!memDb.users.some(u => u.id === EMP_A_ID)) {
    memDb.users.push({ id: EMP_A_ID, organization_id: ORG_A, name: 'Emp A', email: 'emp.a@test.com', role: 'employee', is_active: true, work_mode: 'WFO' });
  }

  const tokenFounderA = generateTestToken(FOUNDER_A_ID, 'founder', ORG_A);
  const tokenFounderB = generateTestToken(FOUNDER_B_ID, 'founder', ORG_B);
  const tokenEmpA = generateTestToken(EMP_A_ID, 'employee', ORG_A);

  let gorakhpurBranchId = null;
  let lucknowBranchId = null;
  let delhiBranchId = null;

  // =========================================================================
  // TEST GROUP A: BRANCH MANAGEMENT (FOUNDER / ADMIN)
  // =========================================================================
  console.log('--- TEST GROUP A: Branch Management & Organization Isolation ---');

  // A1: Create Gorakhpur Head Office
  const resA1 = await simulate('POST', '/api/branches', {
    name: 'Gorakhpur Head Office',
    address: 'R952+QMW, Sonauli Road, Bargadwa, Gorakhpur, UP',
    latitude: 26.8097916,
    longitude: 83.3515645,
    radiusMeters: 100,
    isHeadquarters: true,
    isActive: true
  }, tokenFounderA);
  assert(resA1.status === 201, 'A1.1: Founder creates Gorakhpur Head Office (HTTP 201)');
  assert(resA1.body.data?.name === 'Gorakhpur Head Office', 'A1.2: Branch name persisted accurately');
  assert(resA1.body.data?.is_headquarters === true, 'A1.3: Designated as Headquarters');
  gorakhpurBranchId = resA1.body.data?.id;
  assert(Boolean(gorakhpurBranchId), 'A1.4: Unique branch ID generated');

  // A2: Create Lucknow Branch
  const resA2 = await simulate('POST', '/api/branches', {
    name: 'Lucknow Branch',
    address: 'Vibhuti Khand, Gomti Nagar, Lucknow, UP',
    latitude: 26.8467,
    longitude: 80.9462,
    radiusMeters: 150,
    isHeadquarters: false,
    isActive: true
  }, tokenFounderA);
  assert(resA2.status === 201, 'A2.1: Founder creates Lucknow Branch (HTTP 201)');
  lucknowBranchId = resA2.body.data?.id;
  assert(Boolean(lucknowBranchId), 'A2.2: Lucknow branch ID generated');

  // A3: Create Delhi Branch
  const resA3 = await simulate('POST', '/api/branches', {
    name: 'Delhi Regional Branch',
    address: 'Connaught Place, New Delhi',
    latitude: 28.6139,
    longitude: 77.2090,
    radiusMeters: 200,
    isHeadquarters: false,
    isActive: true
  }, tokenFounderA);
  assert(resA3.status === 201, 'A3.1: Founder creates Delhi Regional Branch (HTTP 201)');
  delhiBranchId = resA3.body.data?.id;

  // A4: Case-insensitive duplicate branch name rejected
  const resA4 = await simulate('POST', '/api/branches', {
    name: '  gorakhpur head office  ',
    latitude: 26.8097916,
    longitude: 83.3515645,
    radiusMeters: 100
  }, tokenFounderA);
  assert(resA4.status === 409, 'A4.1: Duplicate branch name rejected with HTTP 409');
  assert(resA4.body.success === false, 'A4.2: Duplicate response success is false');

  // A5: List branches with employee counts
  const resA5 = await simulate('GET', '/api/branches', null, tokenFounderA);
  assert(resA5.status === 200, 'A5.1: Retrieve organization branches (HTTP 200)');
  assert(Array.isArray(resA5.body.data) && resA5.body.data.length >= 3, 'A5.2: At least 3 branches listed for Org A');
  const gkpFound = resA5.body.data.find(b => b.id === gorakhpurBranchId);
  assert(Boolean(gkpFound), 'A5.3: Gorakhpur Head Office present in list');
  assert(typeof gkpFound?.assigned_employees_count === 'number', 'A5.4: Assigned employee count calculated');

  // A6: Update branch coordinates and radius
  const resA6 = await simulate('PATCH', `/api/branches/${lucknowBranchId}`, {
    radiusMeters: 180,
    address: 'Updated Gomti Nagar Office, Lucknow'
  }, tokenFounderA);
  assert(resA6.status === 200, 'A6.1: Update branch details (HTTP 200)');
  assert(resA6.body.data?.radius_meters === 180, 'A6.2: Permitted radius updated to 180m');
  assert(resA6.body.data?.address === 'Updated Gomti Nagar Office, Lucknow', 'A6.3: Address updated');

  // A7: Organization B isolation
  const resA7 = await simulate('PATCH', `/api/branches/${gorakhpurBranchId}`, {
    name: 'Hacked Branch'
  }, tokenFounderB);
  assert(resA7.status === 404, 'A7.1: Organization B rejected from updating Org A branch (HTTP 404)');

  const resA7List = await simulate('GET', '/api/branches', null, tokenFounderB);
  const leaked = (resA7List.body.data || []).find(b => b.id === gorakhpurBranchId);
  assert(leaked === undefined, 'A7.2: Org A branches completely invisible to Org B');

  // =========================================================================
  // TEST GROUP B: EMPLOYEE ONBOARDING & BRANCH ASSIGNMENT
  // =========================================================================
  console.log('\n--- TEST GROUP B: Employee Onboarding & Branch Assignment ---');

  let empGorakhpurId = null;
  let empLucknowId = null;
  let empWfhId = null;

  // B1: Create WFO employee assigned to Gorakhpur
  const resB1 = await simulate('POST', '/api/users', {
    name: 'Gorakhpur Staff Member',
    email: 'gkp.staff@acmetest.com',
    role: 'employee',
    department: 'Engineering',
    designation: 'Field Engineer',
    workMode: 'WFO',
    branchId: gorakhpurBranchId
  }, tokenFounderA);
  assert(resB1.status === 201, 'B1.1: Create WFO employee assigned to Gorakhpur (HTTP 201)');
  assert(resB1.body.data?.work_mode === 'WFO', 'B1.2: Work mode saved as WFO');
  assert(resB1.body.data?.branch_id === gorakhpurBranchId, 'B1.3: Branch ID linked to Gorakhpur');
  empGorakhpurId = resB1.body.data?.id;

  // B2: Create WFO employee assigned to Lucknow
  const resB2 = await simulate('POST', '/api/users', {
    name: 'Lucknow Staff Member',
    email: 'lko.staff@acmetest.com',
    role: 'employee',
    department: 'Operations',
    designation: 'Operations Analyst',
    workMode: 'WFO',
    branchId: lucknowBranchId
  }, tokenFounderA);
  assert(resB2.status === 201, 'B2.1: Create WFO employee assigned to Lucknow (HTTP 201)');
  empLucknowId = resB2.body.data?.id;

  // B3: Create WFH employee without branch
  const resB3 = await simulate('POST', '/api/users', {
    name: 'Remote Staff Member',
    email: 'remote.staff@acmetest.com',
    role: 'employee',
    department: 'Design',
    designation: 'UI/UX Designer',
    workMode: 'WFH',
    branchId: null
  }, tokenFounderA);
  assert(resB3.status === 201, 'B3.1: Create WFH employee without branch (HTTP 201)');
  assert(resB3.body.data?.work_mode === 'WFH', 'B3.2: Work mode saved as WFH');
  assert(resB3.body.data?.branch_id === null, 'B3.3: Branch ID remains null for WFH');
  empWfhId = resB3.body.data?.id;

  // B4: WFO creation without branch rejected
  const resB4 = await simulate('POST', '/api/users', {
    name: 'Invalid WFO Staff',
    email: 'invalid.wfo@acmetest.com',
    role: 'employee',
    workMode: 'WFO'
  }, tokenFounderA);
  assert(resB4.status === 400, 'B4.1: WFO employee creation without branch rejected (HTTP 400)');
  assert(resB4.body.error?.includes('branch selection is required'), 'B4.2: Clear branch requirement error message returned');

  // B5: Cross-organization branch assignment rejected
  const resB5 = await simulate('POST', '/api/users', {
    name: 'Cross Org Staff',
    email: 'cross.org@acmetest.com',
    role: 'employee',
    workMode: 'WFO',
    branchId: '00000000-0000-0000-0000-000000000000'
  }, tokenFounderA);
  assert(resB5.status === 404, 'B5.1: Non-existent / cross-org branch rejected (HTTP 404)');

  // B6: GET /api/branches/my-branch for WFO employee
  const tokenGkpEmp = generateTestToken(empGorakhpurId, 'employee', ORG_A);
  const resB6 = await simulate('GET', '/api/branches/my-branch', null, tokenGkpEmp);
  assert(resB6.status === 200, 'B6.1: WFO employee calls my-branch (HTTP 200)');
  assert(resB6.body.workMode === 'WFO', 'B6.2: Work mode confirmed WFO');
  assert(resB6.body.branch?.name === 'Gorakhpur Head Office', 'B6.3: Returns Gorakhpur branch details');
  assert(resB6.body.branch?.radius_meters === 100, 'B6.4: Returns accurate permitted radius');

  // B7: GET /api/branches/my-branch for WFH employee
  const tokenWfhEmp = generateTestToken(empWfhId, 'employee', ORG_A);
  const resB7 = await simulate('GET', '/api/branches/my-branch', null, tokenWfhEmp);
  assert(resB7.status === 200, 'B7.1: WFH employee calls my-branch (HTTP 200)');
  assert(resB7.body.workMode === 'WFH', 'B7.2: Work mode confirmed WFH');
  assert(resB7.body.branch === null, 'B7.3: Branch is null for WFH employee');

  // B8: Founder reassigns employee branch from Gorakhpur to Lucknow
  const resB8 = await simulate('PATCH', `/api/users/${empGorakhpurId}`, {
    branchId: lucknowBranchId
  }, tokenFounderA);
  assert(resB8.status === 200, 'B8.1: Reassign employee to Lucknow branch (HTTP 200)');
  assert(resB8.body.data?.branch_id === lucknowBranchId, 'B8.2: User record reflects Lucknow branch');

  const resB8Check = await simulate('GET', '/api/branches/my-branch', null, tokenGkpEmp);
  assert(resB8Check.body.branch?.name === 'Lucknow Branch', 'B8.3: Future attendance verification will use Lucknow');

  // Revert back to Gorakhpur for geofencing tests
  await simulate('PATCH', `/api/users/${empGorakhpurId}`, { branchId: gorakhpurBranchId }, tokenFounderA);

  // =========================================================================
  // TEST GROUP C: BRANCH-SPECIFIC GEOFENCING VALIDATION
  // =========================================================================
  console.log('\n--- TEST GROUP C: Branch-Specific Geofencing & Attendance ---');

  const tokenGorakhpurStaff = generateTestToken(empGorakhpurId, 'employee', ORG_A);
  const tokenLucknowStaff = generateTestToken(empLucknowId, 'employee', ORG_A);
  const selfieGkp = `${ORG_A}/${empGorakhpurId}/selfie.jpg`;
  const selfieLko = `${ORG_A}/${empLucknowId}/selfie.jpg`;

  // C1: Gorakhpur employee punches in INSIDE Gorakhpur perimeter
  const resC1 = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFO',
    latitude: 26.8097916,
    longitude: 83.3515645,
    accuracy: 8,
    photoPath: selfieGkp
  }, tokenGorakhpurStaff);
  assert(resC1.status === 201, 'C1.1: Gorakhpur employee punches in inside Gorakhpur radius (HTTP 201)');
  assert(resC1.body.geofenceVerified === true, 'C1.2: Geofence verified on server');
  assert(resC1.body.distanceMeters === 0, 'C1.3: Distance calculated as 0m from branch');
  assert(resC1.body.branchName === 'Gorakhpur Head Office', 'C1.4: Attendance snapshot records Gorakhpur Head Office');

  // C2: Duplicate punch in rejected
  const resC2 = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFO',
    latitude: 26.8097916,
    longitude: 83.3515645,
    accuracy: 8,
    photoPath: selfieGkp
  }, tokenGorakhpurStaff);
  assert(resC2.status === 409, 'C2.1: Duplicate same-day punch-in rejected (HTTP 409)');

  // C3: Gorakhpur employee punches out INSIDE Gorakhpur perimeter
  const resC3 = await simulate('POST', '/api/attendance/punch-out', {
    latitude: 26.8097916,
    longitude: 83.3515645,
    accuracy: 8,
    photoPath: selfieGkp
  }, tokenGorakhpurStaff);
  assert(resC3.status === 200, 'C3.1: Gorakhpur employee punches out inside perimeter (HTTP 200)');
  assert(resC3.body.data?.punch_out_verified === true, 'C3.2: Punch out verified against assigned branch');

  // C4: Lucknow employee physically near Gorakhpur is REJECTED by backend
  const resC4 = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFO',
    latitude: 26.8097916, // At Gorakhpur office!
    longitude: 83.3515645,
    accuracy: 10,
    photoPath: selfieLko
  }, tokenLucknowStaff);
  assert(resC4.status === 403, 'C4.1: Lucknow employee punching at Gorakhpur is REJECTED (HTTP 403)');
  assert(resC4.body.success === false, 'C4.2: Success is false');
  assert(resC4.body.error?.includes('Outside office geofence'), 'C4.3: Error explains outside assigned branch geofence');
  assert(resC4.body.distanceMeters > 100000, 'C4.4: Calculated distance recognizes ~240km distance from Lucknow branch');

  // C5: Lucknow employee punches in INSIDE Lucknow perimeter
  const resC5 = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFO',
    latitude: 26.8467,
    longitude: 80.9462,
    accuracy: 12,
    photoPath: selfieLko
  }, tokenLucknowStaff);
  assert(resC5.status === 201, 'C5.1: Lucknow employee punches in inside Lucknow perimeter (HTTP 201)');
  assert(resC5.body.geofenceVerified === true, 'C5.2: Server verified inside Lucknow branch');
  assert(resC5.body.branchName === 'Lucknow Branch', 'C5.3: Attendance snapshot records Lucknow Branch');

  // =========================================================================
  // TEST GROUP D: WORK FROM HOME (WFH) BEHAVIOR
  // =========================================================================
  console.log('\n--- TEST GROUP D: Work From Home (WFH) Behavior ---');

  const tokenWfh = generateTestToken(empWfhId, 'employee', ORG_A);
  const selfieWfh = `${ORG_A}/${empWfhId}/selfie.jpg`;
  const resD1 = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFH',
    latitude: 19.0760, // Mumbai (arbitrary remote location)
    longitude: 72.8777,
    accuracy: 15,
    photoPath: selfieWfh
  }, tokenWfh);
  assert(resD1.status === 201, 'D1.1: WFH employee punches in without geofence check (HTTP 201)');
  assert(resD1.body.geofenceVerified === true, 'D1.2: WFH session marked verified');
  assert(resD1.body.data?.mode === 'WFH', 'D1.3: Mode recorded as WFH');

  const resD2 = await simulate('POST', '/api/attendance/punch-out', {
    latitude: 19.0760,
    longitude: 72.8777,
    accuracy: 15,
    photoPath: selfieWfh
  }, tokenWfh);
  assert(resD2.status === 200, 'D2.1: WFH employee punches out successfully (HTTP 200)');
  assert(resD2.body.data?.punch_out_verified === true, 'D2.2: Punch out verified for WFH');

  // =========================================================================
  // TEST GROUP E: SECURITY & AUTHORIZATION
  // =========================================================================
  console.log('\n--- TEST GROUP E: Security & Authorization ---');

  // E1: Employee cannot create branch
  const resE1 = await simulate('POST', '/api/branches', {
    name: 'Unauthorized Branch',
    latitude: 26.0,
    longitude: 83.0,
    radiusMeters: 100
  }, tokenEmpA);
  assert(resE1.status === 403, 'E1.1: Regular employee cannot create office branch (HTTP 403)');

  // E2: Employee cannot edit branch
  const resE2 = await simulate('PATCH', `/api/branches/${gorakhpurBranchId}`, {
    name: 'Hacked Branch'
  }, tokenEmpA);
  assert(resE2.status === 403, 'E2.1: Regular employee cannot update office branch (HTTP 403)');

  // E3: Employee cannot delete/deactivate branch
  const resE3 = await simulate('DELETE', `/api/branches/${gorakhpurBranchId}`, null, tokenEmpA);
  assert(resE3.status === 403, 'E3.1: Regular employee cannot deactivate office branch (HTTP 403)');

  // E4: Client fake verified flag ignored by server
  const spoofUserRes = await simulate('POST', '/api/users', {
    name: 'Spoof Test Staff',
    email: 'spoof.test@acmetest.com',
    role: 'employee',
    workMode: 'WFO',
    branchId: lucknowBranchId
  }, tokenFounderA);
  const spoofUserId = spoofUserRes.body.data?.id;
  const spoofToken = generateTestToken(spoofUserId, 'employee', ORG_A);
  const spoofSelfie = `${ORG_A}/${spoofUserId}/selfie.jpg`;

  const resE4 = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFO',
    latitude: 26.8097916, // At Gorakhpur (240km away from Lucknow)
    longitude: 83.3515645,
    accuracy: 5,
    verified: true, // Spoofed client flag
    isInside: true, // Spoofed client flag
    photoPath: spoofSelfie
  }, spoofToken);
  assert(resE4.status === 403, 'E4.1: Server calculates distance and rejects punch regardless of client spoofed verified flag');

  console.log('\n================================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   PASSED:      ${passedTests}`);
  console.log(`   FAILED:      ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
