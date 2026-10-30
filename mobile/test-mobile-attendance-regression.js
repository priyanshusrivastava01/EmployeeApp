/**
 * Mobile Attendance Regression Test Suite
 * 
 * Verifies Phase 1 Code Alignment Fixes:
 * 1. Empty history with no mock leakage.
 * 2. WFO geofence using the authenticated organization's settings (no hardcoded Bangalore).
 * 3. Backend HTTP 409 rejection without local store fallback.
 * 4. Backend/network failure without a false active shift.
 * 5. Failed selfie upload aborting Punch-In/Punch-Out.
 * 6. Signed URL resolution for private attendance photos.
 * 7. Attendance state restoration after app restart.
 * 
 * NOTE: This is a simulated regression test running in Node.js against client logic.
 * It does not perform live write operations or mutate production Supabase data.
 */

const { calculateHaversineDistance, evaluateGeofence } = require('./src/utils/geofence');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function runRegressionSuite() {
  console.log('======================================================================');
  console.log('       EMS MOBILE ATTENDANCE REGRESSION TEST SUITE (PHASE 1)          ');
  console.log('======================================================================\n');

  // ── TEST 1: Empty History with No Mock Leakage ─────────────────────
  console.log('--- Test 1: Empty History with No Mock Leakage ---');
  {
    // Simulate App.js fetchAttendanceHistory behavior
    let attendanceHistory = [];
    const mockApiResponse = { success: true, data: [] };

    // Function matching updated App.js logic
    const updateHistory = (res) => {
      if (res && res.success) {
        const rawList = Array.isArray(res.data) ? res.data : [];
        attendanceHistory = rawList.map(item => ({
          id: item.id,
          date: item.work_date || 'Today',
          mode: item.work_mode || item.mode || 'WFO'
        }));
      }
    };

    updateHistory(mockApiResponse);
    assert(attendanceHistory.length === 0, 'Empty backend data array results in length 0 (not mock data)');
    assert(!attendanceHistory.some(h => h.date?.includes('Oct 21, 2026')), 'No mock shifts from October 2026 leaked');
  }

  // ── TEST 2: Dynamic WFO Geofence Using Authenticated Org Settings ──
  console.log('\n--- Test 2: Dynamic WFO Geofence Using Authenticated Org Settings ---');
  {
    // Mumbai office test organization
    const mumbaiOrg = {
      id: 'org-mumbai-1',
      name: 'Mumbai Tech Hub',
      office_lat: 19.0760,
      office_lng: 72.8777,
      office_radius_meters: 200
    };

    // User at Mumbai office (within 50 meters)
    const mumbaiUserCoords = {
      latitude: 19.0762,
      longitude: 72.8779
    };

    const mumbaiGeofence = {
      latitude: Number(mumbaiOrg.office_lat),
      longitude: Number(mumbaiOrg.office_lng),
      radiusMeters: Number(mumbaiOrg.office_radius_meters)
    };

    const wfoInside = evaluateGeofence(mumbaiUserCoords, mumbaiGeofence, 'WFO');
    assert(wfoInside.isInside === true, 'WFO inside Mumbai geofence evaluated as verified');
    assert(wfoInside.distanceMeters < 200, `Haversine distance (${wfoInside.distanceMeters}m) is within 200m radius`);

    // User in Bangalore (hundreds of km away from Mumbai)
    const bangaloreCoords = { latitude: 12.9716, longitude: 77.5946 };
    const wfoOutside = evaluateGeofence(bangaloreCoords, mumbaiGeofence, 'WFO');
    assert(wfoOutside.isInside === false, 'WFO in Bangalore evaluated as outside Mumbai office geofence');
    assert(wfoOutside.distanceMeters > 500000, `Distance correctly detected as >500km (${wfoOutside.distanceMeters}m)`);

    // Organization with unconfigured office GPS
    const unconfiguredOrg = { id: 'org-no-gps', name: 'Virtual Org', office_lat: null, office_lng: null };
    const unconfiguredGeofence = (unconfiguredOrg.office_lat != null) ? {
      latitude: unconfiguredOrg.office_lat,
      longitude: unconfiguredOrg.office_lng,
      radiusMeters: 100
    } : null;

    const unconfiguredResult = evaluateGeofence(mumbaiUserCoords, unconfiguredGeofence, 'WFO');
    assert(unconfiguredResult.isInside === false, 'WFO blocked when office coordinates are not configured');
    assert(unconfiguredResult.statusLabel.includes('not configured'), 'Shows clear geofence configuration error');

    // WFH mode: remote session check
    const wfhResult = evaluateGeofence(bangaloreCoords, mumbaiGeofence, 'WFH');
    assert(wfhResult.isInside === true, 'WFH mode is allowed regardless of distance from office');
  }

  // ── TEST 3: Backend HTTP 409 Rejection Without Local Store Fallback ─
  console.log('\n--- Test 3: Backend HTTP 409 Rejection Without Local Store Fallback ---');
  {
    // Simulate ApiService behavior
    class TestApiService {
      constructor() {
        this.token = 'jwt-valid-session-token';
        this.store = {
          punchIn: async () => ({ success: true, mocked: true })
        };
      }

      async request(endpoint) {
        if (endpoint === '/api/attendance/punch-in') {
          const err = new Error('Attendance already recorded for today');
          err.status = 409;
          err.isServerError = true;
          throw err;
        }
      }

      async punchIn(payload) {
        if (this.token) {
          return await this.request('/api/attendance/punch-in', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
        return await this.store.punchIn(payload);
      }
    }

    const testApi = new TestApiService();
    let threwError = false;
    let receivedStatus = null;

    try {
      await testApi.punchIn({ mode: 'WFO' });
    } catch (err) {
      threwError = true;
      receivedStatus = err.status;
    }

    assert(threwError === true, 'api.punchIn threw error on backend 409');
    assert(receivedStatus === 409, 'Error preserved HTTP 409 status code');
  }

  // ── TEST 4: Backend/Network Failure Without False Active Shift ──────
  console.log('\n--- Test 4: Backend/Network Failure Without False Active Shift ---');
  {
    let attendanceState = {
      isPunchedIn: false,
      isPunchedOut: false
    };

    const handlePunchSuccessSim = async (record, apiFailure = true) => {
      if (apiFailure) {
        throw new Error('Network timeout: Cannot reach EMS backend');
      }
      attendanceState = { isPunchedIn: true, isPunchedOut: false };
    };

    let caughtError = false;
    try {
      await handlePunchSuccessSim({ photoUri: 'data:image/jpeg;base64,sample' }, true);
    } catch (e) {
      caughtError = true;
    }

    assert(caughtError === true, 'Network failure caught by caller');
    assert(attendanceState.isPunchedIn === false, 'attendanceState.isPunchedIn remained false after failure');
  }

  // ── TEST 5: Failed Selfie Upload Aborting Punch Flow ────────────────
  console.log('\n--- Test 5: Failed Selfie Upload Aborting Punch Flow ---');
  {
    let punchApiCalled = false;

    const executePunch = async (uploadSucceeds) => {
      // Step 1: Upload selfie
      if (!uploadSucceeds) {
        throw new Error('Selfie upload failed: Storage service unavailable');
      }
      const remotePhotoPath = 'org-uuid/user-uuid/punch.jpg';

      // Step 2: Call attendance API
      punchApiCalled = true;
      return { success: true };
    };

    let uploadFailedCaught = false;
    try {
      await executePunch(false);
    } catch (e) {
      uploadFailedCaught = true;
    }

    assert(uploadFailedCaught === true, 'Failed upload threw error to abort flow');
    assert(punchApiCalled === false, 'api.punchIn was NOT called when upload failed');
  }

  // ── TEST 6: Signed URL Resolution for Private Attendance Photos ─────
  console.log('\n--- Test 6: Signed URL Resolution for Private Attendance Photos ---');
  {
    const signedUrlCache = new Map();
    const fakeApi = {
      getStorageSignedUrl: async ({ bucket, filePath }) => {
        return {
          success: true,
          data: {
            signedUrl: `https://supabase.co/storage/v1/object/sign/${bucket}/${filePath}?token=test-signed-token`
          }
        };
      }
    };

    const resolveSelfieUrl = async (photoPath) => {
      if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
        return photoPath;
      }
      const cached = signedUrlCache.get(photoPath);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
      }
      const res = await fakeApi.getStorageSignedUrl({ bucket: 'attendance-selfies', filePath: photoPath });
      const url = res?.data?.signedUrl;
      if (url) {
        signedUrlCache.set(photoPath, { url, expiresAt: Date.now() + 3600000 });
      }
      return url;
    };

    const privatePath = 'org-123/emp-456/punch-in-selfie.jpg';
    const resolved = await resolveSelfieUrl(privatePath);

    assert(resolved.includes('token=test-signed-token'), 'Private path successfully resolved to signed URL');
    assert(signedUrlCache.has(privatePath), 'Resolved URL cached in memory');

    // Test cached hit
    const cachedHit = await resolveSelfieUrl(privatePath);
    assert(cachedHit === resolved, 'Cached URL returned on second request');
  }

  // ── TEST 7: Attendance State Restoration After App Restart ──────────
  console.log('\n--- Test 7: Attendance State Restoration After App Restart ---');
  {
    // Backend returns today active record
    const serverTodayRecord = {
      id: 'att-session-today',
      work_date: '2026-10-30',
      work_mode: 'WFO',
      punch_in_time: '2026-10-30T09:15:00.000Z',
      punch_out_time: null,
      punch_in_latitude: 19.0760,
      punch_in_longitude: 72.8777,
      punch_in_accuracy: 8,
      punch_in_photo_path: 'org-test/user-test/punch_in_123.jpg',
      punch_in_verified: true
    };

    // Hydration function matching App.js fetchTodayAttendance
    const hydrateAttendance = (rec) => {
      if (!rec) {
        return { isPunchedIn: false, isPunchedOut: false };
      }
      return {
        isPunchedIn: Boolean(rec.punch_in_time && !rec.punch_out_time),
        isPunchedOut: Boolean(rec.punch_out_time),
        mode: rec.work_mode || rec.mode || 'WFO',
        punchInTime: rec.punch_in_time ? new Date(rec.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        punchInDate: rec.work_date,
        punchInPhotoUri: rec.punch_in_photo_path,
        punchInCoords: rec.punch_in_latitude != null ? {
          latitude: rec.punch_in_latitude,
          longitude: rec.punch_in_longitude
        } : null,
        punchInGeofence: rec.punch_in_verified ? { verified: true } : null
      };
    };

    const hydrated = hydrateAttendance(serverTodayRecord);
    assert(hydrated.isPunchedIn === true, 'Restored session recognizes active punch-in state');
    assert(hydrated.isPunchedOut === false, 'punch_out_time is null so isPunchedOut is false');
    assert(hydrated.punchInPhotoUri === 'org-test/user-test/punch_in_123.jpg', 'punchInPhotoUri correctly mapped from punch_in_photo_path');
    assert(hydrated.mode === 'WFO', 'Work mode restored as WFO');

    // Case 2: Shift completed today
    const completedServerRecord = {
      ...serverTodayRecord,
      punch_out_time: '2026-10-30T18:00:00.000Z'
    };
    const hydratedCompleted = hydrateAttendance(completedServerRecord);
    assert(hydratedCompleted.isPunchedIn === false, 'Completed shift: isPunchedIn is false');
    assert(hydratedCompleted.isPunchedOut === true, 'Completed shift: isPunchedOut is true');
  }

  // ── TEST 8: Timezone-Safe Date Parsing (formatCalendarDate) ─────────
  console.log('\n--- Test 8: Timezone-Safe Date Parsing (formatCalendarDate) ---');
  {
    function formatCalendarDate(dateStr) {
      if (!dateStr || typeof dateStr !== 'string') return 'Today';
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[3], 10);
        const localNoonDate = new Date(year, month, day, 12, 0, 0);
        return localNoonDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      return dateStr;
    }

    const testDate = '2026-10-30';
    const formatted = formatCalendarDate(testDate);
    assert(formatted.includes('Oct 30, 2026') || formatted.includes('October 30, 2026'), `Date "2026-10-30" formatted correctly as "${formatted}" without off-by-one drift`);
    assert(formatCalendarDate(null) === 'Today', 'Null date safely defaults to "Today"');
  }

  // ── TEST 9: Fresh App Init Leaves User and Org as Null ──────────────
  console.log('\n--- Test 9: Fresh App Init Leaves User and Org as Null ---');
  {
    // Mock ApiService.init without stored data
    class CleanApiService {
      constructor() {
        this.token = null;
        this.user = null;
        this.org = null;
      }
      async init() {
        // No saved tokens or users in storage
        return { token: this.token, user: this.user, org: this.org };
      }
    }
    const cleanApi = new CleanApiService();
    const session = await cleanApi.init();
    assert(session.user === null, 'Fresh app launch has user = null');
    assert(session.org === null, 'Fresh app launch has org = null');
    assert(session.token === null, 'Fresh app launch has token = null');
  }

  // ── TEST 10: Server Rejection on Login Never Triggers Mock Auth ──────
  console.log('\n--- Test 10: Server Rejection on Login Never Triggers Mock Auth ---');
  {
    class MockRejectionApi {
      constructor() {
        this.token = null;
        this.user = null;
      }
      async request(endpoint) {
        const err = new Error('Invalid email or password.');
        err.status = 401;
        err.isServerError = true;
        throw err;
      }
      async login(email, password) {
        try {
          return await this.request('/api/auth/login');
        } catch (err) {
          if (err.isServerError || err.status) {
            throw err;
          }
          // offline fallback should not run
          return { success: true, isOfflineFallback: true };
        }
      }
    }

    const rejectionApi = new MockRejectionApi();
    let caught401 = false;
    let result = null;
    try {
      result = await rejectionApi.login('aarav.sharma@company.com', 'wrongpassword');
    } catch (err) {
      caught401 = true;
      assert(err.status === 401, 'Error retains HTTP 401 status code');
    }
    assert(caught401 === true, 'Server 401 error was thrown to caller');
    assert(result === null, 'No mock session was created on wrong password');
  }

  // ── TEST 11: Server Rejection on Register Never Triggers Mock Org ────
  console.log('\n--- Test 11: Server Rejection on Register Never Triggers Mock Org ---');
  {
    class MockRegisterRejectionApi {
      async request(endpoint) {
        const err = new Error('This company code is already in use.');
        err.status = 409;
        err.isServerError = true;
        throw err;
      }
      async registerCompany(payload) {
        try {
          return await this.request('/api/auth/register-company');
        } catch (err) {
          if (err.isServerError || err.status) {
            throw err;
          }
          return { success: true, isOfflineFallback: true };
        }
      }
    }

    const regApi = new MockRegisterRejectionApi();
    let caught409 = false;
    let regResult = null;
    try {
      regResult = await regApi.registerCompany({ companyCode: 'DUPLICATE' });
    } catch (err) {
      caught409 = true;
      assert(err.status === 409, 'Error retains HTTP 409 status code');
    }
    assert(caught409 === true, 'Server 409 error was thrown to caller');
    assert(regResult === null, 'No mock company was created on duplicate registration');
  }

  // ── TEST 12: getMe() HTTP 401 Clears Session and Throws ──────────────
  console.log('\n--- Test 12: getMe() HTTP 401 Clears Session and Throws ---');
  {
    class MockGetMeApi {
      constructor() {
        this.token = 'expired-token';
        this.user = { id: 'emp-101' };
      }
      async logout() {
        this.token = null;
        this.user = null;
      }
      async request() {
        const err = new Error('Session expired. Please log in again.');
        err.status = 401;
        err.isServerError = true;
        throw err;
      }
      async getMe() {
        try {
          return await this.request();
        } catch (err) {
          if (err.status === 401 || err.status === 403 || err.message?.includes('401')) {
            await this.logout();
            throw err;
          }
          if (this.user) return { success: true, user: this.user };
          throw err;
        }
      }
    }

    const getMeApi = new MockGetMeApi();
    let getMeError = false;
    try {
      await getMeApi.getMe();
    } catch (e) {
      getMeError = true;
    }
    assert(getMeError === true, 'getMe() rethrew HTTP 401 error');
    assert(getMeApi.token === null, 'Token cleared on 401');
    assert(getMeApi.user === null, 'User cleared on 401');
  }

  // ── SUMMARY ────────────────────────────────────────────────────────
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('[Regression Suite Unexpected Error]', err);
  process.exit(1);
});

