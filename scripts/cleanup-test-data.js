#!/usr/bin/env node
/**
 * Safe Test Data Cleanup Utility for Interrupted Test Runs
 * Cleans up any leftover staging test organizations and child records.
 * STRICTLY REFUSES to operate against production database.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require(path.resolve(__dirname, '../server/node_modules/@supabase/supabase-js'));

const testEnvPath = path.resolve(__dirname, '../server/.env.test');

const KNOWN_PRODUCTION_HOSTS = [
  'ixxueouqbnkpcakeiekb.supabase.co'
];

const CHILD_TO_PARENT_TABLES = [
  'bank_details',
  'daily_reports',
  'attendance_records',
  'announcements',
  'company_rules',
  'timesheets',
  'leave_requests',
  'users',
  'branches',
  'organizations'
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

async function runCleanup() {
  console.log('===============================================================================');
  console.log('          EMPLOYEEAPP - STAGING TEST DATA CLEANUP UTILITY                      ');
  console.log('===============================================================================');

  if (!fs.existsSync(testEnvPath)) {
    console.log('ℹ️  No server/.env.test found. No staging test data to clean.');
    return;
  }

  const testEnv = parseEnv(testEnvPath);
  const supabaseUrl = testEnv.SUPABASE_URL || '';
  const supabaseKey = testEnv.SUPABASE_SERVICE_ROLE_KEY || '';

  // Strict Production Guard
  const isProduction = KNOWN_PRODUCTION_HOSTS.some(host => supabaseUrl.toLowerCase().includes(host));
  if (isProduction) {
    console.error('\n🚨 [ABORTED] Refusing to run cleanup against PRODUCTION database!');
    console.error(`   Target host matches production: ${supabaseUrl}`);
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project-id')) {
    console.log('ℹ️  server/.env.test contains placeholder credentials. Nothing to clean.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log(`Connecting to staging database: ${supabaseUrl}`);

  // Query only test-generated organizations
  const { data: testOrgs, error } = await supabase
    .from('organizations')
    .select('id, name, company_code')
    .or('company_code.ilike.TEST_STG_%,company_code.ilike.TST_%');

  if (error) {
    console.error('Failed to query test organizations:', error.message);
    return;
  }

  if (!testOrgs || testOrgs.length === 0) {
    console.log('✅ No leftover test organizations found in staging database. Database is clean.');
    return;
  }

  console.log(`Found ${testOrgs.length} test organization(s) to clean:`);

  for (const org of testOrgs) {
    // Extra safety guard
    if (org.company_code === 'VAR001' || org.id === 'a1a162f2-5877-4cc7-a6bd-12176ccd9f93') {
      console.warn(`[SKIP] Safely skipping protected organization ${org.company_code}`);
      continue;
    }

    console.log(`  Cleaning org: ${org.name} (${org.company_code} - ${org.id})...`);
    for (const table of CHILD_TO_PARENT_TABLES) {
      const col = table === 'organizations' ? 'id' : 'organization_id';
      const { error: delErr } = await supabase.from(table).delete().eq(col, org.id);
      if (delErr) {
        console.warn(`    ⚠️  Error deleting from ${table}:`, delErr.message);
      }
    }
  }

  console.log('\n✅ Staging test data cleanup complete.');
  console.log('===============================================================================');
}

runCleanup().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
