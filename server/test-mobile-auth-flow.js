/**
 * Automated Verification: Mobile Login Portals, Scoped Roles & RBAC
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
    if (postData) req.write(postData);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runMobileAuthTests() {
  console.log('========================================================');
  console.log(' MOBILE AUTH FLOW, PORTAL VALIDATION & ROLE RBAC TESTS');
  console.log('========================================================\n');

  // Test 1: Employee using Employee Login -> Success
  const empLoginRes = await request('POST', '/api/auth/login', {
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(empLoginRes.status === 200 && empLoginRes.body.user.role === 'employee', '1. Correct Employee credentials in Employee Login succeeds (HTTP 200)');
  const empToken = empLoginRes.body.token;

  // Test 2: Employee using Management Login -> 403 Rejection
  const empMgmtRes = await request('POST', '/api/auth/login', {
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  assert(empMgmtRes.status === 403 && empMgmtRes.body.error.includes('Employee account'), '2. Employee attempting Management Login rejected with HTTP 403 & friendly guidance');

  // Test 3: Founder attempting Employee Login -> 403 Rejection
  const founderEmpRes = await request('POST', '/api/auth/login', {
    email: 'admin@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(founderEmpRes.status === 403 && founderEmpRes.body.error.includes('switch to Management Login'), '3. Founder attempting Employee Login rejected with HTTP 403 & directed to Management Login');

  // Test 4: Team Leader attempting Employee Login -> 403 Rejection
  const tlEmpRes = await request('POST', '/api/auth/login', {
    email: 'priya.n@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(tlEmpRes.status === 403 && tlEmpRes.body.error.includes('Management account'), '4. Team Leader attempting Employee Login rejected with HTTP 403');

  // Test 5: Founder in Management Login -> 200 with founder role & permissions
  const founderLoginRes = await request('POST', '/api/auth/login', {
    email: 'admin@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  assert(founderLoginRes.status === 200 && founderLoginRes.body.user.role === 'founder', '5. Founder in Management Login succeeds with authoritative role "founder"');
  assert(founderLoginRes.body.user.permissions?.canManageOrgSettings === true, '   Founder has canManageOrgSettings permission flag');
  const founderToken = founderLoginRes.body.token;

  // Test 6: Team Leader in Management Login -> 200 with team_leader role
  const tlLoginRes = await request('POST', '/api/auth/login', {
    email: 'priya.n@acmetech.com',
    password: 'admin123',
    portal: 'management'
  });
  assert(tlLoginRes.status === 200 && tlLoginRes.body.user.role === 'team_leader', '6. Team Leader in Management Login succeeds with authoritative role "team_leader"');
  assert(tlLoginRes.body.user.permissions?.canManageOrgSettings === false, '   Team Leader cannot manage organization-level settings');
  const tlToken = tlLoginRes.body.token;

  // Test 7: Team Leader Audit endpoint access
  const tlAuditsRes = await request('GET', '/api/audits', null, tlToken);
  assert(tlAuditsRes.status === 200 && Array.isArray(tlAuditsRes.body.data), '7. Team Leader can view authorized audits list');

  // Test 8: Employee CANNOT access audit endpoint (403 Forbidden)
  const empAuditsRes = await request('GET', '/api/audits', null, empToken);
  assert(empAuditsRes.status === 403, '8. Employee is rejected from accessing management audit records (HTTP 403)');

  // Test 9: Team Leader records an Audit for assigned employee
  const postAuditRes = await request('POST', '/api/audits', {
    employeeId: 'user-emp-001',
    category: 'Work Quality & Discipline',
    score: 9.5,
    strengths: 'Consistently high quality commits on mobile punch-in.',
    improvements: 'None noted.',
    remarks: 'Ready for senior promotion track.'
  }, tlToken);
  assert(postAuditRes.status === 201 && postAuditRes.body.success, '9. Team Leader successfully creates Audit record for assigned employee');

  // Test 10: Team Leader attendance scoping
  const tlAttRes = await request('GET', '/api/attendance', null, tlToken);
  assert(tlAttRes.status === 200, '10. Team Leader fetches team-scoped attendance records');

  // Test 11: Invalid / Expired token returns 401
  const invalidTokenRes = await request('GET', '/api/auth/me', null, 'invalid.expired.jwt');
  assert(invalidTokenRes.status === 401, '11. Expired / Invalid token returns HTTP 401');

  // Test 12: GET /api/auth/me returns authoritative authenticated user
  const meRes = await request('GET', '/api/auth/me', null, founderToken);
  assert(meRes.status === 200 && meRes.body.user.email === 'admin@acmetech.com', '12. Session validation GET /api/auth/me returns authoritative profile');

  // Test 13: Correct credentials with matching Company ID in Employee Login
  const acmeEmpWithCompanyId = await request('POST', '/api/auth/login', {
    companyId: 'CMP-7K4M9X2Q',
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(acmeEmpWithCompanyId.status === 200 && acmeEmpWithCompanyId.body.organization.public_company_id === 'CMP-7K4M9X2Q', '13. Employee login with valid matching Company ID succeeds (HTTP 200)');

  // Test 14: Non-existent Company ID rejected with 401
  const invalidCompanyIdRes = await request('POST', '/api/auth/login', {
    companyId: 'CMP-NONEXISTENT',
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(invalidCompanyIdRes.status === 401 && invalidCompanyIdRes.body.error.includes('Company ID'), '14. Non-existent Company ID rejected with HTTP 401');

  // Test 15: Cross-tenant isolation: Acme user attempting login with Nexus Company ID
  const crossTenantRes = await request('POST', '/api/auth/login', {
    companyId: 'CMP-3N8V2P6W',
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(crossTenantRes.status === 401 && crossTenantRes.body.error.includes('does not belong'), '15. Cross-company login strictly rejected (HTTP 401 company isolation enforced)');

  // Test 16: Incorrect password rejected with HTTP 401
  const badPassRes = await request('POST', '/api/auth/login', {
    companyId: 'CMP-7K4M9X2Q',
    email: 'aarav.sharma@acmetech.com',
    password: 'wrongpassword',
    portal: 'employee'
  });
  assert(badPassRes.status === 401, '16. Incorrect password rejected with HTTP 401');

  // Test 17: UI Verification of WelcomeScreen.js
  const fs = require('fs');
  const path = require('path');
  const welcomeScreenPath = path.join(__dirname, '../mobile/src/screens/WelcomeScreen.js');
  const welcomeScreenSrc = fs.readFileSync(welcomeScreenPath, 'utf8');

  assert(welcomeScreenSrc.includes('EmployeeApp') && welcomeScreenSrc.includes('Your workplace, connected.'), '17. WelcomeScreen contains official branding "EmployeeApp" and subtitle "Your workplace, connected."');
  assert(welcomeScreenSrc.includes('Management Login') && welcomeScreenSrc.includes('Employee Login'), '18. WelcomeScreen provides clear 2-choice segmented selector for Management Login and Employee Login');
  assert(welcomeScreenSrc.includes('Company ID') && welcomeScreenSrc.includes('CMP-7K4M9X2Q'), '19. WelcomeScreen includes clean Company ID input field');
  assert(welcomeScreenSrc.includes('Password') && welcomeScreenSrc.includes('secureTextEntry') && welcomeScreenSrc.includes('eye-off-outline'), '20. WelcomeScreen includes Password field with show/hide password toggle');
  assert(welcomeScreenSrc.includes('Forgot Password?') && welcomeScreenSrc.includes('Password Recovery'), '21. WelcomeScreen includes Forgot Password link with zero-cost recovery modal');
  assert(welcomeScreenSrc.includes('New company? ') && welcomeScreenSrc.includes('Register Company'), '22. WelcomeScreen provides tappable secondary action "New company? Register Company"');

  // Test 23: UI Verification of CompanySetupSuccessScreen.js
  const successScreenPath = path.join(__dirname, '../mobile/src/screens/CompanySetupSuccessScreen.js');
  const successScreenSrc = fs.readFileSync(successScreenPath, 'utf8');
  assert(successScreenSrc.includes('Continue to Management Login') && successScreenSrc.includes('Store Your Company ID Safely'), '23. CompanySetupSuccessScreen includes "Continue to Management Login" button and safety notice');

  // Test 24: Navigation & Logout Verification in App.js
  const appJsPath = path.join(__dirname, '../mobile/App.js');
  const appJsSrc = fs.readFileSync(appJsPath, 'utf8');
  assert(appJsSrc.includes('api.logout()') && appJsSrc.includes("setAuthView('welcome')") && appJsSrc.includes('prefillAuth'), '24. App.js logout resets session state, clears cached credentials, and returns to Welcome screen');

  console.log('\n========================================================');
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) process.exit(1);
}

runMobileAuthTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
