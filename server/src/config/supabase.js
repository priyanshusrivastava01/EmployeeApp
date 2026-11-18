/**
 * Supabase Client Configuration
 * Initializes connection to Supabase PostgreSQL and Storage using service-role credentials.
 * Includes strict environment isolation guards to prevent integration tests from ever
 * running against or modifying the live production database.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Known production Supabase hosts that must NEVER be accessed by tests
const KNOWN_PRODUCTION_HOSTS = [
  'ixxueouqbnkpcakeiekb.supabase.co'
];

const isTestOrStagingEnv = process.env.NODE_ENV === 'test' ||
  process.env.NODE_ENV === 'staging' ||
  process.env.APP_ENV === 'staging' ||
  process.env.PLAYWRIGHT_TEST === 'true';

if (isTestOrStagingEnv) {
  // STRICT GUARD 1: In test/staging mode, ONLY load server/.env.test. NEVER load server/.env!
  const testEnvPath = path.resolve(__dirname, '../../.env.test');
  
  if (!fs.existsSync(testEnvPath)) {
    throw new Error(
      '\n===============================================================================\n' +
      '[FATAL STAGING/TEST SAFETY ERROR] Missing staging configuration: server/.env.test\n' +
      'Staging and test runs must run ONLY against a separate staging Supabase project.\n' +
      'Backend is strictly blocked from connecting to or falling back to production.\n\n' +
      'SETUP ACTION REQUIRED:\n' +
      '  1. Copy server/.env.test.example to server/.env.test\n' +
      '  2. Enter your dedicated staging Supabase URL & Service Role Key in server/.env.test\n' +
      '===============================================================================\n'
    );
  }

  // Clear any existing database env vars before loading test env
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const testConfig = dotenv.parse(fs.readFileSync(testEnvPath));
  for (const k in testConfig) {
    process.env[k] = testConfig[k];
  }
} else {
  // Normal development & production environment loading
  dotenv.config();
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isPlaceholder = (val) => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return lower.includes('your-project-id') ||
    lower.includes('your_project_url') ||
    lower.includes('your-staging-project-id') ||
    lower.includes('your-supabase-service-role') ||
    lower.includes('your-staging-service-role-key') ||
    lower.includes('example');
};

// STRICT GUARD 2: Reject if test or staging environment points to production Supabase URL
if (isTestOrStagingEnv) {
  const isProductionTarget = KNOWN_PRODUCTION_HOSTS.some(host => 
    supabaseUrl && supabaseUrl.toLowerCase().includes(host)
  );

  if (isProductionTarget) {
    throw new Error(
      '\n===============================================================================\n' +
      '[CRITICAL SAFETY VIOLATION] Staging/Test environment attempted to connect to PRODUCTION!\n' +
      `Detected production Supabase host: ${supabaseUrl}\n` +
      'Staging and tests are STRICTLY FORBIDDEN from running against the live production database.\n' +
      'Please update server/.env.test with your separate staging project credentials.\n' +
      '===============================================================================\n'
    );
  }

  if (!supabaseUrl || !supabaseKey || isPlaceholder(supabaseUrl) || isPlaceholder(supabaseKey)) {
    throw new Error(
      '\n===============================================================================\n' +
      '[FATAL STAGING/TEST SAFETY ERROR] Incomplete staging configuration in server/.env.test!\n' +
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured with a real staging project.\n' +
      'Staging and tests cannot run with placeholder credentials.\n' +
      '===============================================================================\n'
    );
  }
}

const hasValidCredentials = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(supabaseKey)
);

// Strict production guard: Never allow production to silently run in volatile in-memory mode
if (process.env.NODE_ENV === 'production' && !hasValidCredentials) {
  const missing = [];
  if (!supabaseUrl || isPlaceholder(supabaseUrl)) missing.push('SUPABASE_URL');
  if (!supabaseKey || isPlaceholder(supabaseKey)) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  throw new Error(
    `[FATAL PRODUCTION ERROR] Missing mandatory database credentials: ${missing.join(', ')}. ` +
    'In-memory demo fallback is strictly prohibited in production (NODE_ENV=production). ' +
    'Please configure these environment variables in your hosting dashboard (e.g., Render Environment settings).'
  );
}

let supabase = null;

if (hasValidCredentials) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env'
    );
  }
  return supabase;
}

module.exports = {
  supabase,
  getSupabaseClient,
  KNOWN_PRODUCTION_HOSTS,
  isTestEnv: isTestOrStagingEnv
};
