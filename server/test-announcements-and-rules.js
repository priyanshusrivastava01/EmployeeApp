/**
 * Test Suite: Company Announcements & Company Rules/Policies End-to-End
 * Covers: Authentication, Role-Based Access Control, Organization Isolation,
 * Validation, Multiparagraph Preservation, Persistence, and Error Handling.
 */

process.env.NODE_ENV = 'test';
const assert = require('assert');
const jwt = require('jsonwebtoken');
const { app, memDb } = require('./src/index');

const JWT_SECRET = process.env.JWT_SECRET || 'ems-super-secret-jwt-key-2026-production';

function simulate(method, url, body = null, token = null) {
  return new Promise((resolve) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers['authorization'] = `Bearer ${token}`;

    const req = {
      method,
      url,
      headers,
      body: body || {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      get(headerName) {
        return this.headers[headerName.toLowerCase()];
      }
    };

    if (url.includes('?')) {
      const parts = url.split('?');
      req.url = parts[0];
      const searchParams = new URLSearchParams(parts[1]);
      for (const [k, v] of searchParams.entries()) {
        req.query[k] = v;
      }
    }

    let statusCode = 200;
    const resHeaders = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      setHeader(name, value) {
        resHeaders[name.toLowerCase()] = value;
        return this;
      },
      header(name, value) {
        return this.setHeader(name, value);
      },
      json(data) {
        resolve({ status: statusCode, headers: resHeaders, body: data });
      },
      send(data) {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: statusCode, headers: resHeaders, body: parsed });
      },
      end() {
        resolve({ status: statusCode, headers: resHeaders, body: null });
      },
      getHeader(k) {
        return resHeaders[k.toLowerCase()];
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
    organizationSlug: 'test-org'
  }, JWT_SECRET, { expiresIn: '1h' });
}

async function runSuite() {
  console.log('======================================================================');
  console.log('   EMS ANNOUNCEMENTS & COMPANY RULES/POLICIES AUDIT & TEST SUITE      ');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  [PASS] ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${desc}`);
      console.error(`         ${err.message}`);
      failed++;
    }
  }

  // Test Fixtures
  const orgA = 'org-ann-test-a';
  const orgB = 'org-ann-test-b';

  const founderA = {
    id: 'user-founder-a',
    name: 'Rohan Deshmukh (Founder)',
    email: 'rohan@acmetech.com',
    role: 'founder',
    organization_id: orgA,
    is_active: true
  };

  const employeeA = {
    id: 'user-emp-a',
    name: 'Aarav Sharma',
    email: 'aarav@acmetech.com',
    role: 'employee',
    organization_id: orgA,
    is_active: true
  };

  const employeeB = {
    id: 'user-emp-b',
    name: 'Kavita Iyer',
    email: 'kavita@nexus.in',
    role: 'employee',
    organization_id: orgB,
    is_active: true
  };

  memDb.users.push(founderA, employeeA, employeeB);

  const tokenFounderA = makeToken(founderA, orgA);
  const tokenEmployeeA = makeToken(employeeA, orgA);
  const tokenEmployeeB = makeToken(employeeB, orgB);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. ANNOUNCEMENTS MODULE TESTS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Company Announcements Tests ---');

  let announcementAId = null;

  // Test A — Successful creation with Medium priority
  const resA = await simulate('POST', '/api/announcements', {
    title: 'Holiday Notice',
    priority: 'Medium',
    message: 'Tomorrow will be an official office holiday for Diwali.',
    audience: 'all',
    status: 'published'
  }, tokenFounderA);

  test('Test A.1: Founder creates announcement returns HTTP 201', () => {
    assert.strictEqual(resA.status, 201);
    assert.strictEqual(resA.body.success, true);
  });

  test('Test A.2: Announcement bound to Founder organization_id', () => {
    assert.strictEqual(resA.body.data.organization_id, orgA);
  });

  test('Test A.3: Priority preserved correctly as "medium"', () => {
    assert.strictEqual(resA.body.data.priority, 'medium');
  });

  test('Test A.4: Publisher user_id correctly recorded', () => {
    assert.strictEqual(resA.body.data.created_by, founderA.id);
  });

  test('Test A.5: Title and message stored correctly', () => {
    assert.strictEqual(resA.body.data.title, 'Holiday Notice');
    assert.strictEqual(resA.body.data.message, 'Tomorrow will be an official office holiday for Diwali.');
  });

  announcementAId = resA.body.data.id;

  // Test B — Missing title
  const resB = await simulate('POST', '/api/announcements', {
    title: '   ',
    priority: 'high',
    message: 'Message without title'
  }, tokenFounderA);

  test('Test B: Missing or whitespace title rejected with HTTP 400', () => {
    assert.strictEqual(resB.status, 400);
    assert.strictEqual(resB.body.success, false);
    assert(resB.body.error.toLowerCase().includes('title'));
  });

  // Test C — Missing message
  const resC = await simulate('POST', '/api/announcements', {
    title: 'Valid Title',
    priority: 'high',
    message: '   '
  }, tokenFounderA);

  test('Test C: Missing or whitespace message rejected with HTTP 400', () => {
    assert.strictEqual(resC.status, 400);
    assert.strictEqual(resC.body.success, false);
    assert(resC.body.error.toLowerCase().includes('message'));
  });

  // Test D — Invalid priority
  const resD = await simulate('POST', '/api/announcements', {
    title: 'Invalid Priority Test',
    priority: 'SuperUrgentCritical',
    message: 'Testing unsupported priority value'
  }, tokenFounderA);

  test('Test D: Invalid priority rejected with HTTP 400', () => {
    assert.strictEqual(resD.status, 400);
    assert.strictEqual(resD.body.success, false);
    assert(resD.body.error.toLowerCase().includes('priority'));
  });

  // Test E — Unauthorized Employee creation attempt
  const resE = await simulate('POST', '/api/announcements', {
    title: 'Employee Rogue Broadcast',
    priority: 'high',
    message: 'This should not be allowed'
  }, tokenEmployeeA);

  test('Test E: Employee cannot broadcast announcements (HTTP 403 Forbidden)', () => {
    assert.strictEqual(resE.status, 403);
    assert.strictEqual(resE.body.success, false);
  });

  // Test F — Organization isolation
  const resF = await simulate('GET', '/api/announcements', null, tokenEmployeeB);

  test('Test F: Organization B Employee cannot retrieve Organization A announcement', () => {
    assert.strictEqual(resF.status, 200);
    const orgBList = resF.body.data || [];
    const leak = orgBList.find(a => a.id === announcementAId);
    assert.strictEqual(Boolean(leak), false);
  });

  // Test G — Founder list retrieval
  const resG = await simulate('GET', '/api/announcements?all=true', null, tokenFounderA);

  test('Test G: Founder retrieves announcement list with HTTP 200', () => {
    assert.strictEqual(resG.status, 200);
    assert.strictEqual(resG.body.success, true);
    const found = (resG.body.data || []).find(a => a.id === announcementAId);
    assert(Boolean(found), 'Created announcement present in Founder list');
  });

  // Test H — Employee list retrieval (same organization)
  const resH = await simulate('GET', '/api/announcements', null, tokenEmployeeA);

  test('Test H.1: Organization A Employee retrieves announcements with HTTP 200', () => {
    assert.strictEqual(resH.status, 200);
    assert.strictEqual(resH.body.success, true);
  });

  test('Test H.2: Employee sees published announcement from their Founder', () => {
    const found = (resH.body.data || []).find(a => a.id === announcementAId);
    assert(Boolean(found), 'Employee sees published announcement');
    assert.strictEqual(found.title, 'Holiday Notice');
    assert.strictEqual(found.priority, 'medium');
  });

  // Test I — Separate request persistence
  const resI = await simulate('GET', '/api/announcements', null, tokenEmployeeA);

  test('Test I: Previously published announcement persists across subsequent requests', () => {
    assert.strictEqual(resI.status, 200);
    const found = (resI.body.data || []).find(a => a.id === announcementAId);
    assert(Boolean(found), 'Record persists in storage');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. COMPANY RULES & POLICIES MODULE TESTS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Company Rules & Policies Tests ---');

  let ruleAId = null;
  const multiParagraphContent = 
`Section 1: Operating Hours & Core Shift Timing
All employees are expected to be available between 09:30 AM and 06:30 PM IST.
Late marks are automatically calculated after 09:45 AM grace period.

Section 2: Punch In Geofence Guidelines
Mobile selfie attendance must be captured within 150 meters of the primary office premises.
WFH requests must be pre-approved by the Team Leader or Founder.

Section 3: Device Integrity & Security
Workstations must be locked whenever leaving your desk. VPN access is strictly mandatory.`;

  // Test A — Successful policy publication
  const resRuleA = await simulate('POST', '/api/rules', {
    title: 'Daily Attendance & Shift Timing',
    category: 'Attendance',
    body: multiParagraphContent,
    status: 'published'
  }, tokenFounderA);

  test('Test 2.A.1: Founder creates company policy returns HTTP 201', () => {
    assert.strictEqual(resRuleA.status, 201);
    assert.strictEqual(resRuleA.body.success, true);
  });

  test('Test 2.A.2: Policy bound to Founder organization_id', () => {
    assert.strictEqual(resRuleA.body.data.organization_id, orgA);
  });

  test('Test 2.A.3: Category preserved correctly as "Attendance"', () => {
    assert.strictEqual(resRuleA.body.data.category, 'Attendance');
  });

  test('Test 2.A.4: Multiparagraph policy content preserved verbatim', () => {
    assert.strictEqual(resRuleA.body.data.body, multiParagraphContent);
  });

  ruleAId = resRuleA.body.data.id;

  // Test B — Missing title
  const resRuleB = await simulate('POST', '/api/rules', {
    title: '   ',
    category: 'Attendance',
    body: 'Policy body without title'
  }, tokenFounderA);

  test('Test 2.B: Missing or whitespace policy title rejected with HTTP 400', () => {
    assert.strictEqual(resRuleB.status, 400);
    assert.strictEqual(resRuleB.body.success, false);
    assert(resRuleB.body.error.toLowerCase().includes('title'));
  });

  // Test C — Missing content
  const resRuleC = await simulate('POST', '/api/rules', {
    title: 'Valid Policy Title',
    category: 'Attendance',
    body: '   '
  }, tokenFounderA);

  test('Test 2.C: Missing or whitespace policy content rejected with HTTP 400', () => {
    assert.strictEqual(resRuleC.status, 400);
    assert.strictEqual(resRuleC.body.success, false);
    assert(resRuleC.body.error.toLowerCase().includes('content'));
  });

  // Test D — Invalid category
  const resRuleD = await simulate('POST', '/api/rules', {
    title: 'Invalid Category Policy',
    category: 'CryptoTradingRules',
    body: 'Testing unsupported category'
  }, tokenFounderA);

  test('Test 2.D: Invalid category rejected with HTTP 400', () => {
    assert.strictEqual(resRuleD.status, 400);
    assert.strictEqual(resRuleD.body.success, false);
    assert(resRuleD.body.error.toLowerCase().includes('category'));
  });

  // Test E — Unauthorized Employee publication attempt
  const resRuleE = await simulate('POST', '/api/rules', {
    title: 'Employee Unauthorized Policy',
    category: 'Ethics',
    body: 'Employees should not be able to publish policies'
  }, tokenEmployeeA);

  test('Test 2.E: Employee cannot publish company policies (HTTP 403 Forbidden)', () => {
    assert.strictEqual(resRuleE.status, 403);
    assert.strictEqual(resRuleE.body.success, false);
  });

  // Test F — Founder policy listing
  const resRuleF = await simulate('GET', '/api/rules?all=true', null, tokenFounderA);

  test('Test 2.F: Founder retrieves organization policy list with HTTP 200', () => {
    assert.strictEqual(resRuleF.status, 200);
    assert.strictEqual(resRuleF.body.success, true);
    const found = (resRuleF.body.data || []).find(r => r.id === ruleAId);
    assert(Boolean(found), 'Created policy appears in Founder policy list');
  });

  // Test G — Employee policy listing
  const resRuleG = await simulate('GET', '/api/rules', null, tokenEmployeeA);

  test('Test 2.G.1: Organization A Employee retrieves policies with HTTP 200', () => {
    assert.strictEqual(resRuleG.status, 200);
    assert.strictEqual(resRuleG.body.success, true);
  });

  test('Test 2.G.2: Employee sees published policy from Founder', () => {
    const found = (resRuleG.body.data || []).find(r => r.id === ruleAId);
    assert(Boolean(found), 'Policy visible on Employee screen');
    assert.strictEqual(found.title, 'Daily Attendance & Shift Timing');
    assert.strictEqual(found.category, 'Attendance');
  });

  // Test H — Organization isolation
  const resRuleH = await simulate('GET', '/api/rules', null, tokenEmployeeB);

  test('Test 2.H: Organization B Employee cannot access Organization A company rules', () => {
    assert.strictEqual(resRuleH.status, 200);
    const orgBList = resRuleH.body.data || [];
    const leak = orgBList.find(r => r.id === ruleAId);
    assert.strictEqual(Boolean(leak), false);
  });

  // Test I — Content integrity
  const resRuleI = await simulate('GET', `/api/rules`, null, tokenEmployeeA);

  test('Test 2.I: Full multiparagraph content and formatting is preserved across GET', () => {
    const found = (resRuleI.body.data || []).find(r => r.id === ruleAId);
    assert(Boolean(found), 'Rule exists');
    assert(found.summary.includes('Section 1: Operating Hours'), 'Section 1 preserved');
    assert(found.summary.includes('Section 2: Punch In Geofence Guidelines'), 'Section 2 preserved');
    assert(found.summary.includes('Section 3: Device Integrity & Security'), 'Section 3 preserved');
  });

  // Test J — Persistence in separate request
  const resRuleJ = await simulate('GET', '/api/rules', null, tokenFounderA);

  test('Test 2.J: Policy persists reliably across separate request cycles', () => {
    assert.strictEqual(resRuleJ.status, 200);
    const found = (resRuleJ.body.data || []).find(r => r.id === ruleAId);
    assert(Boolean(found), 'Policy persisted in database store');
  });

  // Clean up
  await simulate('DELETE', `/api/announcements/${announcementAId}`, null, tokenFounderA);
  await simulate('DELETE', `/api/rules/${ruleAId}`, null, tokenFounderA);

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal Suite Error:', err);
  process.exit(1);
});
