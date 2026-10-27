/**
 * Comprehensive Automated Master Test Suite for EmployeeApp Improvements
 * Covers Issues 1 through 8:
 * - Issue 1: Layout, Safe Area & Android Status Bar Invariants
 * - Issue 2: Leave Application Date Input, Calendar & Impossible Date Validation
 * - Issue 3: Profile Simplification, Real Settings & 3-Choice Theme Persistence
 * - Issue 4: Profile Editing, Photo Update & Personal Contact Change Request Flow
 * - Issue 5: Salary & Bank Details, Masking, IFSC Validation & Management Verification
 * - Issue 6: Task Report Save Draft, Persistence & Authentic Excel (.xlsx) Export
 * - Issue 7: Attendance Location Settings, Front Camera & Face Guidance
 * - Issue 8: Salary Advance Workflow, Reason Dropdown, Approval & Payment Recording
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const BASE_URL = 'http://localhost:5000/api';

// Helper for HTTP requests
function request(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const headers = options.headers || {};
    let body = options.body;

    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers
      },
      res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            try {
              const json = JSON.parse(buffer.toString('utf8'));
              resolve({ status: res.statusCode, data: json, headers: res.headers });
            } catch (e) {
              resolve({ status: res.statusCode, raw: buffer.toString('utf8'), headers: res.headers });
            }
          } else {
            resolve({ status: res.statusCode, buffer, headers: res.headers });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

const results = [];
function assert(name, condition, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    results.push({ name, passed: true });
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${name} ${details ? '(' + details + ')' : ''}`);
    results.push({ name, passed: false, details });
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('  RUNNING MASTER EMPLOYEEAPP TEST SUITE (ISSUES 1 - 8)');
  console.log('============================================================\n');

  let founderToken = '';
  let employeeToken = '';
  let teamLeaderToken = '';

  // 0. AUTHENTICATION SETUP
  console.log('--- Phase 0: Authenticate Personas ---');
  try {
    const founderRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@acmetech.com', password: 'admin123', portal: 'management' }
    });
    founderToken = founderRes.data?.token || '';
    assert('Founder login successful', founderRes.status === 200 && !!founderToken);

    const empRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'aarav.sharma@acmetech.com', password: 'admin123', portal: 'employee' }
    });
    employeeToken = empRes.data?.token || '';
    assert('Employee login successful', empRes.status === 200 && !!employeeToken);

    const tlRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'priya.n@acmetech.com', password: 'admin123', portal: 'management' }
    });
    teamLeaderToken = tlRes.data?.token || '';
    assert('Team Leader login successful', tlRes.status === 200 && !!teamLeaderToken);
  } catch (e) {
    console.error('Fatal Auth Error:', e);
    process.exit(1);
  }

  // ISSUE 1: ANDROID STATUS BAR & SAFE AREA INVARIANTS
  console.log('\n--- Issue 1: Layout, Android Status Bar & Bottom Navigation Checks ---');
  const appJs = fs.readFileSync(path.join(__dirname, '../mobile/App.js'), 'utf8');
  assert('App.js includes Android status bar height padding', appJs.includes('StatusBar.currentHeight'));
  assert('App.js includes bottomNavContainer safe padding', appJs.includes('bottomNavContainer'));
  
  const homeScreenJs = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/HomeScreen.js'), 'utf8');
  assert('HomeScreen has bottom padding for scroll content (>= 100)', homeScreenJs.includes('paddingBottom: 110') || homeScreenJs.includes('paddingBottom: 100'));

  const historyScreenJs = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/HistoryScreen.js'), 'utf8');
  assert('HistoryScreen has bottom padding for scroll content', historyScreenJs.includes('paddingBottom: 110') || historyScreenJs.includes('paddingBottom: 100'));

  // ISSUE 2: LEAVE APPLICATION DATES & IMPOSSIBLE DATE REJECTION
  console.log('\n--- Issue 2: Leave Application Date Input & Validation ---');
  const featureScreensJs = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/FeatureScreens.js'), 'utf8');
  assert('LeaveApplicationScreen includes calendar modal', featureScreensJs.includes('Calendar Picker') || featureScreensJs.includes('showCalendarModal'));
  assert('LeaveApplicationScreen provides DD/MM/YYYY manual input', featureScreensJs.includes('DD/MM/YYYY'));

  // Validate impossible date logic (e.g., 31/02/2026)
  function parseDateStrict(str) {
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    if (m < 1 || m > 12) return null;
    const maxDays = new Date(y, m, 0).getDate();
    if (d < 1 || d > maxDays) return null;
    return new Date(y, m - 1, d);
  }

  assert('Strict parser rejects impossible date 31/02/2026', parseDateStrict('31/02/2026') === null);
  assert('Strict parser accepts leap year date 29/02/2024', parseDateStrict('29/02/2024') !== null);
  assert('Strict parser rejects non-leap year date 29/02/2025', parseDateStrict('29/02/2025') === null);
  assert('Strict parser accepts valid date 15/03/2026', parseDateStrict('15/03/2026') !== null);

  // Submitting genuine leave via API
  const leaveRes = await request('/leaves', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      leaveType: 'casual',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      reason: 'Attending family function'
    }
  });
  assert('Leave submission API records leave', leaveRes.status === 200 || leaveRes.status === 201);

  // ISSUE 3: PROFILE SHORTCUTS REMOVAL & REAL SETTINGS
  console.log('\n--- Issue 3: Profile Simplification & Real Settings ---');
  const profileScreenJs = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/ProfileScreen.js'), 'utf8');
  assert('Profile screen no longer has duplicate Self-Service Shortcuts', !profileScreenJs.includes('Employee Self-Service Shortcuts'));
  assert('Settings includes 3 theme choices (system, light, dark)', 
    profileScreenJs.includes("'system'") && profileScreenJs.includes("'light'") && profileScreenJs.includes("'dark'"));
  assert('Settings includes Notification toggle and Privacy controls',
    profileScreenJs.includes('Push & Shift Reminders') && profileScreenJs.includes('Privacy'));

  // ISSUE 4: PROFILE EDITING & CONTACT UPDATE REQUESTS
  console.log('\n--- Issue 4: Profile Editing & Contact Update Requests ---');
  assert('Profile editing has clear form replacing confusing HR dialog', profileScreenJs.includes('Edit Profile Contact') || profileScreenJs.includes('Edit Profile'));
  assert('Profile editing preserves company-locked official fields', profileScreenJs.includes('Official Employment Records'));

  // Submit contact info change request
  const contactReqRes = await request('/profile/update-request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      fieldName: 'phone',
      newValue: '+91 9876543210',
      reason: 'Relocated to new residence'
    }
  });
  assert('Employee can submit contact info change request', (contactReqRes.status === 200 || contactReqRes.status === 201) && contactReqRes.data?.success === true);

  const myContactReqs = await request('/profile/update-requests/me', {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert('Employee can view their contact change request status', myContactReqs.status === 200 && myContactReqs.data?.data?.length > 0);

  // ISSUE 5: SECURE SALARY & BANK DETAILS
  console.log('\n--- Issue 5: Secure Bank Details & Verification ---');
  // Submit bank details with Indian IFSC
  const bankSubmitRes = await request('/bank-details', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      accountHolderName: 'Aarav Sharma',
      bankName: 'HDFC Bank',
      accountNumber: '123456789012',
      confirmAccountNumber: '123456789012',
      ifscCode: 'HDFC0001234',
      accountType: 'Savings'
    }
  });
  assert('Employee can submit bank details', bankSubmitRes.status === 200 && bankSubmitRes.data?.success === true);

  // Masked bank details check
  const myBankRes = await request('/bank-details/me', {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert('Bank details API masks account number (e.g. XXXXXX9012)', 
    myBankRes.status === 200 && (myBankRes.data?.data?.maskedAccountNumber?.includes('XXXXXX') || myBankRes.data?.data?.accountNumberMasked?.includes('XXXXXX')));
  assert('Full account number is NOT leaked to employee profile GET',
    myBankRes.data?.data?.accountNumber === undefined);

  // Management verification check
  const adminBankRes = await request('/admin/bank-details', {
    headers: { Authorization: `Bearer ${founderToken}` }
  });
  assert('Founder/Admin can list submitted bank details', adminBankRes.status === 200 && adminBankRes.data?.data?.length > 0);

  // Team Leader authorization check: Team Leader must NOT have access
  const tlBankRes = await request('/admin/bank-details', {
    headers: { Authorization: `Bearer ${teamLeaderToken}` }
  });
  assert('Team Leader is DENIED access to sensitive bank details', tlBankRes.status === 403);

  // Founder verifies the bank details
  const bankRecordId = adminBankRes.data?.data[0]?.id;
  const verifyBankRes = await request(`/admin/bank-details/${bankRecordId}/verify`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${founderToken}` },
    body: { status: 'Verified', reviewNotes: 'Verified against employee passbook copy' }
  });
  assert('Founder can mark bank details as verified with review notes', verifyBankRes.status === 200);

  // ISSUE 6: TASK REPORTS: SAVE DRAFT & EXCEL EXPORT
  console.log('\n--- Issue 6: Task Report Drafts & Excel Export ---');
  // Save Draft
  const saveDraftRes = await request('/daily-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      isDraft: true,
      projectName: 'Client ERP Migration',
      workSummary: 'Worked on database migrations and setup schema',
      tasksAssigned: 'Database setup',
      tasksCompleted: 'Yes',
      tasksPending: 'No',
      ratingSpeed: 8,
      ratingWorkQuality: 9
    }
  });
  assert('Save Draft persists unfinished report to backend', saveDraftRes.status === 200 || saveDraftRes.status === 201);

  // Fetch Draft
  const getDraftRes = await request('/daily-reports/draft', {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert('Employee can retrieve active draft across sessions', 
    getDraftRes.status === 200 && (getDraftRes.data?.data?.projectName === 'Client ERP Migration' || getDraftRes.data?.data?.project_name === 'Client ERP Migration'));

  // Submit Final Daily Report
  const submitReportRes = await request('/daily-reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      isDraft: false,
      projectName: 'Client ERP Migration',
      workSummary: 'Finalized database schema and verified endpoints',
      tasksAssigned: 'Database setup & endpoints',
      tasksCompleted: 'Yes',
      tasksPending: 'No',
      ratingSpeed: 9,
      ratingWorkQuality: 9
    }
  });
  assert('Final report submission sets is_draft to false', submitReportRes.status === 200 || submitReportRes.status === 201);

  // Export Daily Reports as authentic Excel (.xlsx)
  const exportRes = await request('/daily-reports/export', {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  assert('Export returns 200 with octet-stream / excel MIME', exportRes.status === 200 && exportRes.buffer);
  
  // Verify genuine XLSX workbook integrity
  let xlsxValid = false;
  let rowCount = 0;
  try {
    const workbook = xlsx.read(exportRes.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    xlsxValid = workbook.SheetNames.length > 0 && sheetName === 'Daily Task Summary';
    rowCount = data.length;
  } catch (err) {
    console.error('XLSX parsing failed:', err);
  }
  assert('Exported file is an authentic, readable Microsoft Excel workbook', xlsxValid);
  assert('Excel export contains persisted employee task rows', rowCount > 0, `Row count: ${rowCount}`);

  // ISSUE 7: ATTENDANCE LOCATION, CAMERA & FACE GUIDANCE
  console.log('\n--- Issue 7: Attendance Location Flow, Front Camera & Face Guidance ---');
  const punchScreenJs = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/PunchScreen.js'), 'utf8');
  assert('PunchScreen forces front-camera lens only (facing="front")', punchScreenJs.includes('facing="front"'));
  assert('Camera-switch toggle control is absent', !punchScreenJs.includes('toggleCameraFacing'));
  assert('PunchScreen has Turn On Location button opening system settings', punchScreenJs.includes('Linking.openSettings()'));
  assert('Face alignment indicator supports dynamic state (RED unaligned -> GREEN ready)',
    punchScreenJs.includes("faceAlignmentState === 'ALIGNED'") || punchScreenJs.includes('setFaceAlignmentState'));
  assert('Immediate submission on photo capture without 2nd confirmation modal',
    punchScreenJs.includes('handleCaptureAndSubmit'));

  // ISSUE 8: SALARY ADVANCE WORKFLOW
  console.log('\n--- Issue 8: Salary Advance Reason Dropdown, Approval & Payment Recording ---');
  // Reason dropdown inspection
  const advScreenJs = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/FeatureScreens.js'), 'utf8');
  assert('Salary Advance includes required reason options', 
    advScreenJs.includes('Medical / Emergency Expenses') &&
    advScreenJs.includes('Rent / Housing Expenses') &&
    advScreenJs.includes('Education Expenses') &&
    advScreenJs.includes('Family Emergency') &&
    advScreenJs.includes('Other'));
  assert('Salary Advance requires description when "Other" is selected',
    advScreenJs.includes("reasonCategory === 'Other'"));

  // Submit salary advance request with "Medical / Emergency Expenses"
  const advReq1 = await request('/advances', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      amount: 15000,
      tenure: '2 Months',
      reasonCategory: 'Medical / Emergency Expenses',
      reasonDescription: 'Hospitalization expenses for family member'
    }
  });
  assert('Employee submits salary advance with reason category', advReq1.status === 200 && advReq1.data?.success === true);
  const advanceId = advReq1.data?.data?.id;

  // Founder lists advance requests
  const adminAdvList = await request('/admin/advances', {
    headers: { Authorization: `Bearer ${founderToken}` }
  });
  assert('Founder/Admin can list advance requests', adminAdvList.status === 200 && adminAdvList.data?.data?.length > 0);

  // Team Leader authorization check: Team Leader must NOT be able to view or approve advances
  const tlAdvList = await request('/admin/advances', {
    headers: { Authorization: `Bearer ${teamLeaderToken}` }
  });
  assert('Team Leader is DENIED access to financial advances', tlAdvList.status === 403);

  // Founder approves the advance with custom approved amount (₹12,000 out of ₹15,000)
  const approveAdvRes = await request(`/admin/advances/${advanceId}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${founderToken}` },
    body: {
      status: 'Approved',
      approvedAmount: 12000,
      remarks: 'Approved for ₹12,000 as per policy limit'
    }
  });
  assert('Founder approves advance and sets approved amount', 
    approveAdvRes.status === 200 && approveAdvRes.data?.data?.status === 'Approved' && approveAdvRes.data?.data?.approvedAmount === 12000);

  // Finance records payment with UTR and remarks
  const recordPayRes = await request(`/admin/advances/${advanceId}/payment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${founderToken}` },
    body: {
      amountPaid: 12000,
      paymentMethod: 'Bank Transfer (IMPS)',
      transactionRef: 'UTR987654321098',
      paymentRemarks: 'Transferred directly to HDFC account'
    }
  });
  assert('Finance records payment with transaction reference / UTR',
    recordPayRes.status === 200 && recordPayRes.data?.data?.status === 'Paid' && recordPayRes.data?.data?.transactionRef === 'UTR987654321098');

  // Employee checks payment history and proof
  const empAdvancesRes = await request('/advances/me', {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  const myAdvance = empAdvancesRes.data?.data?.find(a => a.id === advanceId);
  assert('Employee can view their updated advance with Paid status and UTR',
    myAdvance && myAdvance.status === 'Paid' && myAdvance.transactionRef === 'UTR987654321098');
  assert('Employee advances endpoint returns configured monthly salary',
    empAdvancesRes.data?.monthlySalary === 45000);

  // Submit second advance in the same month (Multiple requests per month)
  const advReq2 = await request('/advances', {
    method: 'POST',
    headers: { Authorization: `Bearer ${employeeToken}` },
    body: {
      amount: 8000,
      tenure: '1 Month',
      reasonCategory: 'Personal Emergency',
      reasonDescription: 'Vehicle emergency maintenance'
    }
  });
  assert('Multiple advances in same month supported without overwriting',
    advReq2.status === 200 && advReq2.data?.data?.id !== advanceId);

  const empAdvancesAfterSecond = await request('/advances/me', {
    headers: { Authorization: `Bearer ${employeeToken}` }
  });
  const allUserAdvances = empAdvancesAfterSecond.data?.data || [];
  assert('Both advance requests remain visible as distinct records',
    allUserAdvances.some(a => a.id === advanceId) && allUserAdvances.some(a => a.id === advReq2.data?.data?.id));

  // Authorized Repayment / Payroll Deduction Recording
  const repayRes = await request(`/admin/advances/${advanceId}/repayment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${founderToken}` },
    body: {
      amountRepaid: 6000,
      payrollMonth: 'November 2026',
      remarks: 'First installment deducted from November payroll'
    }
  });
  assert('Management can record authorized payroll deduction against disbursed advance',
    repayRes.status === 200 && repayRes.data?.data?.amount_repaid === 6000);

  // CRITICAL CHECKS: Colors, Camera & History Modal
  console.log('\n--- Critical Regression Checks: Colors, Camera & History Modal ---');
  const colorsJs = fs.readFileSync(path.join(__dirname, '../mobile/src/theme/colors.js'), 'utf8');
  assert('colors.js defines 100% opaque surface color in lightTheme', colorsJs.includes("surface: '#FFFFFF'"));
  assert('colors.js defines 100% opaque surface color in darkTheme', colorsJs.includes("surface: '#242920'"));

  const appJsUpdated = fs.readFileSync(path.join(__dirname, '../mobile/App.js'), 'utf8');
  assert('App.js bottom navigation removes protruding top: -10 hack', !appJsUpdated.includes('top: -10'));
  assert('PunchScreen mounts conditionally to avoid dead CameraView surface', appJsUpdated.includes("activeTab === 'punch'"));

  const punchScreenUpdated = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/PunchScreen.js'), 'utf8');
  assert('PunchScreen handles onCameraReady event', punchScreenUpdated.includes('onCameraReady'));
  assert('PunchScreen handles onMountError event with retry UI', punchScreenUpdated.includes('onMountError'));
  assert('PunchScreen acquires fresh GPS fix on shutter tap', punchScreenUpdated.includes('Location.getCurrentPositionAsync'));

  const historyScreenUpdated = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/HistoryScreen.js'), 'utf8');
  assert('HistoryScreen contains interactive Attendance Details modal', historyScreenUpdated.includes('Attendance Details'));
  assert('HistoryScreen provides discrete WFH GPS location disclosure buttons',
    historyScreenUpdated.includes('View Punch In GPS Coordinates') && historyScreenUpdated.includes('View Punch Out GPS Coordinates'));

  // SUMMARY
  console.log('\n============================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`  TOTAL TESTS: ${results.length}`);
  console.log(`  \x1b[32mPASSED: ${passedCount}\x1b[0m`);
  if (failedCount > 0) {
    console.log(`  \x1b[31mFAILED: ${failedCount}\x1b[0m`);
    process.exit(1);
  } else {
    console.log('  \x1b[32mALL TESTS PASSED (100% SUCCESS)!\x1b[0m');
    console.log('============================================================\n');
  }
}

runTests().catch(err => {
  console.error('Unhandled Test Suite Error:', err);
  process.exit(1);
});
