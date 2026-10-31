/**
 * Supabase Client Configuration
 * Initializes connection to Supabase PostgreSQL and Storage using service-role credentials.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Ensure server/.env is loaded even when launched from repository root or subdirectories
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isPlaceholder = (val) => {
  if (!val) return true;
  const lower = val.toLowerCase();
  return lower.includes('your-project-id') ||
    lower.includes('your_project_url') ||
    lower.includes('your-supabase-service-role') ||
    lower.includes('example');
};

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
  getSupabaseClient
};
