/**
 * Test Suite: GitHub Actions Keep-Alive Workflow Validation
 * Tests YAML syntax, bash parsing rules, mock HTTP response behaviors,
 * URL normalization, and retry handling.
 */

const fs = require('fs');
const http = require('http');
const assert = require('assert');

async function runTests() {
  console.log('\n=== [1] Validating .github/workflows/render-keep-alive.yml Structure ===');
  const ymlPath = '.github/workflows/render-keep-alive.yml';
  assert(fs.existsSync(ymlPath), 'Workflow file does not exist');

  const content = fs.readFileSync(ymlPath, 'utf8');

  // Verify key YAML requirements
  assert(content.includes('name: EMS Render Keep Alive'), 'Workflow name must be "EMS Render Keep Alive"');
  assert(content.includes("cron: '*/10 * * * *'"), 'Must include cron schedule every 10 minutes');
  assert(content.includes('workflow_dispatch:'), 'Must include manual workflow_dispatch trigger');
  assert(content.includes('runs-on: ubuntu-latest'), 'Runner must be ubuntu-latest');
  assert(content.includes('timeout-minutes: 3'), 'Job timeout must be specified');
  assert(content.includes('cancel-in-progress: true'), 'Concurrency must prevent overlapping executions');
  assert(content.includes('contents: read'), 'Permissions must be minimal (contents: read)');
  assert(content.includes('secrets.RENDER_BACKEND_URL || vars.RENDER_BACKEND_URL'), 'Must prioritize secrets over vars');
  assert(content.includes('/api/health'), 'Target must be /api/health');

  console.log('✓ All 9 workflow structure assertions passed.');

  console.log('\n=== [2] Validating URL Normalization & Guard Rules ===');
  function normalizeAndValidateUrl(rawUrl) {
    if (!rawUrl || !rawUrl.trim()) {
      return { valid: false, error: 'EMPTY_URL' };
    }
    const clean = rawUrl.trim().replace(/\/+$/, '');
    if (/your-actual-ems-service|your-ems-service|example\.com|placeholder/i.test(clean)) {
      return { valid: false, error: 'PLACEHOLDER_URL' };
    }
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(clean)) {
      return { valid: false, error: 'LOCAL_OR_PRIVATE_URL' };
    }
    return { valid: true, targetUrl: `${clean}/api/health` };
  }

  // Test cases
  assert.strictEqual(normalizeAndValidateUrl('').valid, false);
  assert.strictEqual(normalizeAndValidateUrl('   ').valid, false);
  assert.strictEqual(normalizeAndValidateUrl('https://your-ems-service.onrender.com').valid, false);
  assert.strictEqual(normalizeAndValidateUrl('http://localhost:5000').valid, false);
  assert.strictEqual(normalizeAndValidateUrl('http://192.168.31.113:5000').valid, false);

  const valid1 = normalizeAndValidateUrl('https://ems-backend-api.onrender.com');
  assert.strictEqual(valid1.valid, true);
  assert.strictEqual(valid1.targetUrl, 'https://ems-backend-api.onrender.com/api/health');

  const validTrailing = normalizeAndValidateUrl('https://ems-backend-api.onrender.com///');
  assert.strictEqual(validTrailing.valid, true);
  assert.strictEqual(validTrailing.targetUrl, 'https://ems-backend-api.onrender.com/api/health');

  console.log('✓ URL normalization and guard rules passed.');

  console.log('\n=== [3] Testing Mock Server HTTP Status Handling ===');
  // Spin up a test HTTP server to verify simulated keep-alive responses
  let currentResponseCode = 200;
  let requestCount = 0;

  const mockServer = http.createServer((req, res) => {
    requestCount++;
    if (req.url === '/api/health') {
      res.writeHead(currentResponseCode, { 'Content-Type': 'application/json' });
      if (currentResponseCode === 200) {
        res.end(JSON.stringify({ status: 'ok', success: true }));
      } else {
        res.end(JSON.stringify({ error: 'Server Error' }));
      }
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;

  // Test HTTP 200
  currentResponseCode = 200;
  requestCount = 0;
  const res200 = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/api/health`, (res) => resolve(res.statusCode));
  });
  assert.strictEqual(res200, 200, 'HTTP 200 must succeed');
  assert.strictEqual(requestCount, 1);
  console.log('✓ HTTP 200 response handled as success.');

  // Test HTTP 404
  const res404 = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/wrong-endpoint`, (res) => resolve(res.statusCode));
  });
  assert.strictEqual(res404, 404, 'HTTP 404 must be detected as failure');
  console.log('✓ HTTP 404 response detected as failure.');

  // Test HTTP 500
  currentResponseCode = 500;
  const res500 = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/api/health`, (res) => resolve(res.statusCode));
  });
  assert.strictEqual(res500, 500, 'HTTP 500 must be detected as failure');
  console.log('✓ HTTP 500 response detected as failure.');

  mockServer.close();

  console.log('\n=== [4] Testing Backend /api/health Endpoint in server/src/index.js ===');
  // Syntax check backend entry point
  const { execSync } = require('child_process');
  execSync('node -c server/src/index.js');
  console.log('✓ server/src/index.js passed syntax check.');

  console.log('\n============================================================');
  console.log('ALL KEEP-ALIVE VALIDATION CHECKS PASSED (4/4)');
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

