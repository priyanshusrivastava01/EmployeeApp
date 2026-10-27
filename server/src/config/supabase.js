/**
 * Supabase Client Configuration
 * Initializes connection to Supabase PostgreSQL and Storage using service-role credentials.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

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
let supabase = null;

if (supabaseUrl && supabaseKey && !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseKey)) {
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
