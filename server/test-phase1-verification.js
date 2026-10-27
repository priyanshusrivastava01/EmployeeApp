/**
 * Direct Unit Tests for Company Verification and Registration Handlers
 * Uses supertest pattern / direct mock requests without TCP networking
 */

process.env.NODE_ENV = 'test';
const { app } = require('./src/index');

async function runDirectTests() {
  console.log('=== RUNNING PHASE 1 IN-PROCESS VERIFICATION SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Helper to make simulated requests through Express app
  function simulateRequest(method, url, body = {}) {
    return new Promise((resolve) => {
      const EventEmitter = require('events');
      const req = new EventEmitter();
      req.method = method;
      req.url = url;
      req.headers = { 'content-type': 'application/json' };
      req.body = body;
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
        setHeader(k, v) {
          this.headers[k] = v;
        },
        getHeader(k) {
          return this.headers[k];
        }
      };

      app.handle(req, res);
    });
  }

  // Test 1: Health check
  console.log('\n--- 1. Health Endpoint ---');
  const healthRes = await simulateRequest('GET', '/api/health');
  assert(healthRes.status === 200, 'Health endpoint returns HTTP 200');
  assert(healthRes.body.status === 'ok', 'Health endpoint returns status: "ok"');

  // Test 2: Check Code Availability - Valid code (Available)
  console.log('\n--- 2. Company Code Availability ---');
  const availRes = await simulateRequest('POST', '/api/companies/check-code-availability', {
    companyCode: 'NEWCORP99'
  });
  assert(availRes.status === 200, 'Code availability returns HTTP 200');
  assert(availRes.body.available === true, 'NEWCORP99 is reported as available');

  // Test 3: Check Code Availability - Existing code (Taken)
  const takenRes = await simulateRequest('POST', '/api/companies/check-code-availability', {
    companyCode: 'CMP-7K4M9X2Q' // Demo Acme code
  });
  assert(takenRes.status === 200, 'Existing code check returns HTTP 200');
  assert(takenRes.body.available === false, 'CMP-7K4M9X2Q is reported as taken');

  // Test 4: Check Code Availability - Invalid formats
  const emptyRes = await simulateRequest('POST', '/api/companies/check-code-availability', {
    companyCode: ''
  });
  assert(emptyRes.status === 400, 'Empty code returns HTTP 400');

  const shortRes = await simulateRequest('POST', '/api/companies/check-code-availability', {
    companyCode: 'AB'
  });
  assert(shortRes.status === 400, 'Short code (< 3 chars) returns HTTP 400');

  // Test 5: Verify Company Code - Existing Company
  console.log('\n--- 3. Verify Company Code ---');
  const verifyValidRes = await simulateRequest('POST', '/api/companies/verify-code', {
    companyCode: 'CMP-7K4M9X2Q'
  });
  assert(verifyValidRes.status === 200, 'Verifying existing company returns HTTP 200');
  assert(verifyValidRes.body.success === true, 'Verification returns success: true');
  assert(verifyValidRes.body.company.name === 'Acme Technologies Pvt. Ltd.', 'Returns correct company name');
  assert(verifyValidRes.body.company.id !== undefined, 'Returns company ID');
  assert(!verifyValidRes.body.company.password_hash, 'Does not expose password hash');

  // Test 6: Verify Company Code - Unknown Company
  const verifyUnknownRes = await simulateRequest('POST', '/api/companies/verify-code', {
    companyCode: 'NONEXISTENT999'
  });
  assert(verifyUnknownRes.status === 404, 'Unknown company code returns HTTP 404');
  assert(verifyUnknownRes.body.success === false, 'Returns success: false');

  // Test 7: Verify Company Code - Empty Code
  const verifyEmptyRes = await simulateRequest('POST', '/api/companies/verify-code', {
    companyCode: ''
  });
  assert(verifyEmptyRes.status === 400, 'Empty verification code returns HTTP 400');

  // Test 8: Register Company with User-Chosen Code & Location & Initial Branch
  console.log('\n--- 4. Register Company with Code & Branch ---');
  const uniqueCode = 'TESTCORP' + Math.floor(Math.random() * 900 + 100);
  const regRes = await simulateRequest('POST', '/api/auth/register-company', {
    fullName: 'Anil Kumar',
    email: `anil.${Date.now()}@testcorp.com`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    companyName: 'Test Corp Innovations',
    companyCode: uniqueCode,
    companySlug: `test-corp-${Date.now()}`,
    location: {
      address: 'Plot 42, Cyber City, Gurugram, Haryana',
      latitude: 28.4950,
      longitude: 77.0895
    }
  });

  assert(regRes.status === 201, 'Registration returns HTTP 201 Created');
  assert(regRes.body.success === true, 'Registration returns success: true');
  assert(regRes.body.companyId !== undefined, 'Registration returns public companyId');
  assert(regRes.body.organization.company_code === uniqueCode, 'Organization preserves user-chosen company_code');
  assert(regRes.body.branch !== undefined, 'Registration returns initial branch record');
  assert(regRes.body.branch.name === 'Head Office', 'Initial branch named "Head Office"');
  assert(regRes.body.branch.latitude === 28.4950, 'Branch stores latitude');
  assert(regRes.body.branch.longitude === 77.0895, 'Branch stores longitude');

  // Test 9: Register with Duplicate Company Code
  console.log('\n--- 5. Duplicate Code Rejection ---');
  const dupRes = await simulateRequest('POST', '/api/auth/register-company', {
    fullName: 'Another Founder',
    email: `founder2.${Date.now()}@testcorp.com`,
    password: 'Password123!',
    confirmPassword: 'Password123!',
    companyName: 'Duplicate Corp',
    companyCode: uniqueCode, // Reusing existing code!
    companySlug: `dup-corp-${Date.now()}`
  });
  assert(dupRes.status === 409, 'Duplicate company code rejected with HTTP 409 Conflict');
  assert(dupRes.body.success === false, 'Duplicate registration returns success: false');

  // Test 10: Verify the newly registered company code works!
  console.log('\n--- 6. Verify Newly Registered Company ---');
  const verifyNewRes = await simulateRequest('POST', '/api/companies/verify-code', {
    companyCode: uniqueCode
  });
  assert(verifyNewRes.status === 200, 'Newly registered code is verifiable via /api/companies/verify-code');
  assert(verifyNewRes.body.company.name === 'Test Corp Innovations', 'Returns newly registered company name');

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runDirectTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
