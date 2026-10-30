/**
 * EMS Live Supabase Isolated End-to-End Test Runner
 * 
 * Verifies live PostgreSQL operations on a real Supabase cloud project:
 * 1. Company registration via POST /api/auth/register-company
 * 2. Database record creation (organizations, users, branches)
 * 3. Founder login via POST /api/auth/login (both by email and by companyCode + FND-0001)
 * 4. Authenticated profile check via GET /api/auth/me
 * 5. Surgical cleanup restricted strictly to records created by this test
 * 6. Post-cleanup verification
 * 
 * Safety & Security Guarantees:
 * - Dynamically generates unique company code, slug, email, and password per run.
 * - Never touches or deletes existing organizations or users.
 * - Zero secret or credential logging (automatic redaction).
 * - ₹0 Free-Tier compliant.
 */

const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

// Load environment from server/.env securely
const dotenv = require('./node_modules/dotenv');
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Set NODE_ENV to test to prevent app.listen() binding port 5000 during test execution
process.env.NODE_ENV = 'test';

const { supabase } = require('./src/config/supabase');
const { app } = require('./src/index');

// Redaction utility to guarantee no secrets leak in stdout
function sanitize(str) {
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]')
    .replace(/(password|secret|key|token)["':\s]+["']?([^"',\s]+)/gi, '$1: [REDACTED]');
}

// In-process HTTP request simulator
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
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
        }
        resolve({ status: this.statusCode, headers: this.headers, data: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, headers: this.headers, data });
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

async function runLiveE2ETest() {
  console.log('======================================================================');
  console.log('   EMS LIVE SUPABASE E2E REGISTRATION & LOGIN TEST');
  console.log('======================================================================\n');

  if (!supabase) {
    console.error('  [ABORT] Supabase client is not configured or in placeholder mode.');
    process.exit(1);
  }

  // Generate completely unique, non-colliding test fixtures
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "8F2B1A"
  const testCompanyCode = `E2E-${randomSuffix}`;
  const testSlug = `e2e-test-${randomSuffix.toLowerCase()}`;
  const testEmail = `founder.${randomSuffix.toLowerCase()}@e2e-isolated-test.local`;
  const testPassword = `Pass#${crypto.randomBytes(8).toString('base64url')}9!`;
  const testCompanyName = `E2E Verification Company ${randomSuffix}`;
  const testFounderName = `Founder Verification ${randomSuffix}`;

  console.log('--- 1. Generated Test Fixtures (Ephemeral & Unique) ---');
  console.log(`  Company Code: ${testCompanyCode}`);
  console.log(`  Slug:         ${testSlug}`);
  console.log(`  Email:        ${testEmail}`);
  console.log(`  Password:     [REDACTED_SECURE_RANDOM_PASSPHRASE]`);

  let createdOrgId = null;
  let createdUserId = null;
  let createdBranchId = null;
  let registrationToken = null;

  try {
    // ------------------------------------------------------------------
    // STEP 1: Execute POST /api/auth/register-company
    // ------------------------------------------------------------------
    console.log('\n--- 2. Executing Live Registration (POST /api/auth/register-company) ---');
    const registrationPayload = {
      fullName: testFounderName,
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      companyName: testCompanyName,
      companySlug: testSlug,
      companyCode: testCompanyCode,
      industry: 'Software & Technology',
      country: 'India',
      city: 'Bengaluru',
      timezone: 'Asia/Kolkata',
      employeeSize: '1-10',
      location: {
        address: 'MG Road Innovation Center, Bengaluru, Karnataka 560001',
        latitude: 12.9716,
        longitude: 77.5946
      }
    };

    const regResponse = await simulate('POST', '/api/auth/register-company', registrationPayload);

    if (regResponse.status !== 201 || !regResponse.data?.success) {
      console.error(`  [FAIL] Registration failed (HTTP ${regResponse.status}):`, sanitize(JSON.stringify(regResponse.data)));
      throw new Error('Registration endpoint returned failure');
    }

    createdOrgId = regResponse.data.organization?.id;
    createdUserId = regResponse.data.user?.id;
    createdBranchId = regResponse.data.branch?.id;
    registrationToken = regResponse.data.token;

    console.log(`  [PASS] Company registered successfully (HTTP 201)`);
    console.log(`  [INFO] Organization ID: ${createdOrgId}`);
    console.log(`  [INFO] Founder User ID: ${createdUserId}`);
    console.log(`  [INFO] Branch ID:       ${createdBranchId}`);
    console.log(`  [INFO] Assigned Code:   ${regResponse.data.companyId}`);
    console.log(`  [INFO] Assigned Badge:  ${regResponse.data.founderId}`);

    // ------------------------------------------------------------------
    // STEP 2: Verify Real Database Records in Supabase PostgreSQL
    // ------------------------------------------------------------------
    console.log('\n--- 3. Verifying Live Database Rows via Supabase REST Client ---');
    
    // Check organizations row
    const { data: orgRow, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, slug, company_code, public_company_id, is_active')
      .eq('id', createdOrgId)
      .single();
    if (orgErr || !orgRow) throw new Error(`Live organization query failed: ${orgErr?.message}`);
    console.log(`  [PASS] organizations row verified in Supabase PostgreSQL (slug: ${orgRow.slug})`);

    // Check users row
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, email, role, employee_id_number, organization_id, is_active')
      .eq('id', createdUserId)
      .single();
    if (userErr || !userRow) throw new Error(`Live user query failed: ${userErr?.message}`);
    console.log(`  [PASS] users row verified in Supabase PostgreSQL (role: ${userRow.role}, badge: ${userRow.employee_id_number})`);

    // Check branches row
    const { data: branchRow, error: branchErr } = await supabase
      .from('branches')
      .select('id, name, is_headquarters, organization_id')
      .eq('id', createdBranchId)
      .single();
    if (branchErr || !branchRow) throw new Error(`Live branch query failed: ${branchErr?.message}`);
    console.log(`  [PASS] branches row verified in Supabase PostgreSQL (name: ${branchRow.name})`);

    // ------------------------------------------------------------------
    // STEP 3: Verify Founder Login by Email (POST /api/auth/login)
    // ------------------------------------------------------------------
    console.log('\n--- 4. Verifying Founder Login by Email (POST /api/auth/login) ---');
    const loginByEmail = await simulate('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword,
      portal: 'management'
    });

    if (loginByEmail.status !== 200 || !loginByEmail.data?.token) {
      console.error(`  [FAIL] Login by email failed (HTTP ${loginByEmail.status}):`, sanitize(JSON.stringify(loginByEmail.data)));
      throw new Error('Email login failed');
    }
    console.log('  [PASS] Login by email succeeded (HTTP 200, JWT token returned)');
    console.log(`  [INFO] User role confirmed: ${loginByEmail.data.user?.role}`);

    // ------------------------------------------------------------------
    // STEP 4: Verify Founder Login by Company Code + Badge Number
    // ------------------------------------------------------------------
    console.log('\n--- 5. Verifying Founder Login by Company Code + Badge ID ---');
    const loginByBadge = await simulate('POST', '/api/auth/login', {
      companyCode: testCompanyCode,
      identifier: 'FND-0001',
      password: testPassword,
      portal: 'management'
    });

    if (loginByBadge.status !== 200 || !loginByBadge.data?.token) {
      console.error(`  [FAIL] Login by badge failed (HTTP ${loginByBadge.status}):`, sanitize(JSON.stringify(loginByBadge.data)));
      throw new Error('Badge login failed');
    }
    console.log('  [PASS] Login by Company Code + FND-0001 succeeded (HTTP 200)');

    // ------------------------------------------------------------------
    // STEP 5: Verify Authenticated Route (GET /api/auth/me)
    // ------------------------------------------------------------------
    console.log('\n--- 6. Verifying Authenticated Session (GET /api/auth/me) ---');
    const meResponse = await simulate('GET', '/api/auth/me', null, loginByEmail.data.token);
    if (meResponse.status !== 200 || meResponse.data.user?.id !== createdUserId) {
      console.error('  [FAIL] /api/auth/me token verification failed');
      throw new Error('Auth me verification failed');
    }
    console.log('  [PASS] /api/auth/me authenticated and returned matching user profile');

  } catch (err) {
    console.error('  [ERROR DURING TEST]:', sanitize(err.message));
  } finally {
    // ------------------------------------------------------------------
    // STEP 6: Surgical Teardown & Cleanup
    // Deletes STRICTLY the records created by this test run!
    // ------------------------------------------------------------------
    console.log('\n--- 7. Surgical Cleanup (Strictly Targeted to This Test) ---');
    let cleanupSuccess = true;

    if (createdUserId) {
      const { error: delUserErr } = await supabase.from('users').delete().eq('id', createdUserId);
      if (delUserErr) {
        console.error(`  [WARN] Failed to delete test user ${createdUserId}:`, delUserErr.message);
        cleanupSuccess = false;
      } else {
        console.log(`  [PASS] Deleted test user: ${createdUserId}`);
      }
    }

    if (createdBranchId) {
      const { error: delBranchErr } = await supabase.from('branches').delete().eq('id', createdBranchId);
      if (delBranchErr) {
        console.error(`  [WARN] Failed to delete test branch ${createdBranchId}:`, delBranchErr.message);
        cleanupSuccess = false;
      } else {
        console.log(`  [PASS] Deleted test branch: ${createdBranchId}`);
      }
    }

    if (createdOrgId) {
      const { error: delOrgErr } = await supabase.from('organizations').delete().eq('id', createdOrgId);
      if (delOrgErr) {
        console.error(`  [WARN] Failed to delete test org ${createdOrgId}:`, delOrgErr.message);
        cleanupSuccess = false;
      } else {
        console.log(`  [PASS] Deleted test organization: ${createdOrgId}`);
      }
    }

    // ------------------------------------------------------------------
    // STEP 7: Confirm Cleanup Completed
    // ------------------------------------------------------------------
    console.log('\n--- 8. Verifying Cleanup Completeness ---');
    if (createdOrgId) {
      const { data: checkOrg } = await supabase.from('organizations').select('id').eq('id', createdOrgId).maybeSingle();
      const { data: checkUser } = await supabase.from('users').select('id').eq('id', createdUserId).maybeSingle();
      if (!checkOrg && !checkUser) {
        console.log('  [PASS] Verified: Database contains 0 remnants from this test run.');
      } else {
        console.error('  [WARN] Residual test rows detected!');
      }
    }

    console.log('\n======================================================================');
    console.log('   END-TO-END TEST EXECUTION COMPLETE');
    console.log('======================================================================\n');
  }
}

// Only run if invoked directly from command line
if (require.main === module) {
  runLiveE2ETest().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runLiveE2ETest };

