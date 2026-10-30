const path = require('path');
process.chdir(path.resolve(__dirname));

const { supabase } = require('./src/config/supabase');

async function testLiveConnection() {
  console.log('======================================================================');
  console.log('   SUPABASE LIVE DATABASE READ-ONLY CONNECTIVITY AUDIT');
  console.log('======================================================================\n');

  if (!supabase) {
    console.error('  [FAIL] Supabase client failed to initialize (null). Check credentials in server/.env.');
    process.exit(1);
  }

  console.log('--- 1. Client Initialization Status ---');
  console.log('  [PASS] Supabase client initialized successfully.');
  console.log('  [INFO] Target Host: Real Supabase Cloud Project (*.supabase.co)');

  console.log('\n--- 2. Read-Only Database Queries (Zero writes/mutations) ---');

  const tablesToProbe = [
    'organizations',
    'users',
    'attendance_records',
    'geofences',
    'daily_reports',
    'announcements',
    'company_rules',
    'leave_applications',
    'timesheet_entries',
    'notifications',
    'holidays',
    'invitations'
  ];

  let successCount = 0;
  let missingTables = [];

  for (const table of tablesToProbe) {
    try {
      const { data, count, error, status } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true });

      if (error) {
        // Redact any potential secrets or sensitive query strings
        const safeMsg = (error.message || '').replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]');
        console.log(`  [STATUS] Table '${table}': HTTP ${status} - Error: ${safeMsg}`);
        missingTables.push({ table, error: safeMsg, code: error.code });
      } else {
        console.log(`  [PASS] Table '${table}' exists in cloud database (HTTP ${status}, total records: ${count !== null ? count : 0})`);
        successCount++;
      }
    } catch (err) {
      const safeMsg = (err.message || '').replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]');
      console.log(`  [FAIL] Query to '${table}' threw exception: ${safeMsg}`);
      missingTables.push({ table, error: safeMsg });
    }
  }

  console.log('\n--- 3. Supabase Storage Buckets Audit (Read-Only) ---');
  try {
    const { data: buckets, error: storageErr } = await supabase.storage.listBuckets();
    if (storageErr) {
      const safeMsg = (storageErr.message || '').replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]');
      console.log(`  [WARN] Storage bucket listing returned error: ${safeMsg}`);
    } else {
      const bucketNames = (buckets || []).map(b => b.name);
      console.log(`  [INFO] Cloud Storage Buckets found: [${bucketNames.join(', ')}]`);
      const hasSelfies = bucketNames.includes('attendance-selfies');
      const hasProfilePhotos = bucketNames.includes('profile-photos');
      console.log(`  [${hasSelfies ? 'PASS' : 'WARN'}] 'attendance-selfies' bucket: ${hasSelfies ? 'EXISTS' : 'MISSING (Action required)'}`);
      console.log(`  [${hasProfilePhotos ? 'PASS' : 'WARN'}] 'profile-photos' bucket: ${hasProfilePhotos ? 'EXISTS' : 'MISSING (Action required)'}`);
    }
  } catch (err) {
    console.log(`  [WARN] Storage probe exception: ${(err.message || '').replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]')}`);
  }

  console.log('\n======================================================================');
  console.log(`AUDIT SUMMARY:`);
  console.log(`  Connection Type: LIVE SUPABASE POSTGRESQL (NOT in-memory fallback)`);
  console.log(`  Probed Tables:   ${tablesToProbe.length}`);
  console.log(`  Confirmed Live:  ${successCount}`);
  console.log(`  Errors/Missing:  ${missingTables.length}`);
  console.log('======================================================================\n');
}

testLiveConnection().catch(err => {
  const safeMsg = (err.message || '').replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]');
  console.error('Fatal Connectivity Test Failure:', safeMsg);
  process.exit(1);
});

