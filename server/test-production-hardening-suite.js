/**
 * Comprehensive Production Hardening & Regression Test Suite
 * Validates:
 * 1. Fatal startup error in production if Supabase credentials are missing/placeholder
 * 2. Strict isolation of memDb when Supabase is connected
 * 3. Health & Readiness endpoints contract
 * 4. Auth login strictly rejects demo fallback when DB mode is active
 * 5. Mobile API configuration and Render cold-start timeouts
 * 6. Keep-alive workflow syntax and target URL
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runProductionHardeningSuite() {
  console.log('\n============================================================');
  console.log('EMS PRODUCTION HARDENING & REGRESSION TEST SUITE');
  console.log('============================================================\n');

  // Test 1: Production guard against missing Supabase credentials
  console.log('[Test 1] Testing production fatal error when Supabase credentials missing...');
  const { execSync } = require('child_process');
  let threwExpectedError = false;
  try {
    // Run node inline with NODE_ENV=production and empty credentials
    execSync('node -e "process.env.NODE_ENV=\'production\'; process.env.SUPABASE_URL=\'\'; process.env.SUPABASE_SERVICE_ROLE_KEY=\'\'; require(\'./server/src/config/supabase\');"', { stdio: 'pipe' });
  } catch (err) {
    const output = (err.stderr || err.stdout || '').toString();
    if (output.includes('[FATAL PRODUCTION ERROR] Missing mandatory database credentials')) {
      threwExpectedError = true;
    } else {
      console.error('Unexpected error output:', output);
    }
  }
  assert.strictEqual(threwExpectedError, true, 'Server must fail startup in production if Supabase credentials missing');
  console.log('✓ PASS: Production strictly blocks silent in-memory fallback on missing credentials.');

  // Test 2: In-memory fallback allowed only in development
  console.log('\n[Test 2] Testing in-memory fallback permitted in development...');
  let devFallbackWorks = false;
  try {
    const devOutput = execSync('node -e "process.env.NODE_ENV=\'development\'; process.env.SUPABASE_URL=\'\'; process.env.SUPABASE_SERVICE_ROLE_KEY=\'\'; const { supabase } = require(\'./server/src/config/supabase\'); console.log(\'SUPABASE_CLIENT:\', supabase);"', { stdio: 'pipe' }).toString();
    if (devOutput.includes('SUPABASE_CLIENT: null')) {
      devFallbackWorks = true;
    }
  } catch (err) {
    console.error('Dev fallback test error:', err.message);
  }
  assert.strictEqual(devFallbackWorks, true, 'Development must allow null supabase client for offline work');
  console.log('✓ PASS: Development offline fallback permitted safely without throwing.');

  // Test 3: Health Endpoint Contract (with DB connected)
  console.log('\n[Test 3] Testing /api/health endpoint in database mode...');
  // Force load with server/.env
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
  const { app } = require('./src/index');

  function simulate(method, url, headers = {}, body = null) {
    const EventEmitter = require('events');
    return new Promise((resolve) => {
      const req = new EventEmitter();
      req.method = method.toUpperCase();
      req.url = url;
      req.headers = { 'content-type': 'application/json', accept: 'application/json', ...headers };
      req.body = body || {};
      req.socket = { remoteAddress: '127.0.0.1' };
      req.ip = '127.0.0.1';
      req.connection = req.socket;

      const res = {
        statusCode: 200,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ status: this.statusCode, body: data }); },
        send(data) {
          let parsed = data;
          if (typeof data === 'string') {
            try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
          }
          resolve({ status: this.statusCode, body: parsed });
        },
        end(data) { resolve({ status: this.statusCode, body: data }); },
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        getHeader(k) { return this.headers[k.toLowerCase()]; }
      };

      app.handle(req, res);
    });
  }

  const healthRes = await simulate('GET', '/api/health');
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthRes.body.status, 'ok');
  assert.strictEqual(healthRes.body.database, 'supabase_connected');
  assert.strictEqual(healthRes.body.isPersistentStorage, true);
  assert.strictEqual(healthRes.body.organizations, undefined, 'Must not return memDb organization counts');
  assert.strictEqual(healthRes.body.users, undefined, 'Must not return memDb user counts');
  console.log('✓ PASS: /api/health returns authoritative database status without leaking memDb counts.');

  // Test 4: Database Readiness Endpoint (/api/ready)
  console.log('\n[Test 4] Testing /api/ready readiness check...');
  const readyRes = await simulate('GET', '/api/ready');
  assert.strictEqual(readyRes.status, 200);
  assert.strictEqual(readyRes.body.status, 'ready');
  assert.strictEqual(readyRes.body.database, 'postgresql_connected');
  console.log('✓ PASS: /api/ready verified real PostgreSQL connectivity.');

  // Test 5: Rejection of demo credentials when database is active
  console.log('\n[Test 5] Testing auth login rejection of demo account when DB is active...');
  // Attempt login with demo user 'admin@acmetech.com / admin123' which does not exist in real Supabase
  const demoLoginRes = await simulate('POST', '/api/auth/login', {}, {
    email: 'admin@acmetech.com',
    password: 'admin123'
  });
  // Must reject with 401 and NOT authenticate via memDb
  assert.strictEqual(demoLoginRes.status, 401);
  assert.strictEqual(demoLoginRes.body.success, false);
  assert.strictEqual(demoLoginRes.body.token, undefined);
  console.log('✓ PASS: Demo credentials strictly rejected; no fall-through to memDb in database mode.');

  // Test 6: Mobile API Configuration
  console.log('\n[Test 6] Testing mobile API configuration & cold-start timeout handling...');
  const mobileEnvPath = path.resolve(__dirname, '../mobile/.env');
  assert(fs.existsSync(mobileEnvPath), 'mobile/.env must exist');
  const mobileEnvContent = fs.readFileSync(mobileEnvPath, 'utf8');
  assert(mobileEnvContent.includes('EXPO_PUBLIC_API_URL=https://employeeapp-5u4l.onrender.com'), 'Must target deployed Render URL');

  const mobileApiSrc = fs.readFileSync(path.resolve(__dirname, '../mobile/src/services/api.js'), 'utf8');
  assert(mobileApiSrc.includes('onrender.com'), 'Must have specific Render handling');
  assert(mobileApiSrc.includes('35000'), 'Must include 35s cold-start timeout for Render');
  console.log('✓ PASS: Mobile configuration targets production Render backend with cold-start timeout allowance.');

  // Test 7: GitHub Actions Keep-Alive Workflow
  console.log('\n[Test 7] Testing GitHub Actions Keep-Alive workflow...');
  const workflowPath = path.resolve(__dirname, '../.github/workflows/render-keep-alive.yml');
  assert(fs.existsSync(workflowPath), 'Workflow file must exist');
  const workflowContent = fs.readFileSync(workflowPath, 'utf8');
  assert(workflowContent.includes("cron: '*/10 * * * *'"), 'Must have 10-minute cron');
  assert(workflowContent.includes('https://employeeapp-5u4l.onrender.com'), 'Must target production EMS URL');
  assert(workflowContent.includes('/api/health'), 'Must target /api/health');
  console.log('✓ PASS: Keep-alive workflow is valid and targets EMS Render service.');

  console.log('\n============================================================');
  console.log('ALL 7 PRODUCTION HARDENING TESTS PASSED (0 FAILURES)');
  console.log('============================================================\n');

  const { server } = require('./src/index');
  if (server) {
    server.close();
  }
  process.exit(0);
}

runProductionHardeningSuite().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
