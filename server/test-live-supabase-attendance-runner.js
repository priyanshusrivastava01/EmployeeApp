/**
 * EMS Live Supabase Isolated Attendance End-to-End Verification Runner
 * 
 * Safety & Isolation Guarantees:
 * 1. Generates ephemeral, unique UUIDs and company codes (ATT-<HEX>) per run.
 * 2. Implements immediate tracking of all created resources.
 * 3. Never uses TRUNCATE, wildcards, or broad deletions.
 * 4. Cleanup operates with fault tolerance (continues on single failure).
 * 5. Independently verifies post-cleanup deletion of:
 *    - Organization
 *    - User
 *    - Branch
 *    - Attendance record
 *    - Storage selfie files in 'attendance-selfies'
 * 6. Explicitly fails the test if any cleanup or verification step fails.
 * 7. Enforces that all responses originate from Supabase (source === 'supabase').
 * 8. Automatic secret and token redaction on all console outputs.
 * 9. ₹0 budget compliant.
 * 
 * NOTE: DO NOT EXECUTE UNTIL EXPLICITLY AUTHORIZED BY THE USER.
 */

process.env.NODE_ENV = 'test';

const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

// Load environment from server/.env securely without printing secrets
require('./node_modules/dotenv').config({ path: path.resolve(__dirname, '.env') });

const { supabase } = require('./src/config/supabase');
const { app } = require('./src/index');

// Redaction utility to guarantee no secrets leak in stdout
function sanitize(str) {
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/eyJ[a-zA-Z0-9_\-\.]+/g, '[REDACTED_JWT]')
    .replace(/(password|secret|key|token)["':\s]+["']?([^"',\s]+)/gi, '$1: [REDACTED]')
    .replace(/token=[^&\s]+/gi, 'token=[REDACTED]');
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
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        }
        resolve({ status: this.statusCode, headers: this.headers, data: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, headers: this.headers, data });
      },
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      getHeader(k) { return this.headers[k.toLowerCase()]; }
    };

    app.handle(req, res);
  });
}

// Minimal 1x1 test PNGs
const TEST_SELFIE_IN_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const TEST_SELFIE_OUT_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Resource tracker for guaranteed cleanup
const trackedResources = {
  organizationId: null,
  userId: null,
  branchId: null,
  attendanceId: null,
  storagePaths: []
};

async function runLiveAttendanceTest() {
  console.log('======================================================================');
  console.log('   EMS LIVE SUPABASE ATTENDANCE INTEGRATION TEST');
  console.log('======================================================================\n');

  if (!supabase) {
    console.error('  [ABORT] Supabase client is not initialized.');
    process.exit(1);
  }

  let testPassed = true;
  let testError = null;

  // Generate completely unique, isolated identifiers
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  const testCompanyCode = `ATT-${randomSuffix}`;
  const testSlug = `att-test-${randomSuffix.toLowerCase()}`;
  const testEmail = `founder.${randomSuffix.toLowerCase()}@attendance-isolated-test.local`;
  const testPassword = `Pass#${crypto.randomBytes(8).toString('base64url')}9!`;
  const testCompanyName = `Attendance Test Org ${randomSuffix}`;

  const officeLat = 12.9716;
  const officeLng = 77.5946;

  console.log('--- Phase 1: Test Fixtures Generated ---');
  console.log(`  Company Code: ${testCompanyCode}`);
  console.log(`  Slug:         ${testSlug}`);
  console.log(`  Email:        ${testEmail}`);
  console.log(`  Office GPS:   ${officeLat}, ${officeLng} (Bengaluru Innovation Hub)\n`);

  let authToken = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Company Registration (POST /api/auth/register-company)
    // -------------------------------------------------------------------------
    console.log('--- Phase 2: Register Test Company & Founder ---');
    const regRes = await simulate('POST', '/api/auth/register-company', {
      fullName: 'Attendance Test Founder',
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
      location: {
        address: 'MG Road Innovation Center, Bengaluru, Karnataka 560001',
        latitude: officeLat,
        longitude: officeLng
      }
    });

    if (regRes.status !== 201 || !regRes.data?.success) {
      throw new Error(`Company registration failed (HTTP ${regRes.status}): ${JSON.stringify(regRes.data)}`);
    }

    // Immediately track created resources
    trackedResources.organizationId = regRes.data.organization?.id;
    trackedResources.userId = regRes.data.user?.id;
    trackedResources.branchId = regRes.data.branch?.id;
    authToken = regRes.data.token;

    console.log(`  [PASS] Company registered (HTTP 201)`);
    console.log(`  [INFO] Tracked Org ID:    ${trackedResources.organizationId}`);
    console.log(`  [INFO] Tracked User ID:   ${trackedResources.userId}`);
    console.log(`  [INFO] Tracked Branch ID: ${trackedResources.branchId}`);

    // -------------------------------------------------------------------------
    // STEP 2: Verify Office Coordinates & Geofence Persisted in Supabase
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 3: Verify Office Coordinates in Supabase PostgreSQL ---');
    const { data: orgRow, error: orgErr } = await supabase
      .from('organizations')
      .select('id, office_lat, office_lng, office_radius_meters, wfh_allowed')
      .eq('id', trackedResources.organizationId)
      .single();

    if (orgErr || !orgRow) {
      throw new Error(`Failed to query organization from Supabase: ${orgErr?.message}`);
    }

    if (Number(orgRow.office_lat) !== officeLat || Number(orgRow.office_lng) !== officeLng) {
      throw new Error(`Office coordinates mismatch in Supabase: expected ${officeLat}, ${officeLng}, got ${orgRow.office_lat}, ${orgRow.office_lng}`);
    }
    console.log(`  [PASS] Office coordinates verified in PostgreSQL (${orgRow.office_lat}, ${orgRow.office_lng}, radius: ${orgRow.office_radius_meters}m)`);

    // -------------------------------------------------------------------------
    // STEP 3: Upload Punch-In Selfie to Private Bucket (POST /api/storage/upload)
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 4: Upload Punch-In Selfie to attendance-selfies Bucket ---');
    const uploadInRes = await simulate('POST', '/api/storage/upload', {
      bucket: 'attendance-selfies',
      dataUri: TEST_SELFIE_IN_BASE64,
      filename: 'punch-in-selfie.png'
    }, authToken);

    if (uploadInRes.status !== 200 || !uploadInRes.data?.data?.path) {
      throw new Error(`Punch-in selfie upload failed (HTTP ${uploadInRes.status}): ${JSON.stringify(uploadInRes.data)}`);
    }

    const punchInPhotoPath = uploadInRes.data.data.path;
    trackedResources.storagePaths.push(punchInPhotoPath);
    console.log(`  [PASS] Uploaded selfie to private bucket: ${punchInPhotoPath}`);

    // -------------------------------------------------------------------------
    // STEP 4: Signed Download URL Verification (GET /api/storage/signed-url)
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 5: Verify Signed Download URL Retrieval ---');
    const signedUrlRes = await simulate('GET', `/api/storage/signed-url?bucket=attendance-selfies&filePath=${encodeURIComponent(punchInPhotoPath)}`, null, authToken);
    if (signedUrlRes.status !== 200 || !signedUrlRes.data?.data?.signedUrl) {
      throw new Error(`Signed URL generation failed: ${JSON.stringify(signedUrlRes.data)}`);
    }
    console.log('  [PASS] Generated 1-hour signed download URL for private photo');

    // -------------------------------------------------------------------------
    // STEP 5: Live Punch-In (POST /api/attendance/punch-in)
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 6: Execute Live Punch-In (WFO Mode) ---');
    const punchInRes = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFO',
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 5.0,
      photoPath: punchInPhotoPath
    }, authToken);

    if (punchInRes.status !== 201 || !punchInRes.data?.success) {
      throw new Error(`Punch-in failed (HTTP ${punchInRes.status}): ${JSON.stringify(punchInRes.data)}`);
    }

    if (punchInRes.data.source !== 'supabase') {
      throw new Error(`Silent fallback detected: punch-in reported source "${punchInRes.data.source}", expected "supabase"`);
    }

    trackedResources.attendanceId = punchInRes.data.data?.id;
    console.log(`  [PASS] Punch-in succeeded (HTTP 201, source: supabase)`);
    console.log(`  [INFO] Tracked Attendance ID: ${trackedResources.attendanceId}`);
    console.log(`  [INFO] Geofence Verified:     ${punchInRes.data.geofenceVerified}`);

    // Verify row in Supabase PostgreSQL directly
    const { data: attDbRow, error: attDbErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', trackedResources.attendanceId)
      .single();

    if (attDbErr || !attDbRow) {
      throw new Error(`Failed to query attendance record directly from Supabase: ${attDbErr?.message}`);
    }
    if (attDbRow.punch_in_photo_path !== punchInPhotoPath) {
      throw new Error(`Storage path mismatch in PostgreSQL: expected ${punchInPhotoPath}, got ${attDbRow.punch_in_photo_path}`);
    }
    console.log(`  [PASS] PostgreSQL row verified in Supabase attendance_records table`);

    // -------------------------------------------------------------------------
    // STEP 6: Duplicate Punch-In Prevention Check
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 7: Verify Duplicate Punch-In Prevention ---');
    const dupRes = await simulate('POST', '/api/attendance/punch-in', {
      mode: 'WFO',
      latitude: officeLat,
      longitude: officeLng,
      photoPath: punchInPhotoPath
    }, authToken);

    if (dupRes.status !== 409) {
      throw new Error(`Duplicate punch-in was not rejected with HTTP 409 (got HTTP ${dupRes.status})`);
    }
    console.log(`  [PASS] Duplicate punch-in correctly rejected with HTTP 409 Conflict`);

    // -------------------------------------------------------------------------
    // STEP 7: Upload Fresh Punch-Out Selfie
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 8: Upload Fresh Punch-Out Selfie ---');
    const uploadOutRes = await simulate('POST', '/api/storage/upload', {
      bucket: 'attendance-selfies',
      dataUri: TEST_SELFIE_OUT_BASE64,
      filename: 'punch-out-selfie.png'
    }, authToken);

    if (uploadOutRes.status !== 200 || !uploadOutRes.data?.data?.path) {
      throw new Error(`Punch-out selfie upload failed: ${JSON.stringify(uploadOutRes.data)}`);
    }

    const punchOutPhotoPath = uploadOutRes.data.data.path;
    trackedResources.storagePaths.push(punchOutPhotoPath);
    console.log(`  [PASS] Uploaded second selfie to private bucket: ${punchOutPhotoPath}`);

    // -------------------------------------------------------------------------
    // STEP 8: Punch-Out Missing Selfie Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 9: Verify Punch-Out Requires Fresh Selfie ---');
    const noSelfieOut = await simulate('POST', '/api/attendance/punch-out', {
      latitude: officeLat,
      longitude: officeLng
    }, authToken);

    if (noSelfieOut.status !== 400) {
      throw new Error(`Punch-out without selfie was not rejected with HTTP 400 (got HTTP ${noSelfieOut.status})`);
    }
    console.log(`  [PASS] Punch-out without selfie rejected with HTTP 400`);

    // -------------------------------------------------------------------------
    // STEP 9: Live Punch-Out (POST /api/attendance/punch-out)
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 10: Execute Live Punch-Out with Fresh Selfie & GPS ---');
    const punchOutRes = await simulate('POST', '/api/attendance/punch-out', {
      latitude: officeLat,
      longitude: officeLng,
      accuracy: 6.0,
      photoPath: punchOutPhotoPath
    }, authToken);

    if (punchOutRes.status !== 200 || !punchOutRes.data?.success) {
      throw new Error(`Punch-out failed (HTTP ${punchOutRes.status}): ${JSON.stringify(punchOutRes.data)}`);
    }

    if (punchOutRes.data.source !== 'supabase') {
      throw new Error(`Silent fallback detected on punch-out: reported source "${punchOutRes.data.source}"`);
    }

    console.log(`  [PASS] Punch-out succeeded (HTTP 200, source: supabase)`);
    console.log(`  [INFO] Total Minutes Computed: ${punchOutRes.data.totalMinutes}`);

    // -------------------------------------------------------------------------
    // STEP 10: Verify Updated Attendance Row in Supabase PostgreSQL
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 11: Verify Updated Record in Supabase PostgreSQL ---');
    const { data: updatedAttRow, error: updateAttErr } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', trackedResources.attendanceId)
      .single();

    if (updateAttErr || !updatedAttRow) {
      throw new Error(`Failed to query updated attendance row from Supabase: ${updateAttErr?.message}`);
    }
    if (!updatedAttRow.punch_out_time || updatedAttRow.punch_out_photo_path !== punchOutPhotoPath) {
      throw new Error('Supabase attendance record was not updated with punch-out time and photo path');
    }
    console.log('  [PASS] Supabase PostgreSQL confirms punch_out_time and fresh selfie path saved');

    // -------------------------------------------------------------------------
    // STEP 11: Verify Attendance History & Today Status
    // -------------------------------------------------------------------------
    console.log('\n--- Phase 12: Verify Attendance History & Today Status ---');
    const historyRes = await simulate('GET', '/api/attendance', null, authToken);
    if (historyRes.status !== 200 || historyRes.data.source !== 'supabase' || historyRes.data.total !== 1) {
      throw new Error(`Attendance history verification failed: ${JSON.stringify(historyRes.data)}`);
    }
    console.log(`  [PASS] GET /api/attendance returned exact 1 record with source: supabase (0 demo data leakage)`);

    const todayRes = await simulate('GET', '/api/attendance/today', null, authToken);
    if (todayRes.status !== 200 || todayRes.data.source !== 'supabase' || !todayRes.data.isPunchedOut) {
      throw new Error(`GET /api/attendance/today verification failed: ${JSON.stringify(todayRes.data)}`);
    }
    console.log(`  [PASS] GET /api/attendance/today confirms isPunchedOut: true`);

  } catch (err) {
    testPassed = false;
    testError = err.message;
    console.error('\n  [TEST ERROR OCCURRED]:', sanitize(err.message));
  } finally {
    // -------------------------------------------------------------------------
    // SURGICAL TEARDOWN & INDEPENDENT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n======================================================================');
    console.log('   SURGICAL TEARDOWN & INDEPENDENT CLEANUP VERIFICATION');
    console.log('======================================================================');

    const cleanupErrors = [];
    const verificationFailures = [];

    // 1. Purge uploaded private storage files
    if (trackedResources.storagePaths.length > 0) {
      console.log(`\n  [CLEANUP] Removing ${trackedResources.storagePaths.length} storage files from attendance-selfies...`);
      for (const filePath of trackedResources.storagePaths) {
        try {
          const { error: removeErr } = await supabase.storage.from('attendance-selfies').remove([filePath]);
          if (removeErr) {
            cleanupErrors.push(`Failed to remove storage file ${filePath}: ${removeErr.message}`);
          } else {
            console.log(`  [PASS] Deleted storage file: ${filePath}`);
          }
        } catch (e) {
          cleanupErrors.push(`Exception removing storage file ${filePath}: ${e.message}`);
        }
      }
    }

    // 2. Delete attendance record by exact UUID
    if (trackedResources.attendanceId) {
      console.log(`\n  [CLEANUP] Deleting attendance record ${trackedResources.attendanceId}...`);
      try {
        const { error: delAttErr } = await supabase.from('attendance_records').delete().eq('id', trackedResources.attendanceId);
        if (delAttErr) {
          cleanupErrors.push(`Failed to delete attendance record: ${delAttErr.message}`);
        } else {
          console.log(`  [PASS] Deleted attendance record: ${trackedResources.attendanceId}`);
        }
      } catch (e) {
        cleanupErrors.push(`Exception deleting attendance record: ${e.message}`);
      }
    }

    // 3. Delete branch by exact UUID
    if (trackedResources.branchId) {
      console.log(`  [CLEANUP] Deleting branch ${trackedResources.branchId}...`);
      try {
        const { error: delBranchErr } = await supabase.from('branches').delete().eq('id', trackedResources.branchId);
        if (delBranchErr) {
          cleanupErrors.push(`Failed to delete branch: ${delBranchErr.message}`);
        } else {
          console.log(`  [PASS] Deleted branch: ${trackedResources.branchId}`);
        }
      } catch (e) {
        cleanupErrors.push(`Exception deleting branch: ${e.message}`);
      }
    }

    // 4. Delete user by exact UUID
    if (trackedResources.userId) {
      console.log(`  [CLEANUP] Deleting user ${trackedResources.userId}...`);
      try {
        const { error: delUserErr } = await supabase.from('users').delete().eq('id', trackedResources.userId);
        if (delUserErr) {
          cleanupErrors.push(`Failed to delete user: ${delUserErr.message}`);
        } else {
          console.log(`  [PASS] Deleted user: ${trackedResources.userId}`);
        }
      } catch (e) {
        cleanupErrors.push(`Exception deleting user: ${e.message}`);
      }
    }

    // 5. Delete organization by exact UUID
    if (trackedResources.organizationId) {
      console.log(`  [CLEANUP] Deleting organization ${trackedResources.organizationId}...`);
      try {
        const { error: delOrgErr } = await supabase.from('organizations').delete().eq('id', trackedResources.organizationId);
        if (delOrgErr) {
          cleanupErrors.push(`Failed to delete organization: ${delOrgErr.message}`);
        } else {
          console.log(`  [PASS] Deleted organization: ${trackedResources.organizationId}`);
        }
      } catch (e) {
        cleanupErrors.push(`Exception deleting organization: ${e.message}`);
      }
    }

    // -------------------------------------------------------------------------
    // INDEPENDENT POST-CLEANUP VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- Independent Post-Cleanup Verification ---');

    // 1. Verify organization removal
    if (trackedResources.organizationId) {
      try {
        const { data: checkOrg, error: orgCheckErr } = await supabase
          .from('organizations')
          .select('id')
          .eq('id', trackedResources.organizationId)
          .maybeSingle();

        if (orgCheckErr) {
          verificationFailures.push(`Verification query failed for organization (${trackedResources.organizationId}): ${orgCheckErr.message}`);
        } else if (checkOrg) {
          verificationFailures.push(`Residual organization row found: ${trackedResources.organizationId}`);
        } else {
          console.log(`  [PASS] Confirmed organization deleted: ${trackedResources.organizationId}`);
        }
      } catch (e) {
        verificationFailures.push(`Verification exception for organization: ${e.message}`);
      }
    }

    // 2. Verify user removal
    if (trackedResources.userId) {
      try {
        const { data: checkUser, error: userCheckErr } = await supabase
          .from('users')
          .select('id')
          .eq('id', trackedResources.userId)
          .maybeSingle();

        if (userCheckErr) {
          verificationFailures.push(`Verification query failed for user (${trackedResources.userId}): ${userCheckErr.message}`);
        } else if (checkUser) {
          verificationFailures.push(`Residual user row found: ${trackedResources.userId}`);
        } else {
          console.log(`  [PASS] Confirmed user deleted: ${trackedResources.userId}`);
        }
      } catch (e) {
        verificationFailures.push(`Verification exception for user: ${e.message}`);
      }
    }

    // 3. Verify branch removal
    if (trackedResources.branchId) {
      try {
        const { data: checkBranch, error: branchCheckErr } = await supabase
          .from('branches')
          .select('id')
          .eq('id', trackedResources.branchId)
          .maybeSingle();

        if (branchCheckErr) {
          verificationFailures.push(`Verification query failed for branch (${trackedResources.branchId}): ${branchCheckErr.message}`);
        } else if (checkBranch) {
          verificationFailures.push(`Residual branch row found: ${trackedResources.branchId}`);
        } else {
          console.log(`  [PASS] Confirmed branch deleted: ${trackedResources.branchId}`);
        }
      } catch (e) {
        verificationFailures.push(`Verification exception for branch: ${e.message}`);
      }
    }

    // 4. Verify attendance record removal
    if (trackedResources.attendanceId) {
      try {
        const { data: checkAtt, error: attCheckErr } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('id', trackedResources.attendanceId)
          .maybeSingle();

        if (attCheckErr) {
          verificationFailures.push(`Verification query failed for attendance record (${trackedResources.attendanceId}): ${attCheckErr.message}`);
        } else if (checkAtt) {
          verificationFailures.push(`Residual attendance record row found: ${trackedResources.attendanceId}`);
        } else {
          console.log(`  [PASS] Confirmed attendance record deleted: ${trackedResources.attendanceId}`);
        }
      } catch (e) {
        verificationFailures.push(`Verification exception for attendance record: ${e.message}`);
      }
    }

    // 5. Verify storage files removal
    for (const filePath of trackedResources.storagePaths) {
      try {
        const dir = path.posix.dirname(filePath);
        const filename = path.posix.basename(filePath);
        const { data: files, error: listErr } = await supabase.storage.from('attendance-selfies').list(dir);

        if (listErr) {
          verificationFailures.push(`Storage verification listing failed for ${filePath}: ${listErr.message}`);
        } else if (files && files.some(f => f.name === filename)) {
          verificationFailures.push(`Residual storage file found in attendance-selfies: ${filePath}`);
        } else {
          console.log(`  [PASS] Confirmed storage file removed: ${filePath}`);
        }
      } catch (e) {
        verificationFailures.push(`Storage verification exception for ${filePath}: ${e.message}`);
      }
    }

    // Print cleanup report
    if (cleanupErrors.length === 0 && verificationFailures.length === 0) {
      console.log('  [PASS] Verified: All test rows and storage files were 100% purged. Zero residual remnants remain.');
    } else {
      if (cleanupErrors.length > 0) {
        console.error('  [CLEANUP ERRORS]:', cleanupErrors);
      }
      if (verificationFailures.length > 0) {
        console.error('  [VERIFICATION FAILURES]:', verificationFailures);
      }
    }

    const overallSuccess = testPassed && cleanupErrors.length === 0 && verificationFailures.length === 0;

    console.log('\n======================================================================');
    console.log(`   OVERALL VERIFICATION RESULT: ${overallSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log('======================================================================\n');

    if (!overallSuccess) {
      process.exit(1);
    }
  }
}

if (require.main === module) {
  runLiveAttendanceTest().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { runLiveAttendanceTest };

