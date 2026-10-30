/**
 * Organization Settings Shift Timings, Working Days & Validation Master Test Suite
 * Validates Section 12 (Tests A through G) of the EmployeeApp specification.
 */
process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const fs = require('fs');
const { app } = require('./src/index');

function simulate(method, url, body = null, token = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = url;
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
        resolve({ status: this.statusCode, headers: this.headers, body: data });
      },
      send(data) {
        let parsed = data;
        if (typeof data === 'string') {
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
        }
        resolve({ status: this.statusCode, headers: this.headers, body: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, headers: this.headers, body: data });
      },
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      getHeader(k) {
        return this.headers[k.toLowerCase()];
      }
    };

    app.handle(req, res);
  });
}

// Mirror helper functions from AdminSettingsScreen.js for unit assertion
const ALL_DAYS = [
  { key: 'Mon', label: 'Mon' },
  { key: 'Tue', label: 'Tue' },
  { key: 'Wed', label: 'Wed' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Fri', label: 'Fri' },
  { key: 'Sat', label: 'Sat' },
  { key: 'Sun', label: 'Sun' }
];

function parse24to12(time24) {
  const [hStr, mStr] = (time24 || '09:30').split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 9;
  const m = parseInt(mStr, 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  else if (h === 0) h = 12;
  return { hour: h, minute: m, period };
}

function to24HourString(hour12, minute, period) {
  let h = hour12;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function validateTimings(startTime, endTime) {
  if (!startTime || !endTime) return false;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  return eH * 60 + eM > sH * 60 + sM;
}

function validateGracePeriod(val) {
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 0 || num > 180 || !/^\d+$/.test(String(val).trim())) {
    return false;
  }
  return true;
}

function toggleDay(selectedDays, dayKey) {
  if (selectedDays.includes(dayKey)) {
    return selectedDays.filter((d) => d !== dayKey);
  } else {
    const updated = [...selectedDays, dayKey];
    return ALL_DAYS.filter((d) => updated.includes(d.key)).map((d) => d.key);
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('   ORGANIZATION SETTINGS TIME PICKER & WORKING DAYS TEST SUITE        ');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Management Founder & Employee for Acme Technologies
    const founderLogin = await simulate('POST', '/api/auth/login', {
      companyCode: 'CMP-7K4M9X2Q',
      email: 'admin@acmetech.com',
      password: 'admin123',
      portal: 'management'
    });
    assert(founderLogin.status === 200, 'Founder authenticated successfully');
    const founderToken = founderLogin.body.token;

    const empLogin = await simulate('POST', '/api/auth/login', {
      companyCode: 'CMP-7K4M9X2Q',
      email: 'aarav.sharma@acmetech.com',
      password: 'admin123',
      portal: 'employee'
    });
    assert(empLogin.status === 200, 'Employee authenticated successfully');
    const empToken = empLogin.body.token;

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST A: Time Selection & 24h/12h Conversion
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST A: Time Selection & Conversion ---');
    const t1 = parse24to12('09:30');
    assert(t1.hour === 9 && t1.minute === 30 && t1.period === 'AM', 'TEST A.1: 09:30 parses to 9:30 AM');

    const t2 = parse24to12('18:30');
    assert(t2.hour === 6 && t2.minute === 30 && t2.period === 'PM', 'TEST A.2: 18:30 parses to 6:30 PM');

    const t3 = to24HourString(9, 30, 'AM');
    assert(t3 === '09:30', 'TEST A.3: 9:30 AM converts to 09:30 24-hour string');

    const t4 = to24HourString(6, 30, 'PM');
    assert(t4 === '18:30', 'TEST A.4: 6:30 PM converts to 18:30 24-hour string');

    // Midnight and Noon checks
    assert(to24HourString(12, 0, 'AM') === '00:00', 'TEST A.5: 12:00 AM converts to 00:00');
    assert(to24HourString(12, 0, 'PM') === '12:00', 'TEST A.6: 12:00 PM converts to 12:00');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST B: Time Validation (End > Start)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST B: Shift Timing Validation ---');
    assert(validateTimings('09:30', '18:30') === true, 'TEST B.1: Valid normal shift 09:30 -> 18:30 passes validation');
    assert(validateTimings('09:30', '08:30') === false, 'TEST B.2: Invalid same-day shift 09:30 -> 08:30 rejected');
    assert(validateTimings('09:30', '09:30') === false, 'TEST B.3: Equal start and end times rejected');

    // Backend API level validation for invalid timing
    const invalidTimingRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { work_start_time: '09:30', work_end_time: '08:30' },
      founderToken
    );
    assert(
      invalidTimingRes.status === 400 &&
      invalidTimingRes.body.error === 'Work end time must be later than work start time.',
      'TEST B.4: Backend rejects invalid shift timing (End <= Start) with HTTP 400 and clear message'
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST C: Working-Day Selection & Multi-Select Toggle
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST C: Working Days Selection ---');
    let days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    // Deselect Saturday if selected (already not in list)
    // Select Saturday
    days = toggleDay(days, 'Sat');
    assert(days.includes('Sat') && days.length === 6, 'TEST C.1: Selecting Saturday adds it to active days');
    // Select Sunday
    days = toggleDay(days, 'Sun');
    assert(days.includes('Sun') && days.length === 7, 'TEST C.2: Selecting Sunday adds it to active days');
    // Deselect Saturday
    days = toggleDay(days, 'Sat');
    assert(!days.includes('Sat') && days.includes('Sun') && days.length === 6, 'TEST C.3: Deselecting Saturday removes it');

    // Save 6 days (Mon-Fri, Sun) to backend
    const saveDaysRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { working_days: days.join(',') },
      founderToken
    );
    assert(saveDaysRes.status === 200 && saveDaysRes.body.success, 'TEST C.4: Saving updated working days returns HTTP 200');

    // Reopen / fetch settings and verify persistence
    const fetchSettingsRes = await simulate('GET', '/api/org/settings', null, founderToken);
    assert(
      fetchSettingsRes.status === 200 &&
      fetchSettingsRes.body.data.working_days === 'Mon,Tue,Wed,Thu,Fri,Sun',
      'TEST C.5: Saved working days accurately retrieved and restored from backend'
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST D: Empty Working Days Validation
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST D: Empty Working Days Validation ---');
    const emptyDaysRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { working_days: '' },
      founderToken
    );
    assert(
      emptyDaysRes.status === 400 &&
      emptyDaysRes.body.error === 'Please select at least one working day.',
      'TEST D.1: Saving empty working days rejected with HTTP 400'
    );

    const emptyArrayDaysRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { working_days: [] },
      founderToken
    );
    assert(
      emptyArrayDaysRes.status === 400,
      'TEST D.2: Saving empty array of working days rejected with HTTP 400'
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST E: Late Arrival Grace Period Validation
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST E: Grace Period Validation ---');
    assert(validateGracePeriod('0') === true, 'TEST E.1: Grace period 0 is valid');
    assert(validateGracePeriod('15') === true, 'TEST E.2: Grace period 15 is valid');
    assert(validateGracePeriod('180') === true, 'TEST E.3: Grace period 180 is valid');
    assert(validateGracePeriod('-5') === false, 'TEST E.4: Negative grace period rejected');
    assert(validateGracePeriod('abc') === false, 'TEST E.5: Non-numeric grace period rejected');
    assert(validateGracePeriod('200') === false, 'TEST E.6: Grace period > 180 rejected');

    const invalidGraceRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { late_threshold_minutes: -10 },
      founderToken
    );
    assert(invalidGraceRes.status === 400, 'TEST E.7: Backend rejects negative grace period with HTTP 400');

    const invalidGraceMaxRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { late_threshold_minutes: 250 },
      founderToken
    );
    assert(invalidGraceMaxRes.status === 400, 'TEST E.8: Backend rejects grace period > 180 with HTTP 400');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST F: Security, Access Control & Persistence
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST F: Security & Multi-Tenant Boundaries ---');
    // Employee attempting to modify settings must be forbidden
    const empForbiddenRes = await simulate(
      'PATCH',
      '/api/org/settings',
      { work_start_time: '11:00' },
      empToken
    );
    assert(
      empForbiddenRes.status === 403,
      'TEST F.1: Non-admin employee cannot modify organization settings (HTTP 403 Forbidden)'
    );

    // Valid save of all settings
    const validSaveRes = await simulate(
      'PATCH',
      '/api/org/settings',
      {
        name: 'Acme Technologies Pvt. Ltd.',
        work_start_time: '09:30',
        work_end_time: '18:30',
        late_threshold_minutes: 15,
        working_days: 'Mon,Tue,Wed,Thu,Fri'
      },
      founderToken
    );
    assert(validSaveRes.status === 200, 'TEST F.2: Founder saves valid complete settings payload');
    assert(
      validSaveRes.body.data.work_start_time === '09:30' &&
      validSaveRes.body.data.work_end_time === '18:30' &&
      validSaveRes.body.data.late_threshold_minutes === 15 &&
      validSaveRes.body.data.working_days === 'Mon,Tue,Wed,Thu,Fri',
      'TEST F.3: Persisted values confirmed matching exactly'
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST G: UI & Architectural Verification
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST G: UI & Code Invariant Checks ---');
    const screenCode = fs.readFileSync('mobile/src/screens/admin/AdminSettingsScreen.js', 'utf8');

    // Confirm text inputs for start and end times were completely removed
    const hasTextInputStartTime = screenCode.includes('value={workStartTime}') && screenCode.includes('<TextInput');
    const hasTextInputEndTime = screenCode.includes('value={workEndTime}') && screenCode.includes('<TextInput');
    const hasTextInputWorkingDays = screenCode.includes('value={workingDays}') && screenCode.includes('<TextInput');

    assert(!hasTextInputStartTime, 'TEST G.1: Work Starts text input removed; replaced with touchable time picker button');
    assert(!hasTextInputEndTime, 'TEST G.2: Work Ends text input removed; replaced with touchable time picker button');
    assert(!hasTextInputWorkingDays, 'TEST G.3: Working Days text input removed; replaced with selectable day chips');

    // Confirm Time Picker Modal and 7 working days controls
    assert(screenCode.includes('timePickerBtn'), 'TEST G.4: Time picker button styling present');
    assert(screenCode.includes('timeModalCard') && screenCode.includes('digitalClockCard'), 'TEST G.5: Digital clock time picker modal implemented');
    assert(screenCode.includes('HOURS_12') && screenCode.includes('MINUTES_STEPS'), 'TEST G.6: Hour and minute selectors implemented');
    assert(screenCode.includes('daysGrid') && screenCode.includes('dayChipSelected'), 'TEST G.7: Seven selectable day chips implemented');
    assert(screenCode.includes('validationWarningBox'), 'TEST G.8: Inline warning for invalid shift timings implemented');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`PASSED:               ${passed}`);
  console.log(`FAILED:               ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

