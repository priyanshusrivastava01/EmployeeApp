/**
 * Automated Verification: Founder Employee Creation & Employee Login Flow
 * Tests:
 * 1. Founder login
 * 2. Founder creates employee with password -> 201 Created with generated Employee ID
 * 3. Employee logs in using Employee ID + password -> 200 OK
 * 4. Employee logs in using Email + password -> 200 OK
 * 5. Employee login with incorrect password -> 401 Unauthorized
 * 6. Employee attempting Management portal -> 403 Forbidden with portal guidance
 * 7. Founder creates employee without password -> 201 with auto-generated secure password
 * 8. Employee logs in with auto-generated password -> 200 OK
 * 9. Duplicate email rejection -> 409 Conflict
 * 10. Deactivated employee login rejection -> 403 Forbidden
 */

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const EventEmitter = require('events');
const { app, memDb } = require('./src/index');

function request(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    const parsedUrl = new URL(path, 'http://localhost');
    req.method = method.toUpperCase();
    req.url = path;
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
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
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
  console.log('======================================================================');
  console.log('  EMS FOUNDER EMPLOYEE CREATION & EMPLOYEE LOGIN FLOW TESTS');
  console.log('======================================================================\n');

  // Step 1: Founder Login
  const founderLoginRes = await request('POST', '/api/auth/login', {
    email: 'admin@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  assert(founderLoginRes.status === 200 && founderLoginRes.body.token, '1. Founder logs in to Management portal (HTTP 200)');
  const founderToken = founderLoginRes.body.token;
  const founderOrg = founderLoginRes.body.organization;

  // Step 2: Founder creates employee with specified password
  const newEmpPayload = {
    name: 'Kavita Patel',
    email: 'kavita.patel@acmetech.com',
    role: 'employee',
    department: 'Design & UX',
    designation: 'Senior Product Designer',
    phone: '+91 98765 43299',
    password: 'KavitaPassword@123'
  };

  const createRes = await request('POST', '/api/users', newEmpPayload, founderToken);
  assert(createRes.status === 201 && createRes.body.success, '2. Founder creates employee record (HTTP 201 Created)');
  assert(createRes.body.credentials && createRes.body.credentials.employeeId, '   Credentials include generated employee ID');
  assert(createRes.body.credentials.employeeId.startsWith('EMP-'), `   Generated Employee ID has EMP- prefix: ${createRes.body.credentials?.employeeId}`);
  assert(createRes.body.credentials.password === 'KavitaPassword@123', '   Credentials include provided password for sharing');
  assert(createRes.body.credentials.companyId === founderOrg.companyId, '   Credentials include company ID');

  const generatedEmpId = createRes.body.credentials.employeeId;
  const createdUserId = createRes.body.data.id;

  // Step 3: Employee logs in using Employee ID and password
  const empIdLoginRes = await request('POST', '/api/auth/login', {
    employeeId: generatedEmpId,
    password: 'KavitaPassword@123',
    portal: 'employee'
  });
  assert(empIdLoginRes.status === 200 && empIdLoginRes.body.success, '3. Employee logs in using generated Employee ID + password (HTTP 200)');
  assert(empIdLoginRes.body.user && empIdLoginRes.body.user.role === 'employee', '   Employee account has authoritative role "employee"');
  assert(empIdLoginRes.body.user.name === 'Kavita Patel', '   Employee profile name matches Kavita Patel');
  assert(empIdLoginRes.body.organization.id === founderOrg.id, '   Employee belongs to correct organization');
  const employeeToken = empIdLoginRes.body.token;

  // Step 4: Employee logs in using Email and password
  const emailLoginRes = await request('POST', '/api/auth/login', {
    email: 'kavita.patel@acmetech.com',
    password: 'KavitaPassword@123',
    portal: 'employee'
  });
  assert(emailLoginRes.status === 200 && emailLoginRes.body.success, '4. Employee logs in using Email + password (HTTP 200)');

  // Step 5: Employee login with incorrect password rejected
  const wrongPassRes = await request('POST', '/api/auth/login', {
    employeeId: generatedEmpId,
    password: 'WrongPassword999',
    portal: 'employee'
  });
  assert(wrongPassRes.status === 401 && !wrongPassRes.body.success, '5. Incorrect password is rejected with HTTP 401');

  // Step 6: Employee attempting Management portal login rejected with 403
  const wrongPortalRes = await request('POST', '/api/auth/login', {
    employeeId: generatedEmpId,
    password: 'KavitaPassword@123',
    portal: 'management'
  });
  assert(wrongPortalRes.status === 403 && wrongPortalRes.body.code === 'PORTAL_MISMATCH', '6. Employee attempting Management portal rejected with HTTP 403 and PORTAL_MISMATCH');

  // Step 7: Founder creates employee with AUTO-GENERATED password
  const autoPassPayload = {
    name: 'Rohan Verma',
    email: 'rohan.verma@acmetech.com',
    role: 'employee',
    department: 'Engineering',
    designation: 'Backend Developer'
    // password omitted -> should auto-generate
  };
  const createAutoRes = await request('POST', '/api/users', autoPassPayload, founderToken);
  assert(createAutoRes.status === 201 && createAutoRes.body.success, '7. Founder creates employee without password (HTTP 201 Created)');
  assert(createAutoRes.body.credentials.isAutoGenerated === true, '   Auto-generated password flag is true');
  assert(createAutoRes.body.credentials.password.length >= 8, `   Auto-generated password has valid length (>= 8): ${createAutoRes.body.credentials.password}`);
  assert(createAutoRes.body.credentials.employeeId.startsWith('EMP-'), `   Sequential Employee ID generated: ${createAutoRes.body.credentials.employeeId}`);

  const autoEmpId = createAutoRes.body.credentials.employeeId;
  const autoPass = createAutoRes.body.credentials.password;

  // Step 8: Employee logs in with auto-generated credentials
  const autoLoginRes = await request('POST', '/api/auth/login', {
    employeeId: autoEmpId,
    password: autoPass,
    portal: 'employee'
  });
  assert(autoLoginRes.status === 200 && autoLoginRes.body.success, '8. Employee logs in with auto-generated password (HTTP 200)');

  // Step 9: Duplicate email rejected
  const dupEmailRes = await request('POST', '/api/users', {
    name: 'Duplicate Rohan',
    email: 'rohan.verma@acmetech.com',
    role: 'employee'
  }, founderToken);
  assert(dupEmailRes.status === 409, '9. Duplicate email creation rejected with HTTP 409 Conflict');

  // Step 10: Deactivated employee cannot log in
  await request('PATCH', `/api/users/${createdUserId}`, { is_active: false }, founderToken);
  const deactivatedLoginRes = await request('POST', '/api/auth/login', {
    employeeId: generatedEmpId,
    password: 'KavitaPassword@123',
    portal: 'employee'
  });
  assert(deactivatedLoginRes.status === 403 && deactivatedLoginRes.body.error.includes('deactivated'), '10. Deactivated employee login rejected with HTTP 403');

  // Reactivate for hygiene
  await request('PATCH', `/api/users/${createdUserId}`, { is_active: true }, founderToken);

  console.log('\n======================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

