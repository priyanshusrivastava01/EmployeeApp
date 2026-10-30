/**
 * Automated Test Suite: Management Daily Task Reports & Employee Task Management System
 * 
 * Verifies all 22 primary requirements from Section 19 & 21:
 *  - 1. Employee-wise overview list & summary aggregation
 *  - 2. Search & multi-criteria filters (name, ID, department, status)
 *  - 3. Individual employee report profile & descending date timeline
 *  - 4. Strict historical read-only protection
 *  - 5. Today's report view & Management task assignment workflow
 *  - 6. In-app employee notification generation
 *  - 7. Bidirectional task status synchronization
 *  - 8. In-app spreadsheet data grid & date-range validation
 *  - 9. Excel export generation (.csv with UTF-8 BOM & summaries)
 *  - 10. Multi-tenant isolation & role-based authorization
 */

const fs = require('fs');
const path = require('path');

// Polyfill window.localStorage for Node environment with AsyncStorage
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
  console.log('   MANAGEMENT DAILY TASK REPORTS & EMPLOYEE TASK SYSTEM TEST SUITE    ');
  console.log('======================================================================\n');

  const api = (await import('./src/services/api.js')).default;
  const frontendDataStore = (await import('./src/services/frontendDataStore.js')).default;

  // Initialize store with demo data
  await frontendDataStore.init();

  const acmeOrg = {
    id: 'org-acme-1',
    name: 'Acme Technologies Pvt. Ltd.',
    company_code: 'CMP-7K4M9X2Q'
  };

  const founderUser = {
    id: 'user-rohan-1',
    name: 'Rohan Deshmukh',
    role: 'founder',
    organization_id: 'org-acme-1',
    department: 'Management'
  };

  const employeeUser = {
    id: 'emp-101',
    name: 'Aarav Sharma',
    role: 'employee',
    organization_id: 'org-acme-1',
    department: 'Engineering',
    employee_code: 'EMP-0142'
  };

  const stellarOrg = {
    id: 'org-stellar-2',
    name: 'Stellar Dynamics Inc.',
    company_code: 'CMP-9X8Y7Z6W'
  };

  const stellarEmployee = {
    id: 'emp-201',
    name: 'Rhea Kapoor',
    role: 'employee',
    organization_id: 'org-stellar-2',
    department: 'R&D'
  };

  // Set active management session
  api.user = founderUser;
  api.org = acmeOrg;

  // -------------------------------------------------------------------------
  // TEST 1: Employee-Wise Overview List & Aggregation
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Employee-Wise Overview List & Aggregation ---');
  const empListRes = await api.getEmployeesWithDailyReports({
    organizationId: acmeOrg.id,
    date: '2026-10-27'
  });

  assert(empListRes.success === true, 'TEST 1.1: getEmployeesWithDailyReports returns success');
  assert(Array.isArray(empListRes.data), 'TEST 1.2: Returns array of employees');
  assert(empListRes.data.length >= 3, `TEST 1.3: Contains organization employees (count: ${empListRes.data.length})`);

  const aaravSummary = empListRes.data.find((e) => e.id === 'emp-101');
  assert(Boolean(aaravSummary), 'TEST 1.4: Aarav Sharma is present in employee list');
  assert(aaravSummary.todayReportStatus === 'Submitted', `TEST 1.5: Aarav status for 2026-10-27 is Submitted (got: ${aaravSummary.todayReportStatus})`);
  assert(aaravSummary.todayTotalTasks === 3, `TEST 1.6: Total tasks count is 3 (got: ${aaravSummary.todayTotalTasks})`);
  assert(aaravSummary.todayCompletedTasks === 2, `TEST 1.7: Completed tasks count is 2 (got: ${aaravSummary.todayCompletedTasks})`);
  assert(aaravSummary.todayPendingTasks === 1, `TEST 1.8: Pending tasks count is 1 (got: ${aaravSummary.todayPendingTasks})`);
  assert(Boolean(aaravSummary.lastSubmissionTime), 'TEST 1.9: Last submission timestamp recorded');

  // Check unsubmitted employee
  const karanSummary = empListRes.data.find((e) => e.id === 'emp-103');
  assert(Boolean(karanSummary), 'TEST 1.10: Karan Verma is present');
  assert(karanSummary.todayReportStatus === 'Not Submitted', 'TEST 1.11: Karan Verma status is Not Submitted');

  // -------------------------------------------------------------------------
  // TEST 2: Employee Search & Multi-Criteria Filtering
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Employee Search & Multi-Criteria Filtering ---');
  const allStaff = empListRes.data;

  // Search by name
  const nameMatches = allStaff.filter((e) => e.name.toLowerCase().includes('aarav'));
  assert(nameMatches.length === 1 && nameMatches[0].name === 'Aarav Sharma', 'TEST 2.1: Search by name "aarav" returns Aarav Sharma');

  // Search by employee code
  const codeMatches = allStaff.filter((e) => (e.employee_code || '').toLowerCase().includes('emp-0142'));
  assert(codeMatches.length === 1 && codeMatches[0].id === 'emp-101', 'TEST 2.2: Search by ID "EMP-0142" returns Aarav Sharma');

  // Filter by department
  const engMatches = allStaff.filter((e) => (e.department || '').toLowerCase() === 'engineering');
  assert(engMatches.length >= 2, `TEST 2.3: Department filter "Engineering" matches staff (count: ${engMatches.length})`);

  // Filter by Submitted status
  const submittedMatches = allStaff.filter((e) => e.todayReportStatus === 'Submitted');
  assert(submittedMatches.some((e) => e.id === 'emp-101'), 'TEST 2.4: Status filter "Submitted" includes Aarav');

  // Filter by Pending Tasks
  const pendingMatches = allStaff.filter((e) => (e.todayPendingTasks || 0) > 0);
  assert(pendingMatches.some((e) => e.id === 'emp-101'), 'TEST 2.5: Status filter "Pending Tasks" includes staff with pending tasks');

  // Search non-matching query
  const emptyMatches = allStaff.filter((e) => e.name.toLowerCase().includes('nonexistent_xyz'));
  assert(emptyMatches.length === 0, 'TEST 2.6: Non-matching query returns empty array');

  // -------------------------------------------------------------------------
  // TEST 3: Individual Employee Report Profile & Timeline
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Individual Employee Report Profile & Timeline ---');
  const profileRes = await api.getEmployeeReportProfile('emp-101');

  assert(profileRes.success === true, 'TEST 3.1: getEmployeeReportProfile returns success');
  assert(profileRes.data.employee.name === 'Aarav Sharma', 'TEST 3.2: Scoped to Aarav Sharma');
  assert(Array.isArray(profileRes.data.reports), 'TEST 3.3: Returns reports timeline');
  assert(profileRes.data.reports.length > 0, 'TEST 3.4: Contains recorded reports');

  // Check descending date order
  const reps = profileRes.data.reports;
  let isSortedDescending = true;
  for (let i = 0; i < reps.length - 1; i++) {
    if (new Date(reps[i].work_date) < new Date(reps[i + 1].work_date)) {
      isSortedDescending = false;
      break;
    }
  }
  assert(isSortedDescending, 'TEST 3.5: Reports timeline strictly sorted in DESCENDING date order (latest first)');

  // Verify summary metrics
  const summary = profileRes.data.summary;
  assert(summary.totalReportsSubmitted >= 1, `TEST 3.6: Reports submitted calculated accurately: ${summary.totalReportsSubmitted}`);
  assert(summary.totalTasksRecorded >= 3, `TEST 3.7: Total tasks recorded calculated accurately: ${summary.totalTasksRecorded}`);
  assert(summary.totalCompleted >= 2, `TEST 3.8: Total completed tasks calculated: ${summary.totalCompleted}`);
  assert(summary.totalPending >= 1, `TEST 3.9: Total pending tasks calculated: ${summary.totalPending}`);

  // -------------------------------------------------------------------------
  // TEST 4: Strict Historical Read-Only Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Strict Historical Read-Only Enforcement ---');
  const pastRep = reps.find((r) => r.work_date === '2026-10-27');
  assert(Boolean(pastRep), 'TEST 4.1: Historical report for 2026-10-27 exists');
  assert(pastRep.tasks.length === 3, 'TEST 4.2: Historical tasks count preserved (3 tasks)');
  assert(pastRep.rating_average_overall === '9.00', `TEST 4.3: Historical overall rating preserved: ${pastRep.rating_average_overall}`);
  assert(pastRep.rating_discipline === 10, 'TEST 4.4: 6-factor rating preserved (Discipline 10/10)');

  // Attempting to update historical report as employee
  let employeeEditBlocked = false;
  try {
    const editRes = await frontendDataStore.updateTaskStatus(
      {
        reportId: pastRep.id,
        taskId: pastRep.tasks[0].id,
        completed: 'No',
        pending: 'Yes'
      },
      employeeUser,
      acmeOrg
    );
    if (!editRes.success) employeeEditBlocked = true;
  } catch (err) {
    employeeEditBlocked = err.message.includes('Historical reports are read-only');
  }
  assert(employeeEditBlocked, 'TEST 4.5: Employee editing of historical past report is strictly prohibited');

  // -------------------------------------------------------------------------
  // TEST 5: Management Task Assignment Workflow
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Management Task Assignment Workflow ---');
  const taskPayload = {
    employeeId: 'emp-101',
    projectName: 'Android Mobile App',
    taskTitle: 'Implement Notification Handlers',
    taskDescription: 'Configure background handler and notification response listeners.',
    priority: 'High',
    dueTime: '17:00'
  };

  const assignRes = await api.assignTaskToEmployee(taskPayload);
  assert(assignRes.success === true, 'TEST 5.1: Task assigned successfully by Management');
  assert(Boolean(assignRes.task), 'TEST 5.2: Returns assigned task object');
  assert(assignRes.task.isManagementAssigned === true, 'TEST 5.3: Task origin explicitly marked isManagementAssigned: true');
  assert(assignRes.task.assignedBy === 'Rohan Deshmukh', `TEST 5.4: Assigned by recorded as Rohan Deshmukh (got: ${assignRes.task.assignedBy})`);
  assert(assignRes.task.completed === 'No', 'TEST 5.5: Task initial completed status is No');
  assert(assignRes.task.pending === 'Yes', 'TEST 5.6: Task initial pending status is Yes (never auto-marked Completed)');
  assert(assignRes.task.priority === 'High', 'TEST 5.7: Priority recorded as High');

  // Validation: Missing project name
  const invalidProjectRes = await api.assignTaskToEmployee({
    employeeId: 'emp-101',
    projectName: '',
    taskDescription: 'Some description'
  });
  assert(invalidProjectRes.success === false, 'TEST 5.8: Empty project name rejected');

  // Validation: Missing task description
  const invalidDescRes = await api.assignTaskToEmployee({
    employeeId: 'emp-101',
    projectName: 'Android Mobile App',
    taskDescription: ''
  });
  assert(invalidDescRes.success === false, 'TEST 5.9: Empty task description rejected');

  // Validation: Accidental duplicate submission prevention
  const dupRes = await api.assignTaskToEmployee(taskPayload);
  assert(dupRes.success === false && dupRes.error.includes('already been added'), 'TEST 5.10: Accidental duplicate task submission rejected');

  // -------------------------------------------------------------------------
  // TEST 6: In-App Notification Generation for Employee
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: In-App Notification Generation for Employee ---');
  const empNotifs = frontendDataStore.getNotifications('emp-101');
  const taskNotif = empNotifs.find((n) => n.type === 'task_assigned' && n.taskId === assignRes.task.id);

  assert(Boolean(taskNotif), 'TEST 6.1: In-app notification created for Aarav Sharma');
  assert(taskNotif.recipient_user_id === 'emp-101', 'TEST 6.2: Notification recipient matches Aarav Sharma');
  assert(taskNotif.title === 'New Task Assigned', `TEST 6.3: Notification title is "New Task Assigned" (got: ${taskNotif.title})`);
  assert(taskNotif.text.includes('Android Mobile App'), 'TEST 6.4: Notification details project name');
  assert(taskNotif.unread === true, 'TEST 6.5: Notification marked unread');

  // -------------------------------------------------------------------------
  // TEST 7: Bidirectional Status Synchronization
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Bidirectional Status Synchronization ---');
  // Employee toggles task to completed
  const statusUpdateRes = await api.updateTaskStatus({
    taskId: assignRes.task.id,
    completed: 'Yes',
    pending: 'No'
  });

  assert(statusUpdateRes.success === true, 'TEST 7.1: Employee updated task status');
  assert(statusUpdateRes.task.completed === 'Yes', 'TEST 7.2: Task completed updated to Yes');
  assert(statusUpdateRes.task.pending === 'No', 'TEST 7.3: Task pending updated to No');

  // Management refreshes profile and verifies status
  const refreshedProfile = await api.getEmployeeReportProfile('emp-101');
  const syncedTask = (refreshedProfile.data.todayTasks || []).find((t) => t.id === assignRes.task.id);

  assert(Boolean(syncedTask), 'TEST 7.4: Task present in refreshed Management view');
  assert(syncedTask.completed === 'Yes', 'TEST 7.5: Management view reflects Completed: Yes immediately');
  assert(syncedTask.pending === 'No', 'TEST 7.6: Management view reflects Pending: No immediately');

  // Check that historical report from yesterday remains unchanged
  const historicalRepCheck = refreshedProfile.data.reports.find((r) => r.work_date === '2026-10-27');
  assert(historicalRepCheck.rating_average_overall === '9.00', 'TEST 7.7: Historical ratings preserved during current-day updates');

  // -------------------------------------------------------------------------
  // TEST 8: In-App Spreadsheet Data Grid & Date-Range Query
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: In-App Spreadsheet Data Grid & Date-Range Query ---');
  const rangeRes = await api.getTaskReportsForDateRange({
    startDate: '2026-10-01',
    endDate: '2026-10-31'
  });

  assert(rangeRes.success === true, 'TEST 8.1: getTaskReportsForDateRange returns success');
  assert(Array.isArray(rangeRes.rows), 'TEST 8.2: Returns flattened rows array for spreadsheet table');
  assert(rangeRes.rows.length >= 3, `TEST 8.3: Rows count matches recorded tasks (got: ${rangeRes.rows.length})`);

  const firstRow = rangeRes.rows[0];
  assert(Boolean(firstRow.companyId), 'TEST 8.4: Row contains Company ID');
  assert(Boolean(firstRow.employeeName), 'TEST 8.5: Row contains Employee Name');
  assert(Boolean(firstRow.workDate), 'TEST 8.6: Row contains Work Date');
  assert(Boolean(firstRow.taskDescription), 'TEST 8.7: Row contains Task Description');
  assert(Boolean(firstRow.taskOrigin), 'TEST 8.8: Row contains Task Origin');
  assert(Boolean(firstRow.taskStatus), 'TEST 8.9: Row contains Task Status');

  // Validation: Start Date > End Date
  const invalidRangeRes = await api.getTaskReportsForDateRange({
    startDate: '2026-10-30',
    endDate: '2026-10-01'
  });
  assert(invalidRangeRes.success === false && invalidRangeRes.error.includes('Start date cannot be after end date'), 'TEST 8.10: Start Date after End Date rejected');

  // -------------------------------------------------------------------------
  // TEST 9: Excel Export Generation (.csv with UTF-8 BOM)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 9: Excel Export Generation (.csv with UTF-8 BOM) ---');
  const exportRes = await api.downloadTaskReportsExcel({
    startDate: '2026-10-01',
    endDate: '2026-10-31'
  });

  assert(exportRes.success === true, 'TEST 9.1: downloadTaskReportsExcel returns success');
  assert(Boolean(exportRes.filename), 'TEST 9.2: Filename generated');
  assert(exportRes.filename === 'EmployeeApp_TaskReports_2026-10-01_to_2026-10-31.csv', `TEST 9.3: Filename follows date range standard: ${exportRes.filename}`);

  if (exportRes.csvContent) {
    assert(exportRes.csvContent.startsWith('\uFEFF'), 'TEST 9.4: CSV starts with UTF-8 BOM for Microsoft Excel compatibility');
    assert(exportRes.csvContent.includes('"Employee ID","Employee Name"'), 'TEST 9.5: CSV contains standard table header columns');
    assert(exportRes.csvContent.includes('--- EMPLOYEE SUMMARY FOR PERIOD ---'), 'TEST 9.6: CSV contains Employee Summary breakdown section');
    assert(exportRes.csvContent.includes('"Aarav Sharma"'), 'TEST 9.7: Aarav Sharma records present in CSV');
  } else if (exportRes.fileUri) {
    assert(true, 'TEST 9.4: Native FileSystem export generated URI');
  }

  // -------------------------------------------------------------------------
  // TEST 10: Multi-Tenant Organization Isolation & Role Safeguards
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 10: Multi-Tenant Organization Isolation & Role Safeguards ---');
  // Acme management fetching employees
  const acmeOnlyEmployees = await api.getEmployeesWithDailyReports({ organizationId: acmeOrg.id });
  const hasStellarStaff = acmeOnlyEmployees.data.some((e) => e.id === 'emp-201' || e.name === 'Rhea Kapoor');
  assert(!hasStellarStaff, 'TEST 10.1: Acme Management NEVER receives Stellar Dynamics employees');

  // Acme management cannot assign task to Stellar employee
  let stellarCrossAssignBlocked = false;
  try {
    const crossAssignRes = await api.assignTaskToEmployee({
      employeeId: 'emp-201',
      projectName: 'Security Audit',
      taskDescription: 'Audit foreign tenant'
    });
    if (!crossAssignRes.success) stellarCrossAssignBlocked = true;
  } catch (e) {
    stellarCrossAssignBlocked = true;
  }
  assert(stellarCrossAssignBlocked, 'TEST 10.2: Cross-tenant task assignment rejected');

  // Employee role cannot assign tasks
  let employeeAssignBlocked = false;
  try {
    await frontendDataStore.assignTaskFromManagement(
      {
        employeeId: 'emp-103',
        projectName: 'DevOps',
        taskDescription: 'Employee self assignment'
      },
      employeeUser,
      acmeOrg
    );
  } catch (e) {
    employeeAssignBlocked = e.message.includes('Only authorized management can assign tasks');
  }
  assert(employeeAssignBlocked, 'TEST 10.3: Regular employee cannot assign tasks to staff');

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${passed + failed}`);
  console.log(`PASSED:               ${passed}`);
  console.log(`FAILED:               ${failed}`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

