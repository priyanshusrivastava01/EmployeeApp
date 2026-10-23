/**
 * Verification test for Stage 1B: Supabase Database Connectivity
 */
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testDatabaseConnection() {
  console.log('--- EMS Database Connectivity Test (Stage 1B) ---');

  if (!url || !key || url.includes('your-project-id')) {
    console.log('[Status] NOTICE: Supabase credentials are not configured yet in server/.env');
    console.log('[Guide] To connect your database:');
    console.log('  1. Create a free project at https://supabase.com');
    console.log('  2. Copy Project URL and Service Role Key from Project Settings -> API');
    console.log('  3. Paste them into server/.env:');
    console.log('     SUPABASE_URL=https://xxxx.supabase.co');
    console.log('     SUPABASE_SERVICE_ROLE_KEY=ey...');
    console.log('  4. Execute server/src/db/schema.sql in the Supabase SQL Editor');
    console.log('  5. Re-run: npm run test:db');
    return;
  }

  console.log(`[Status] Connecting to Supabase at: ${url} ...`);
  const client = createClient(url, key, {
    auth: { persistSession: false }
  });

  try {
    const startTime = Date.now();
    // Test querying the users table
    const { data, error, count } = await client
      .from('users')
      .select('id', { count: 'exact', head: true });

    const latency = Date.now() - startTime;

    if (error) {
      if (error.code === '42P01') {
        console.log(`[Status] Connected to Supabase in ${latency}ms!`);
        console.log('[Notice] The "users" table does not exist yet.');
        console.log('[Guide] Please run server/src/db/schema.sql in your Supabase SQL Editor to create the tables.');
      } else {
        console.error('[Error] Supabase returned an error:', error.message);
      }
      return;
    }

    console.log(`[Status] SUCCESS: Connected to Supabase PostgreSQL in ${latency}ms!`);
    console.log(`[Status] Schema verified: "users" table is accessible. Total users: ${count || 0}`);
  } catch (err) {
    console.error('[Error] Failed to connect to Supabase:', err.message);
  }
}

testDatabaseConnection();
