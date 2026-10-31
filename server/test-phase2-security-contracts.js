/**
 * Phase 2 Backend Attendance & Storage Security Contract Tests
 * 
 * Verifies Phase 2 security enforcement:
 * 1. Storage Signed URL: Cross-organization rejection (HTTP 403).
 * 2. Storage Signed URL: Cross-employee rejection for regular employees (HTTP 403).
 * 3. Storage Signed URL: Team leader denied access to unassigned member's files (HTTP 403).
 * 4. Storage Signed URL: Team leader permitted access to assigned team member's files (HTTP 200).
 * 5. Storage Signed URL: Path traversal / malformed paths rejected (HTTP 400).
 * 6. Storage Signed URL: Unauthorized bucket names rejected (HTTP 400).
 * 7. Attendance Punch-In: Rejects spoofed selfie path belonging to another user (HTTP 403).
 * 8. Attendance Punch-In: Rejects external URLs (HTTP 400).
 * 9. Attendance Punch-In: Rejects local file:// URIs (HTTP 400).
 * 10. Attendance Punch-In: Rejects dummy filename without user prefix (HTTP 400).
 * 11. Attendance Punch-Out: Rejects spoofed selfie path belonging to another user (HTTP 403).
 * 12. Attendance Punch-Out: Rejects external URLs and file:// URIs (HTTP 400).
 * 
 * NOTE: Simulated in-memory test suite. Does not mutate live Supabase cloud data.
 */

process.env.NODE_ENV = 'test';
// Force in-memory mode for isolated contract unit tests
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const path = require('path');
const EventEmitter = require('events');

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

async function runSecuritySuite() {
  console.log('======================================================================');
  console.log('   EMS PHASE 2 ATTENDANCE & STORAGE SECURITY CONTRACT TEST SUITE      ');
  console.log('======================================================================\n');

  // Obtain tokens for tests:
  // 1. Employee 1 (Aarav Sharma in org-acme-1, TL is Priya Nambiar)
  const emp1Login = await simulate('POST', '/api/auth/login', {
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  const emp1Token = emp1Login.data?.token;
  const emp1Id = emp1Login.data?.user?.id;
  const org1Id = emp1Login.data?.organization?.id;

  // 2. Employee 2 (Karan Verma in org-acme-1, unassigned or different team)
  const emp2Login = await simulate('POST', '/api/auth/login', {
    email: 'karan.v@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  const emp2Token = emp2Login.data?.token;
  const emp2Id = emp2Login.data?.user?.id;

  // 3. Team Leader (Priya Nambiar in org-acme-1, team leader of Aarav Sharma)
  const tlLogin = await simulate('POST', '/api/auth/login', {
    email: 'priya.n@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  const tlToken = tlLogin.data?.token;
  const tlId = tlLogin.data?.user?.id;

  // 4. Admin (Admin in org-acme-1)
  const adminLogin = await simulate('POST', '/api/auth/login', {
    email: 'admin@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  const adminToken = adminLogin.data?.token;

  assert(Boolean(emp1Token && emp2Token && tlToken && adminToken), 'Successfully authenticated test users across roles');

  const VALID_BASE64_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // Upload a valid test image for Employee 1 to test authorized retrieval
  const uploadEmp1 = await simulate('POST', '/api/storage/upload', {
    bucket: 'attendance-selfies',
    dataUri: VALID_BASE64_IMAGE,
    filename: 'security-test.png'
  }, emp1Token);
  const ownPath = uploadEmp1.data?.data?.path;
  assert(Boolean(ownPath && ownPath.includes(emp1Id)), 'Successfully uploaded isolated test selfie for Employee 1');

  console.log('\n--- Section 1: Storage Signed URL Tenant & Role Isolation ---');
  {
    // Test 1.1: Employee accessing their own selfie -> 200
    const ownRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(ownPath)}`, null, emp1Token);
    assert(ownRes.status === 200 && ownRes.data?.success, `Employee can access their own private selfie (HTTP 200)`);

    // Test 1.2: Employee 1 accessing Employee 2's selfie -> 403
    const emp2Path = `${org1Id}/${emp2Id}/1730000000-selfie.jpg`;
    const crossEmpRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(emp2Path)}`, null, emp1Token);
    assert(crossEmpRes.status === 403, `Employee A cannot access Employee B's private selfie (HTTP 403)`);

    // Test 1.3: Cross-organization access attempt -> 403
    const foreignOrgPath = `org-foreign-999/${emp1Id}/1730000000-selfie.jpg`;
    const crossOrgRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(foreignOrgPath)}`, null, emp1Token);
    assert(crossOrgRes.status === 403, `Access to a different organization's path is denied (HTTP 403)`);

    // Test 1.4: Team Leader accessing assigned member's file -> 200
    const tlAssignedRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(ownPath)}`, null, tlToken);
    assert(tlAssignedRes.status === 200 && tlAssignedRes.data?.success, `Team Leader can access assigned team member's selfie (HTTP 200)`);

    // Test 1.5: Team Leader accessing unassigned employee's file -> 403
    const tlUnassignedRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(emp2Path)}`, null, tlToken);
    assert(tlUnassignedRes.status === 403, `Team Leader cannot access unassigned employee's selfie (HTTP 403)`);

    // Test 1.6: Admin accessing any org employee's file -> 200
    const adminRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(ownPath)}`, null, adminToken);
    assert(adminRes.status === 200 && adminRes.data?.success, `Admin can access any employee's selfie in their organization (HTTP 200)`);

    // Test 1.7: Path traversal attempt (..) -> 400
    const traversalPath = `${org1Id}/${emp1Id}/../../secret.env`;
    const traversalRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(traversalPath)}`, null, emp1Token);
    assert(traversalRes.status === 400, `Path traversal attempt (..) is rejected (HTTP 400)`);

    // Test 1.8: Unauthorized bucket name -> 400
    const badBucketRes = await simulate('GET', `/api/storage/signed-url?bucket=system-internal-secrets&filePath=${encodeURIComponent(ownPath)}`, null, emp1Token);
    assert(badBucketRes.status === 400, `Unapproved storage bucket is rejected (HTTP 400)`);
  }

  console.log('\n--- Section 2: Attendance Selfie Ownership Validation ---');
  {
    // Clean previous attendance records for emp1 today to test clean punch
    const today = new Date().toISOString().slice(0, 10);
    memDb.attendance = memDb.attendance.filter(a => !(a.user_id === emp1Id && a.work_date === today));

    // Test 2.1: Punch-in with valid own selfie path -> 201
    const validSelfie = `${org1Id}/${emp1Id}/punch-in-${Date.now()}.jpg`;
    const validPunchIn = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: validSelfie
    }, emp1Token);
    assert(validPunchIn.status === 201, `Punch-in succeeds with valid own storage path (HTTP 201)`);

    // Reset today's attendance for further rejection tests
    memDb.attendance = memDb.attendance.filter(a => !(a.user_id === emp1Id && a.work_date === today));

    // Test 2.2: Punch-in with another user's selfie path -> 403
    const spoofedSelfie = `${org1Id}/${emp2Id}/punch-in-${Date.now()}.jpg`;
    const spoofedPunchIn = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: spoofedSelfie
    }, emp1Token);
    assert(spoofedPunchIn.status === 403, `Punch-in with another user's selfie path is rejected (HTTP 403)`);

    // Test 2.3: Punch-in with another organization's selfie path -> 403
    const foreignOrgSelfie = `org-foreign-123/${emp1Id}/punch-in.jpg`;
    const foreignPunchIn = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: foreignOrgSelfie
    }, emp1Token);
    assert(foreignPunchIn.status === 403, `Punch-in with foreign organization selfie path is rejected (HTTP 403)`);

    // Test 2.4: Punch-in with external URL -> 400
    const urlPunchIn = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: 'https://evil.com/fake-selfie.jpg'
    }, emp1Token);
    assert(urlPunchIn.status === 400, `Punch-in with external URL is rejected (HTTP 400)`);

    // Test 2.5: Punch-in with local device file:// URI -> 400
    const fileUriPunchIn = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: 'file:///data/user/0/cache/camera.jpg'
    }, emp1Token);
    assert(fileUriPunchIn.status === 400, `Punch-in with local file:// URI is rejected (HTTP 400)`);

    // Test 2.6: Punch-in with dummy filename without user prefix -> 400
    const dummyPunchIn = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: 'attendance-selfie.jpg'
    }, emp1Token);
    assert(dummyPunchIn.status === 400, `Punch-in with dummy filename without org/user prefix is rejected (HTTP 400)`);

    // Now punch in legitimately so we can test punch-out
    await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFH',
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: validSelfie
    }, emp1Token);

    // Test 2.7: Punch-out with another user's selfie path -> 403
    const spoofedPunchOut = await simulate('POST', '/api/attendance/punch-out', {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: spoofedSelfie
    }, emp1Token);
    assert(spoofedPunchOut.status === 403, `Punch-out with another user's selfie path is rejected (HTTP 403)`);

    // Test 2.8: Punch-out with local file:// URI -> 400
    const fileUriPunchOut = await simulate('POST', '/api/attendance/punch-out', {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: 'file:///data/user/0/cache/camera-out.jpg'
    }, emp1Token);
    assert(fileUriPunchOut.status === 400, `Punch-out with local file:// URI is rejected (HTTP 400)`);

    // Test 2.9: Legitimate punch-out with own selfie path -> 200
    const validOutSelfie = `${org1Id}/${emp1Id}/punch-out-${Date.now()}.jpg`;
    const validPunchOut = await simulate('POST', '/api/attendance/punch-out', {
      latitude: 12.9716,
      longitude: 77.5946,
      accuracy: 10,
      photoPath: validOutSelfie
    }, emp1Token);
    assert(validPunchOut.status === 200, `Punch-out succeeds with valid own storage path (HTTP 200)`);
  }

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch(err => {
  console.error('[Security Test Suite Unexpected Error]', err);
  process.exit(1);
});
