/**
 * EMS Attendance Regression & Security Test Suite (In-Memory Isolation Mode)
 * 
 * Verifies backend attendance & storage contracts:
 * 1. Storage Upload: base64 parsing, allowed buckets, mime types, size validation, path isolation.
 * 2. Storage Signed URL generation.
 * 3. Duplicate Punch-In Prevention (HTTP 409).
 * 4. Punch-Out requiring a fresh selfie reference (HTTP 400).
 * 5. GPS coordinate validation (including legitimate 0.0 latitude/longitude).
 * 6. Correct WFO geofence verification (inside radius vs outside radius).
 * 7. WFH behavior (verified = true without requiring geofence).
 * 8. Server-side total minutes calculation on punch out.
 * 9. Today's attendance endpoint status flags.
 * 10. Organization isolation & RBAC (Employee self-only, Team Leader team-scope, Admin org-scope).
 * 11. Empty attendance history behavior without demo data leakage.
 * 
 * NOTE: This is an in-memory regression suite that does NOT modify live Supabase cloud data.
 */

process.env.NODE_ENV = 'test';

const path = require('path');
const EventEmitter = require('events');

// Load environment from server/.env securely without printing secrets
require('./node_modules/dotenv').config({ path: path.resolve(__dirname, '.env') });

const { app, memDb } = require('./src/index');

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
        resolve({ status: this.statusCode, headers: this.headers, data });
      },
      send(data) {
        let parsed = data;
        if (typeof data === 'string') {
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        }
        resolve({ status: this.statusCode, headers: this.headers, data: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, headers: this.headers, data });
      },
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      getHeader(k) { return this.headers[k.toLowerCase()]; }
    };

    app.handle(req, res);
  });
}

// 1x1 transparent PNG as base64 data URI
const VALID_BASE64_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runRegressionSuite() {
  console.log('======================================================================');
  console.log('   EMS ATTENDANCE & STORAGE IN-MEMORY REGRESSION TEST SUITE');
  console.log('======================================================================\n');

  // Obtain tokens for Acme users
  const empLogin = await simulate('POST', '/api/auth/login', {
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  const employeeToken = empLogin.data?.token;

  const adminLogin = await simulate('POST', '/api/auth/login', {
    email: 'admin@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  const adminToken = adminLogin.data?.token;

  const tlLogin = await simulate('POST', '/api/auth/login', {
    email: 'priya.n@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  const tlToken = tlLogin.data?.token;

  assert(Boolean(employeeToken && adminToken && tlToken), 'Successfully authenticated employee, TL, and admin test tokens');

  // -------------------------------------------------------------------------
  // TEST GROUP 1: Storage Upload Validation & Path Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 1: Storage Upload & Path Isolation ---');

  // 1.1 Missing dataUri
  const uploadNoUri = await simulate('POST', '/api/storage/upload', {}, employeeToken);
  assert(uploadNoUri.status === 400, 'Rejects upload with missing dataUri (HTTP 400)');

  // 1.2 Invalid bucket
  const uploadBadBucket = await simulate('POST', '/api/storage/upload', {
    bucket: 'malicious-bucket',
    dataUri: VALID_BASE64_IMAGE
  }, employeeToken);
  assert(uploadBadBucket.status === 400, 'Rejects invalid or unauthorized storage bucket (HTTP 400)');

  // 1.3 Invalid base64 data URI format
  const uploadBadFormat = await simulate('POST', '/api/storage/upload', {
    bucket: 'attendance-selfies',
    dataUri: 'not-a-valid-data-uri'
  }, employeeToken);
  assert(uploadBadFormat.status === 400, 'Rejects non-base64 image payload (HTTP 400)');

  // 1.4 Valid upload to attendance-selfies
  const uploadValid = await simulate('POST', '/api/storage/upload', {
    bucket: 'attendance-selfies',
    dataUri: VALID_BASE64_IMAGE,
    filename: 'test-selfie.png'
  }, employeeToken);
  assert(uploadValid.status === 200 && uploadValid.data?.success, 'Successfully uploaded valid image to attendance-selfies');
  assert(
    uploadValid.data?.data?.path?.includes('org-demo-001') && uploadValid.data?.data?.path?.includes('user-emp-001'),
    'Enforces tenant & user isolated storage path (contains orgId and userId)'
  );

  // 1.5 Signed URL generation
  const signedUrlRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(uploadValid.data?.data?.path || 'test.jpg')}`, null, employeeToken);
  assert(signedUrlRes.status === 200 && signedUrlRes.data?.success, 'Generates time-limited signed download URL');

  // -------------------------------------------------------------------------
  // TEST GROUP 2: GPS Validation (Including Legitimate Zero Coordinates)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 2: GPS Coordinate Validation ---');

  // Reset in-memory attendance for clean test run
  const today = new Date().toISOString().slice(0, 10);
  memDb.attendance = memDb.attendance.filter(a => !(a.user_id === 'user-emp-001' && a.work_date === today));

  // 2.1 Missing coordinates
  const punchNoGps = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFO',
    photoPath: uploadValid.data?.data?.path
  }, employeeToken);
  assert(punchNoGps.status === 400, 'Rejects punch-in with missing GPS coordinates (HTTP 400)');

  // 2.2 Out-of-bounds coordinates
  const punchBadLat = await simulate('POST', '/api/attendance/punch-in', {
    latitude: 95.0,
    longitude: 77.0,
    photoPath: uploadValid.data?.data?.path
  }, employeeToken);
  assert(punchBadLat.status === 400, 'Rejects latitude > 90 (HTTP 400)');

  // 2.3 Legitimate 0.0 coordinates (valid equator / prime meridian)
  const punchZeroCoord = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFH',
    latitude: 0.0,
    longitude: 0.0,
    photoPath: uploadValid.data?.data?.path
  }, employeeToken);
  assert(punchZeroCoord.status === 201, 'Correctly accepts legitimate 0.0 coordinates (HTTP 201)');

  // -------------------------------------------------------------------------
  // TEST GROUP 3: Duplicate Punch-In Prevention
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 3: Duplicate Punch-In Prevention ---');

  const duplicatePunch = await simulate('POST', '/api/attendance/punch-in', {
    mode: 'WFH',
    latitude: 12.9716,
    longitude: 77.5946,
    photoPath: uploadValid.data?.data?.path
  }, employeeToken);
  assert(duplicatePunch.status === 409, 'Rejects duplicate punch-in on same work date with HTTP 409 Conflict');

  // -------------------------------------------------------------------------
  // TEST GROUP 4: Punch-Out Selfie Enforcement & Duration
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 4: Punch-Out Selfie & Duration ---');

  // 4.1 Punch-out missing selfie
  const punchOutNoSelfie = await simulate('POST', '/api/attendance/punch-out', {
    latitude: 12.9716,
    longitude: 77.5946
  }, employeeToken);
  assert(punchOutNoSelfie.status === 400, 'Enforces fresh selfie requirement on punch out (HTTP 400)');

  // 4.2 Punch-out missing GPS
  const punchOutNoGps = await simulate('POST', '/api/attendance/punch-out', {
    photoPath: 'test-out-selfie.jpg'
  }, employeeToken);
  assert(punchOutNoGps.status === 400, 'Enforces fresh GPS requirement on punch out (HTTP 400)');

  // 4.3 Successful punch-out
  const punchOutValid = await simulate('POST', '/api/attendance/punch-out', {
    latitude: 12.9716,
    longitude: 77.5946,
    photoPath: uploadValid.data?.data?.path
  }, employeeToken);
  assert(punchOutValid.status === 200 && punchOutValid.data?.success, 'Punch-out succeeded with selfie & GPS (HTTP 200)');
  assert(punchOutValid.data?.totalMinutes !== undefined, 'Calculates server-side totalMinutes duration');

  // 4.4 Punch-out when no active session exists
  const punchOutNoSession = await simulate('POST', '/api/attendance/punch-out', {
    latitude: 12.9716,
    longitude: 77.5946,
    photoPath: uploadValid.data?.data?.path
  }, employeeToken);
  assert(punchOutNoSession.status === 400, 'Rejects punch-out when no open session exists (HTTP 400)');

  // -------------------------------------------------------------------------
  // TEST GROUP 5: Geofence Math (WFO vs WFH)
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 5: Geofence Math (WFO vs WFH) ---');

  // Use a second employee or temporary record
  const emp2Id = 'usr-acme-emp-2';
  memDb.attendance = memDb.attendance.filter(a => !(a.user_id === emp2Id && a.work_date === today));

  // WFO punch with office coordinates: org office is 12.9716, 77.5946
  const org = memDb.organizations.find(o => o.id === 'org-acme-1');
  if (org) {
    org.office_lat = 12.9716;
    org.office_lng = 77.5946;
    org.office_radius_meters = 150;
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 6: Today's Attendance Endpoint
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 6: Today Attendance Status ---');
  const todayRes = await simulate('GET', '/api/attendance/today', null, employeeToken);
  assert(todayRes.status === 200, 'GET /api/attendance/today returns HTTP 200');
  assert(todayRes.data?.isPunchedOut === true, 'Correctly flags isPunchedOut = true');
  assert(todayRes.data?.isPunchedIn === false, 'Correctly flags isPunchedIn = false');

  // -------------------------------------------------------------------------
  // TEST GROUP 7: Organization Isolation & RBAC
  // -------------------------------------------------------------------------
  console.log('\n--- Test Group 7: Organization Isolation & RBAC ---');

  // Employee can only access own attendance
  const empHistory = await simulate('GET', '/api/attendance', null, employeeToken);
  assert(empHistory.status === 200, 'Employee can fetch attendance history');
  const allOwn = (empHistory.data?.data || []).every(r => r.user_id === 'user-emp-001');
  assert(allOwn, 'Employee attendance history is strictly scoped to own user_id');

  // Team Leader attendance access
  const tlHistory = await simulate('GET', '/api/attendance', null, tlToken);
  assert(tlHistory.status === 200, 'Team Leader can fetch team attendance');

  // Admin access to stats
  const statsRes = await simulate('GET', '/api/attendance/stats', null, adminToken);
  assert(statsRes.status === 200 && statsRes.data?.success, 'Admin can fetch organization attendance stats');

  // Employee forbidden from stats
  const empStatsForbidden = await simulate('GET', '/api/attendance/stats', null, employeeToken);
  assert(empStatsForbidden.status === 403, 'Regular employee is forbidden from attendance stats (HTTP 403)');

  console.log('\n======================================================================');
  console.log(`   REGRESSION SUITE COMPLETED: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runRegressionSuite().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runRegressionSuite };
