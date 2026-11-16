#!/usr/bin/env node
/**
 * Safe Integration Test Runner
 * Enforces pre-flight environment checks before running write-based tests:
 * 1. Confirms server/.env.test exists.
 * 2. Confirms SUPABASE_URL does NOT point to live production.
 * 3. Confirms credentials are not placeholders.
 * 4. Executes Playwright integration suite with NODE_ENV=test.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const testEnvPath = path.resolve(__dirname, '../server/.env.test');

const KNOWN_PRODUCTION_HOSTS = [
  'ixxueouqbnkpcakeiekb.supabase.co'
];

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

console.log('===============================================================================');
console.log('         EMPLOYEEAPP - SAFE STAGING INTEGRATION TEST RUNNER                    ');
console.log('===============================================================================');

// 1. Check if server/.env.test exists
if (!fs.existsSync(testEnvPath)) {
  console.error('\n❌ [PRE-FLIGHT CHECK FAILED] Missing Staging Configuration: server/.env.test');
  console.error('\nProduction Database Protection:');
  console.error('  Integration tests are strictly BLOCKED from running against production.');
  console.error('  Tests require a separate, isolated staging Supabase project.\n');
  console.error('REQUIRED SETUP ACTION:');
  console.error('  1. Create a dedicated staging project on Supabase (https://supabase.com).');
  console.error('  2. Apply migrations (server/src/db/migrations/001_... through 013_...).');
  console.error('  3. Copy server/.env.test.example to server/.env.test:');
  console.error('     copy server\\.env.test.example server\\.env.test');
  console.error('  4. Add your staging project URL & Service Role Key to server/.env.test.');
  console.error('  5. Re-run: npm run test:integration\n');
  console.log('===============================================================================');
  process.exit(1);
}

// 2. Parse server/.env.test
const testEnv = parseEnv(testEnvPath);
const supabaseUrl = testEnv.SUPABASE_URL || '';
const supabaseKey = testEnv.SUPABASE_SERVICE_ROLE_KEY || '';

// 3. Strict Check: Reject if pointing to production
const isProduction = KNOWN_PRODUCTION_HOSTS.some(host =>
  supabaseUrl.toLowerCase().includes(host)
);

if (isProduction) {
  console.error('\n🚨 [CRITICAL SECURITY VIOLATION] server/.env.test points to LIVE PRODUCTION!');
  console.error(`   Detected Host: ${supabaseUrl}`);
  console.error('   Integration tests perform write operations and are strictly forbidden from');
  console.error('   running against the live production database.\n');
  console.error('ACTION REQUIRED:');
  console.error('   Update server/.env.test with your separate staging Supabase credentials.');
  console.log('===============================================================================');
  process.exit(1);
}

// 4. Strict Check: Reject placeholder credentials
const isPlaceholder = (val) => {
  if (!val) return true;
  const l = val.toLowerCase();
  return l.includes('your-project-id') ||
    l.includes('your-staging-project-id') ||
    l.includes('your-supabase-service-role') ||
    l.includes('your-staging-service-role-key') ||
    l.includes('example');
};

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseKey)) {
  console.error('\n⚠️ [PRE-FLIGHT CHECK FAILED] server/.env.test contains placeholder credentials!');
  console.error('   Please replace placeholder values with your real staging project credentials.');
  console.log('===============================================================================');
  process.exit(1);
}

// 5. Pre-flight checks passed: Populate environment & launch Playwright integration tests
for (const k in testEnv) {
  process.env[k] = testEnv[k];
}

console.log('✅ [Pre-Flight Verified] Dedicated Staging Database Configured.');
console.log(`   Target Staging Host: ${supabaseUrl}`);
console.log('   Production database (ixxueouqbnkpcakeiekb.supabase.co) is safely protected.\n');
console.log('Launching Playwright integration test suite...\n');

const extraArgs = process.argv.slice(2);
const testArgs = ['playwright', 'test', 'tests/integration'];
if (!extraArgs.some(a => a.startsWith('--project'))) {
  testArgs.push('--project=chromium');
}
if (!extraArgs.some(a => a.startsWith('--workers'))) {
  testArgs.push('--workers=1');
}
testArgs.push(...extraArgs);

const child = spawn('npx', testArgs, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PLAYWRIGHT_TEST: 'true'
  }
});

child.on('close', (code) => {
  process.exit(code || 0);
});
