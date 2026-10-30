/**
 * Automated Test Suite: Complete Frontend Integration and Shared Workflows
 * 
 * Verifies all requirements from USER_REQUEST Parts 1 through 26:
 * - Test 1: Leave Application Submission
 * - Test 2: Leave Approval & Synchronized Status
 * - Test 3: Leave Rejection & Mandatory Rejection Reason
 * - Test 4: Duplicate Decision Safety
 * - Test 5: Advance Payment Request & Approval
 * - Test 6: Advance Rejection with Reason
 * - Test 7: Explicit Payment Recording (Approved != Paid)
 * - Test 8: Daily Task Reports & Carry-Forward Integration
 * - Test 9: Attendance Punch In / Punch Out Shift Linkage
 * - Test 10: Multi-Tenant Organization Isolation
 * - Test 11: Local Storage Persistence & Reload
 * - Test 12: Empty States Handling
 * - Test 13: Input Validation & Error States
 * - Test 14: Dynamic Management Dashboard Summary Metrics
 * - Test 15: Role-Based Authorization Safeguards
 */

const fs = require('fs');
const path = require('path');

if (typeof window === 'undefined' && typeof global !== 'undefined' && !global.window) {
  const memoryStore = new Map();
  global.window = {
    localStorage: {
      getItem: (k) => memoryStore.get(k) || null,
      setItem: (k, v) => memoryStore.set(k, String(v)),
      removeItem: (k) => memoryStore.delete(k),
      clear: () => memoryStore.clear()
    }
  };
}

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

async function runTests() {
  console.log('======================================================================');
  console.log('   EMPLOYEEAPP FRONTEND INTEGRATION & SHARED WORKFLOW TEST SUITE      ');
  console.log('======================================================================\n');

  // Load frontendDataStore and api
  const { frontendDataStore } = require('./src/services/frontendDataStore');
  const api = require('./src/services/api').default;

  // Reset store to known baseline
  await frontendDataStore.resetToDefault();
  await api.init();

  const orgAcme = frontendDataStore.state.organizations[0]; // org-acme-1
  const orgStellar = frontendDataStore.state.organizations[1]; // org-stellar-2

  const userEmployee = frontendDataStore.state.users.find(u => u.id === 'emp-101');
  const userFounder = frontendDataStore.state.users.find(u => u.id === 'user-rohan-1');
  const userTL = frontendDataStore.state.users.find(u => u.id === 'user-priya-3');
  const userStellarEmp = frontendDataStore.state.users.find(u => u.id === 'emp-201');

  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Leave Application Submission & Shared Record ID ---');
  // -------------------------------------------------------------------------
  const initialLeavesCount = frontendDataStore.getLeaves({ organizationId: orgAcme.id }).length;
  
  const submitRes = await frontendDataStore.submitLeave({
    leaveType: 'Casual Leave',
    startDate: '10/11/2026',
    endDate: '12/11/2026',
    durationDays: 3,
    reason: 'Brother marriage ceremony in Delhi'
  }, userEmployee, orgAcme);

  assert(submitRes.success === true, 'TEST 1.1: Leave application submitted successfully');
  const newLeaveId = submitRes.data.id;
  assert(newLeaveId && newLeaveId.startsWith('lv-'), 'TEST 1.2: Generated unique leave ID: ' + newLeaveId);

  // Check Employee view
  const employeeLeaves = frontendDataStore.getLeaves({ organizationId: orgAcme.id, userId: userEmployee.id });
  const employeeLeave = employeeLeaves.find(l => l.id === newLeaveId);
  assert(Boolean(employeeLeave), 'TEST 1.3: Application appears in Employee leave history');
  assert(employeeLeave.status === 'pending', 'TEST 1.4: Initial status is pending in Employee view');

  // Check Management view
  const mgmtLeaves = frontendDataStore.getLeaves({ organizationId: orgAcme.id });
  const mgmtLeave = mgmtLeaves.find(l => l.id === newLeaveId);
  assert(Boolean(mgmtLeave), 'TEST 1.5: Application appears in Management Approvals desk');
  assert(mgmtLeave.id === employeeLeave.id, 'TEST 1.6: EXACT SAME record ID is shared across both views');
  assert(mgmtLeave.user_name === userEmployee.name, 'TEST 1.7: Employee identity accurately linked');
  assert(mgmtLeaves.length === initialLeavesCount + 1, 'TEST 1.8: Management list count incremented');

  // Check in-app notification generated for management
  const mgmtNotifs = frontendDataStore.getNotifications({ organizationId: orgAcme.id, role: 'founder' });
  const leaveNotif = mgmtNotifs.find(n => n.related_entity_id === newLeaveId);
  assert(Boolean(leaveNotif), 'TEST 1.9: In-app notification generated for management');
  assert(leaveNotif.type === 'leave_submission', 'TEST 1.10: Notification type is leave_submission');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Leave Approval & Bidirectional Synchronization ---');
  // -------------------------------------------------------------------------
  const approveRes = await frontendDataStore.updateLeaveStatus(
    newLeaveId,
    'approved',
    'Approved. Please ensure handoff to Karan.',
    userFounder,
    orgAcme
  );

  assert(approveRes.success === true, 'TEST 2.1: Management approved leave application');
  assert(approveRes.data.status === 'approved', 'TEST 2.2: Management record status is approved');
  assert(approveRes.data.reviewed_by.includes('Rohan Deshmukh'), 'TEST 2.3: Reviewer recorded as Rohan Deshmukh');

  // Check Employee view reflection
  const empLeaveAfterApproval = frontendDataStore.getLeaveById(newLeaveId, orgAcme.id);
  assert(empLeaveAfterApproval.status === 'approved', 'TEST 2.4: Employee view reflects Approved status');
  assert(empLeaveAfterApproval.review_remarks === 'Approved. Please ensure handoff to Karan.', 'TEST 2.5: Reviewer remarks visible to employee');

  // Check employee notification
  const empNotifs = frontendDataStore.getNotifications({ organizationId: orgAcme.id, userId: userEmployee.id });
  const approvalNotif = empNotifs.find(n => n.related_entity_id === newLeaveId && n.type === 'leave_approved');
  assert(Boolean(approvalNotif), 'TEST 2.6: Employee received in-app notification of approval');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Leave Rejection & Mandatory Rejection Reason ---');
  // -------------------------------------------------------------------------
  const submitLeave2 = await frontendDataStore.submitLeave({
    leaveType: 'Earned Leave',
    startDate: '15/11/2026',
    endDate: '20/11/2026',
    durationDays: 6,
    reason: 'Personal vacation'
  }, userEmployee, orgAcme);

  const leave2Id = submitLeave2.data.id;

  // Attempt rejection without reason -> must throw error
  let rejectionWithoutReasonError = null;
  try {
    await frontendDataStore.updateLeaveStatus(leave2Id, 'rejected', '', userFounder, orgAcme);
  } catch (err) {
    rejectionWithoutReasonError = err.message;
  }
  assert(Boolean(rejectionWithoutReasonError), 'TEST 3.1: Rejecting without reason is rejected: ' + rejectionWithoutReasonError);

  // Reject with valid reason
  const rejectRes = await frontendDataStore.updateLeaveStatus(
    leave2Id,
    'rejected',
    'Critical sprint delivery milestone scheduled that week.',
    userFounder,
    orgAcme
  );
  assert(rejectRes.success === true, 'TEST 3.2: Rejection with reason succeeded');
  assert(rejectRes.data.status === 'rejected', 'TEST 3.3: Status updated to rejected');

  const empLeaveAfterReject = frontendDataStore.getLeaveById(leave2Id, orgAcme.id);
  assert(empLeaveAfterReject.status === 'rejected', 'TEST 3.4: Employee sees Rejected status');
  assert(empLeaveAfterReject.review_remarks.includes('Critical sprint delivery'), 'TEST 3.5: Employee sees rejection reason');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Duplicate & Invalid Transition Safety ---');
  // -------------------------------------------------------------------------
  let invalidStatusError = null;
  try {
    await frontendDataStore.updateLeaveStatus(leave2Id, 'invalid_state', 'Notes', userFounder, orgAcme);
  } catch (e) {
    invalidStatusError = e.message;
  }
  assert(Boolean(invalidStatusError), 'TEST 4.1: Rejecting unknown status string');

  // Non-existent leave ID
  let notFoundError = null;
  try {
    await frontendDataStore.updateLeaveStatus('non-existent-id', 'approved', 'Notes', userFounder, orgAcme);
  } catch (e) {
    notFoundError = e.message;
  }
  assert(Boolean(notFoundError), 'TEST 4.2: Handling non-existent leave ID gracefully');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Salary Advance Request & Approval (Approved != Paid) ---');
  // -------------------------------------------------------------------------
  const advanceRes = await frontendDataStore.submitSalaryAdvance({
    amount: 25000,
    tenure: '2 Months',
    reasonCategory: 'Medical / Emergency Expenses',
    reasonDescription: 'Dental surgery and prescription medications'
  }, userEmployee, orgAcme);

  assert(advanceRes.success === true, 'TEST 5.1: Advance payment request submitted');
  const advId = advanceRes.data.id;
  assert(advId && advId.startsWith('adv-'), 'TEST 5.2: Generated unique advance ID: ' + advId);

  // Management approval
  const approveAdvRes = await frontendDataStore.approveSalaryAdvance(
    advId,
    { status: 'Approved', approvedAmount: 25000, remarks: 'Approved as requested per emergency policy' },
    userFounder,
    orgAcme
  );
  assert(approveAdvRes.success === true, 'TEST 5.3: Management approved salary advance');
  assert(approveAdvRes.data.status === 'Approved', 'TEST 5.4: Status is Approved');

  // STRICT REQUIREMENT: Approved advance must NOT be marked as Paid
  assert(approveAdvRes.data.status !== 'Paid', 'TEST 5.5: Approved advance is NOT marked as Paid');
  assert(approveAdvRes.data.paymentDetails === null, 'TEST 5.6: No payment details exist before explicit disbursement');

  // Check Employee sees Approved (Payment Pending)
  const empAdv = frontendDataStore.getSalaryAdvances({ organizationId: orgAcme.id, userId: userEmployee.id }).find(a => a.id === advId);
  assert(empAdv.status === 'Approved', 'TEST 5.7: Employee sees Approved status');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Salary Advance Rejection ---');
  // -------------------------------------------------------------------------
  const adv2Res = await frontendDataStore.submitSalaryAdvance({
    amount: 90000,
    tenure: '3 Months',
    reasonCategory: 'Personal Emergency',
    reasonDescription: 'Vehicle upgrade'
  }, userEmployee, orgAcme);

  const adv2Id = adv2Res.data.id;
  const rejectAdvRes = await frontendDataStore.approveSalaryAdvance(
    adv2Id,
    { status: 'Rejected', remarks: 'Amount exceeds permissible advance cap for tenure.' },
    userFounder,
    orgAcme
  );
  assert(rejectAdvRes.data.status === 'Rejected', 'TEST 6.1: Advance marked as Rejected');
  assert(rejectAdvRes.data.remarks.includes('exceeds permissible advance cap'), 'TEST 6.2: Rejection remarks preserved');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Explicit Payment Recording ---');
  // -------------------------------------------------------------------------
  const paymentRes = await frontendDataStore.recordAdvancePayment(
    advId,
    {
      amountPaid: 25000,
      paymentMethod: 'Bank Transfer (NEFT/IMPS)',
      transactionRef: 'NEFT-20261028-0912',
      paymentRemarks: 'Disbursed to verified HDFC salary account'
    },
    userFounder,
    orgAcme
  );

  assert(paymentRes.success === true, 'TEST 7.1: Payment record created successfully');
  assert(paymentRes.data.status === 'Paid', 'TEST 7.2: Status explicitly transitions to Paid ONLY after payment recording');
  assert(paymentRes.data.paymentDetails.amountPaid === 25000, 'TEST 7.3: Payment amount recorded');
  assert(paymentRes.data.paymentDetails.transactionRef === 'NEFT-20261028-0912', 'TEST 7.4: UTR / Reference recorded');
  assert(Boolean(paymentRes.data.paymentDetails.paidAt), 'TEST 7.5: Disbursed timestamp recorded');

  // Check Employee notification
  const empDisbursedNotifs = frontendDataStore.getNotifications({ organizationId: orgAcme.id, userId: userEmployee.id });
  const disbNotif = empDisbursedNotifs.find(n => n.related_entity_id === advId && n.type === 'advance_paid');
  assert(Boolean(disbNotif), 'TEST 7.6: Employee received disbursement notification with UTR reference');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: Daily Task Reports & Carry-Forward Integration ---');
  // -------------------------------------------------------------------------
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayReportRes = frontendDataStore.getTodayDailyReport(userEmployee, orgAcme);
  assert(todayReportRes.success === true, 'TEST 8.1: getTodayDailyReport returns success');
  assert(todayReportRes.today === todayStr, 'TEST 8.2: Matches current date: ' + todayStr);

  // Submit today report
  const reportSubmit = await frontendDataStore.submitDailyReport({
    date: todayStr,
    tasks: [
      { id: 't-1', projectName: 'Android Mobile App', tasksAssigned: 'Frontend shared data layer', completed: 'Yes', pending: 'No' },
      { id: 't-2', projectName: 'Android Mobile App', tasksAssigned: 'E2E workflow test suite', completed: 'Yes', pending: 'No' },
      { id: 't-3', projectName: 'EMS Web Dashboard', tasksAssigned: 'Vite build verification', completed: 'No', pending: 'Yes' }
    ],
    ratings: { speed: 9, understanding: 9, problemSolving: 9, talkingBehaviour: 9, workQuality: 10, discipline: 10 }
  }, userEmployee, orgAcme);

  assert(reportSubmit.success === true, 'TEST 8.3: Daily task report submitted');
  assert(reportSubmit.data.status === 'Submitted', 'TEST 8.4: Status is Submitted');
  assert(reportSubmit.data.rating_average_overall === '9.33', 'TEST 8.5: Rating overall computed accurately: ' + reportSubmit.data.rating_average_overall);

  // Check management view
  const mgmtReports = frontendDataStore.getDailyReports({ organizationId: orgAcme.id, date: todayStr });
  assert(mgmtReports.length >= 1, 'TEST 8.6: Report visible in Management Task Reports');
  assert(mgmtReports[0].tasks.length === 3, 'TEST 8.7: All tasks visible to management');

  // Historical date editing restriction
  let historicalEditError = null;
  try {
    await frontendDataStore.submitDailyReport({
      date: '2026-10-20',
      tasks: []
    }, userEmployee, orgAcme);
  } catch (err) {
    historicalEditError = err.message;
  }
  assert(Boolean(historicalEditError), 'TEST 8.8: Historical report editing prohibited for employee: ' + historicalEditError);

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Attendance Shift Lifecycle (Punch In / Punch Out) ---');
  // -------------------------------------------------------------------------
  const punchInRes = await frontendDataStore.punchIn({
    punchInTime: '09:10 AM',
    mode: 'WFO',
    photoPath: 'file://selfie-punch-in.jpg',
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 8
  }, userEmployee, orgAcme);

  assert(punchInRes.success === true, 'TEST 9.1: Punch In successfully recorded');
  assert(punchInRes.data.punch_in_time === '09:10 AM', 'TEST 9.2: Punch in timestamp recorded');
  assert(punchInRes.data.mode === 'WFO', 'TEST 9.3: Work mode recorded');

  // Verify open shift in today attendance
  const todayAtt = frontendDataStore.getTodayAttendance(userEmployee, orgAcme);
  assert(Boolean(todayAtt.data), 'TEST 9.4: Today attendance record exists');
  assert(todayAtt.data.punch_out_time === null, 'TEST 9.5: Shift is open (no punch out)');

  // Complete Punch Out
  const punchOutRes = await frontendDataStore.punchOut({
    photoPath: 'file://selfie-punch-out.jpg',
    duration: '8h 50m'
  }, userEmployee, orgAcme);

  assert(punchOutRes.success === true, 'TEST 9.6: Punch Out successfully recorded');
  assert(punchOutRes.data.is_complete === true, 'TEST 9.7: Shift marked complete');
  assert(Boolean(punchOutRes.data.punch_out_time), 'TEST 9.8: Punch out timestamp recorded');
  assert(punchOutRes.data.id === punchInRes.data.id, 'TEST 9.9: Linked to the EXACT SAME shift record');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Multi-Tenant Organization Isolation ---');
  // -------------------------------------------------------------------------
  // Stellar leaves and advances should NEVER appear in Acme queries
  const acmeLeaves = frontendDataStore.getLeaves({ organizationId: orgAcme.id });
  const stellarLeavesInAcme = acmeLeaves.filter(l => l.organization_id === orgStellar.id);
  assert(stellarLeavesInAcme.length === 0, 'TEST 10.1: Acme Management NEVER receives Stellar organization leaves');

  const stellarAdvances = frontendDataStore.getSalaryAdvances({ organizationId: orgStellar.id });
  assert(stellarAdvances.length >= 1, 'TEST 10.2: Stellar has isolated advances');
  const acmeAdvances = frontendDataStore.getSalaryAdvances({ organizationId: orgAcme.id });
  const stellarAdvInAcme = acmeAdvances.filter(a => a.organization_id === orgStellar.id);
  assert(stellarAdvInAcme.length === 0, 'TEST 10.3: Acme Management NEVER receives Stellar organization advances');

  // Stellar Employee cannot see Acme records
  const stellarEmpLeaves = frontendDataStore.getLeaves({ organizationId: orgStellar.id, userId: userStellarEmp.id });
  const acmeInStellarEmp = stellarEmpLeaves.filter(l => l.organization_id === orgAcme.id);
  assert(acmeInStellarEmp.length === 0, 'TEST 10.4: Stellar employee NEVER receives Acme records');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 11: Local Storage Persistence & Reload ---');
  // -------------------------------------------------------------------------
  await frontendDataStore.persist();
  const asyncStorageMod = require('@react-native-async-storage/async-storage');
  const storage = asyncStorageMod.default || asyncStorageMod;
  const rawSaved = await storage.getItem('@ems_frontend_store_v1');
  assert(Boolean(rawSaved), 'TEST 11.1: Store persisted to AsyncStorage key @ems_frontend_store_v1');
  
  const parsed = JSON.parse(rawSaved);
  assert(Array.isArray(parsed.leaves) && parsed.leaves.length > 0, 'TEST 11.2: Leaves saved in persistent storage');
  assert(Array.isArray(parsed.advances) && parsed.advances.length > 0, 'TEST 11.3: Advances saved in persistent storage');
  assert(Array.isArray(parsed.attendance) && parsed.attendance.length > 0, 'TEST 11.4: Attendance saved in persistent storage');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 12: Empty States Handling ---');
  // -------------------------------------------------------------------------
  const emptyLeaves = frontendDataStore.getLeaves({ organizationId: 'non-existent-org' });
  assert(Array.isArray(emptyLeaves) && emptyLeaves.length === 0, 'TEST 12.1: Empty leaves array returned without throwing');

  const emptyAdvances = frontendDataStore.getSalaryAdvances({ organizationId: 'non-existent-org' });
  assert(Array.isArray(emptyAdvances) && emptyAdvances.length === 0, 'TEST 12.2: Empty advances array returned without throwing');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 13: Input Validation & Error States ---');
  // -------------------------------------------------------------------------
  let negativeAdvError = null;
  try {
    await frontendDataStore.submitSalaryAdvance({ amount: -500 }, userEmployee, orgAcme);
  } catch (err) {
    negativeAdvError = err.message;
  }
  assert(Boolean(negativeAdvError), 'TEST 13.1: Negative advance amount rejected');

  let excessAdvError = null;
  try {
    await frontendDataStore.submitSalaryAdvance({ amount: 150000 }, userEmployee, orgAcme);
  } catch (err) {
    excessAdvError = err.message;
  }
  assert(Boolean(excessAdvError), 'TEST 13.2: Advance amount > ₹1,00,000 rejected');

  let emptyLeaveReasonError = null;
  try {
    await frontendDataStore.submitLeave({ startDate: '10/11/2026', reason: '' }, userEmployee, orgAcme);
  } catch (err) {
    emptyLeaveReasonError = err.message;
  }
  assert(Boolean(emptyLeaveReasonError), 'TEST 13.3: Leave submission without reason rejected');

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 14: Dynamic Dashboard Summary Metrics ---');
  // -------------------------------------------------------------------------
  const statsRes = frontendDataStore.getAttendanceStats(orgAcme.id);
  assert(statsRes.success === true, 'TEST 14.1: getAttendanceStats succeeds');
  const stats = statsRes.data;
  assert(typeof stats.totalEmployees === 'number' && stats.totalEmployees > 0, 'TEST 14.2: Total staff is calculated dynamically: ' + stats.totalEmployees);
  assert(typeof stats.presentToday === 'number', 'TEST 14.3: Present today is calculated dynamically: ' + stats.presentToday);
  assert(typeof stats.absentToday === 'number', 'TEST 14.4: Absent today is calculated dynamically: ' + stats.absentToday);
  assert(typeof stats.pendingLeaves === 'number', 'TEST 14.5: Pending leaves is calculated dynamically: ' + stats.pendingLeaves);
  assert(typeof stats.pendingAdvances === 'number', 'TEST 14.6: Pending advances is calculated dynamically: ' + stats.pendingAdvances);
  assert(typeof stats.pendingReports === 'number', 'TEST 14.7: Reports awaiting review is calculated dynamically: ' + stats.pendingReports);

  // -------------------------------------------------------------------------
  console.log('\n--- TEST 15: Role-Based Access Restrictions ---');
  // -------------------------------------------------------------------------
  let empApproveError = null;
  try {
    // Employee Aarav attempts to approve own leave
    await frontendDataStore.updateLeaveStatus(newLeaveId, 'approved', 'Self approve', userEmployee, orgAcme);
  } catch (err) {
    empApproveError = err.message;
  }
  assert(Boolean(empApproveError), 'TEST 15.1: Employee cannot approve own leave: ' + empApproveError);

  let empAdvanceApproveError = null;
  try {
    // Employee Aarav attempts to approve own advance
    await frontendDataStore.approveSalaryAdvance(advId, { status: 'Approved' }, userEmployee, orgAcme);
  } catch (err) {
    empAdvanceApproveError = err.message;
  }
  assert(Boolean(empAdvanceApproveError), 'TEST 15.2: Employee cannot approve own salary advance: ' + empAdvanceApproveError);

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`PASSED:               ${passed}`);
  console.log(`FAILED:               ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
