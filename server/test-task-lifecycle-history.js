/**
 * Daily Task Lifecycle & History Management Test Suite
 * Tests all 20 required verification scenarios from Section 16
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

const getISTDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

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
  console.log('   DAILY TASK LIFECYCLE & HISTORY MANAGEMENT TEST SUITE');
  console.log('======================================================================\n');

  // Authenticate Aarav Sharma (Acme employee)
  const empLogin = await simulate('POST', '/api/auth/login', {
    companyCode: 'CMP-7K4M9X2Q',
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(empLogin.status === 200, 'Employee Aarav Sharma authenticated successfully');
  const token = empLogin.body.token;

  // Authenticate Nexus user for multi-tenant check
  const nexusLogin = await simulate('POST', '/api/auth/login', {
    email: 'admin@nexussolutions.in',
    password: 'admin123'
  });
  assert(nexusLogin.status === 200, 'Nexus Founder authenticated successfully');
  const nexusToken = nexusLogin.body.token;

  const today = getISTDate(0);
  const yesterday = getISTDate(-1);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Current Date Initialization in IST (Asia/Kolkata)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. IST Date & Timezone Initialization ---');
  const todayRes = await simulate('GET', '/api/daily-reports/today', null, token);
  assert(todayRes.status === 200, 'GET /api/daily-reports/today returns HTTP 200');
  assert(todayRes.body.today === today, `Response date matches current IST date (${today})`);
  assert(typeof todayRes.body.dayName === 'string' && todayRes.body.dayName.length > 0, `Returns valid weekday name: ${todayRes.body.dayName}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 10, 11, 12. Automatic Pending Carry-Forward from Yesterday
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 10-12. Automatic Pending Carry-Forward & Completed Exclusion ---');
  assert(todayRes.body.isSubmitted === false, 'Initially today has not been submitted yet');
  assert(todayRes.body.tasks && todayRes.body.tasks.length >= 1, 'Carried forward pending tasks appear in today tasks array');
  
  const cfTask = (todayRes.body.tasks || []).find(t => t.isCarriedForward);
  assert(Boolean(cfTask), 'Carried-forward task is identified with isCarriedForward: true');
  assert(cfTask && cfTask.carriedForwardFromDate === yesterday, `Carried-forward task source date matches yesterday (${yesterday})`);
  assert(cfTask && cfTask.tasksAssigned.includes('Review Founder spreadsheet data grid'), 'Correct pending task carried forward');
  assert(cfTask && cfTask.pending === 'Yes' && cfTask.completed === 'No', 'Carried-forward task initialized with pending=Yes, completed=No');
  
  // Verify completed tasks from yesterday were NOT carried forward
  const completedCfTask = (todayRes.body.tasks || []).find(t => t.tasksAssigned && t.tasksAssigned.includes('CameraView selfie capture'));
  assert(!completedCfTask, 'Completed tasks from yesterday are NOT carried forward');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2, 3, 4, 5. Creating Tasks & Submitting Today's Report
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2-5. Creating Tasks & Submitting Today's Report ---");
  const initialTasks = [
    {
      ...cfTask,
      completed: 'Yes', // Aarav completes the carried forward task today!
      pending: 'No'
    },
    {
      id: `task-today-1-${Date.now()}`,
      projectName: 'Android Mobile App',
      tasksAssigned: 'Implement read-only historical report modal and confirmation dialog',
      completed: 'Yes',
      pending: 'No',
      taskDate: today,
      isCarriedForward: false
    },
    {
      id: `task-today-2-${Date.now()}`,
      projectName: 'Android Mobile App',
      tasksAssigned: 'Add date restriction checks blocking past date edits',
      completed: 'No',
      pending: 'Yes',
      taskDate: today,
      isCarriedForward: false
    }
  ];

  const submitRes = await simulate('POST', '/api/daily-reports', {
    work_date: today,
    projectName: 'Android Mobile App',
    tasks: initialTasks,
    ratingSpeed: 9,
    ratingUnderstanding: 9,
    ratingProblemSolving: 9,
    ratingTalkingBehaviour: 9,
    ratingWorkQuality: 10,
    ratingDiscipline: 10,
    isDraft: false
  }, token);

  assert(submitRes.status === 200 || submitRes.status === 201, "POST /api/daily-reports submission returns 200/201");
  assert(submitRes.body.success === true, 'Submission reports success: true');
  assert(submitRes.body.data.isDraft === false, 'Report isDraft is false (final submitted)');
  assert(submitRes.body.data.stats.total === 3, 'Summary stats: total tasks is 3');
  assert(submitRes.body.data.stats.completed === 2, 'Summary stats: completed tasks is 2');
  assert(submitRes.body.data.stats.pending === 1, 'Summary stats: pending tasks is 1');

  // Verify GET /today now reports submitted status
  const todayAfterSubmit = await simulate('GET', '/api/daily-reports/today', null, token);
  assert(todayAfterSubmit.body.isSubmitted === true, 'Today report state is now isSubmitted: true');
  assert(todayAfterSubmit.body.tasks.length === 3, 'All 3 submitted tasks present in today report');

  // ─────────────────────────────────────────────────────────────────────────────
  // 6, 7. Same-Day Editing & Adding Tasks After Initial Submission
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6-7. Same-Day Editing & Adding Additional Tasks ---");
  // Modify an existing task description on today's submitted report
  const updatedTasks = [...todayAfterSubmit.body.tasks];
  updatedTasks[1] = {
    ...updatedTasks[1],
    tasksAssigned: 'Implement read-only historical report modal, confirmation dialog, and verified test assertions'
  };
  // Add a 4th task to today's submitted report
  updatedTasks.push({
    id: `task-today-extra-${Date.now()}`,
    projectName: 'Android Mobile App',
    tasksAssigned: 'Verify Excel export spreadsheet column mapping and widths',
    completed: 'Yes',
    pending: 'No',
    taskDate: today,
    isCarriedForward: false
  });

  const sameDayUpdateRes = await simulate('POST', '/api/daily-reports', {
    work_date: today,
    tasks: updatedTasks,
    isDraft: false
  }, token);

  assert(sameDayUpdateRes.status === 200, "Same-day edit/addition to submitted report returns HTTP 200 (not 409 conflict)");
  assert(sameDayUpdateRes.body.data.tasks.length === 4, 'Report now contains 4 tasks after same-day addition');
  assert(sameDayUpdateRes.body.data.stats.completed === 3, 'Updated stats: completed is now 3');
  assert(sameDayUpdateRes.body.data.stats.pending === 1, 'Updated stats: pending remains 1');

  // ─────────────────────────────────────────────────────────────────────────────
  // 8, 9. Strict Date Restrictions: Editing Past Dates Strictly Blocked
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8-9. Strict Historical Date Editing Restriction ---');
  const pastEditAttempt = await simulate('POST', '/api/daily-reports', {
    work_date: yesterday,
    projectName: 'Hacked Project',
    tasks: [{ id: 'hack-1', projectName: 'Hacked', tasksAssigned: 'Malicious modification', completed: 'Yes', pending: 'No' }],
    isDraft: false
  }, token);

  assert(pastEditAttempt.status === 403, 'Editing yesterday report is rejected with HTTP 403 Forbidden');
  assert(
    pastEditAttempt.body.error === "Previous-day reports are read-only. You can edit tasks for today's date only.",
    'Rejection error message is clear and exact'
  );

  const pastAddAttempt = await simulate('POST', '/api/daily-reports', {
    reportDate: getISTDate(-3),
    tasks: [{ id: 'hack-2', tasksAssigned: 'Add task to 3 days ago' }],
    isDraft: false
  }, token);

  assert(pastAddAttempt.status === 403, 'Adding tasks to historical date rejected with HTTP 403 Forbidden');

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Completing Carried-Forward Task Today Preserves Yesterday's Report
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- 13. Independence of Historical Reports ---");
  const yesterdayReportRes = await simulate('GET', `/api/daily-reports/date/${yesterday}`, null, token);
  assert(yesterdayReportRes.status === 200, 'GET yesterday report returns HTTP 200');
  assert(yesterdayReportRes.body.isReadOnly === true, 'Yesterday report is marked isReadOnly: true');
  
  const yTasks = yesterdayReportRes.body.data.tasks;
  const yPendingTask = yTasks.find(t => t.id === 'task-hist-003');
  assert(Boolean(yPendingTask), "Yesterday's original task is preserved in historical report");
  assert(yPendingTask && yPendingTask.pending === 'Yes', "Yesterday's task still shows pending='Yes' in historical record");
  assert(yPendingTask && yPendingTask.completed === 'No', "Yesterday's task still shows completed='No' in historical record");

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. Previous Days / Task History Endpoint (Descending Order)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 14. Previous Days Task History ---');
  const historyRes = await simulate('GET', '/api/daily-reports/history', null, token);
  assert(historyRes.status === 200, 'GET /api/daily-reports/history returns HTTP 200');
  assert(Array.isArray(historyRes.body.data) && historyRes.body.data.length >= 2, 'History returns at least 2 past reports');
  
  const hDates = historyRes.body.data.map(r => r.work_date);
  const isSortedDesc = hDates.every((d, i) => i === 0 || d <= hDates[i - 1]);
  assert(isSortedDesc, 'Historical reports are sorted in descending chronological order');
  assert(historyRes.body.data[0].work_date === yesterday, 'Most recent past report is yesterday');
  assert(historyRes.body.data[0].isReadOnly === true, 'Historical items are marked read-only');

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. Historical Report for Specific Date
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 15. Specific Date Historical Report Endpoint ---');
  const nonExistentDateRes = await simulate('GET', '/api/daily-reports/date/2025-01-01', null, token);
  assert(nonExistentDateRes.status === 200, 'Query for non-existent date returns 200 with data: null');
  assert(nonExistentDateRes.body.data === null, 'Data is null for empty date');

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. Draft Saving Retains Draft State Without Marking as Submitted
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 16. Draft State Isolation & Persistence ---');
  // Karan Verma employee draft test
  const karanLogin = await simulate('POST', '/api/auth/login', {
    companyCode: 'CMP-7K4M9X2Q',
    email: 'karan.v@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(karanLogin.status === 200, 'Employee Karan Verma authenticated');
  const karanToken = karanLogin.body.token;

  const draftSave = await simulate('POST', '/api/daily-reports', {
    work_date: today,
    projectName: 'Internal Tools',
    tasks: [{ id: 'draft-t-1', projectName: 'Internal Tools', tasksAssigned: 'Draft research work', completed: 'Yes', pending: 'No' }],
    isDraft: true
  }, karanToken);

  assert(draftSave.status === 200, 'Saving draft returns HTTP 200');
  assert(draftSave.body.data.isDraft === true, 'Saved report has isDraft: true');

  const draftFetch = await simulate('GET', '/api/daily-reports/draft', null, karanToken);
  assert(draftFetch.status === 200, 'GET /draft returns HTTP 200');
  assert(draftFetch.body.draft && draftFetch.body.draft.isDraft === true, 'Draft endpoint confirms isDraft is true');

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. Contradiction-Free Status Normalization
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 17. Contradiction-Free Status Normalization ---');
  const normSubmit = await simulate('POST', '/api/daily-reports', {
    work_date: today,
    tasks: [
      { id: 'norm-1', projectName: 'QA', tasksAssigned: 'Verify status normalization', status: 'completed' }
    ],
    isDraft: true
  }, karanToken);

  assert(normSubmit.body.data.tasks[0].completed === 'Yes', 'Task status completed maps to completed=Yes');
  assert(normSubmit.body.data.tasks[0].pending === 'No', 'Contradiction avoided: pending is automatically No');

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. Excel Export Spreadsheet Structure & Rows
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 18. Excel Export Spreadsheet Structure ---');
  const exportRes = await simulate('GET', '/api/daily-reports/export?base64=true', null, token);
  assert(exportRes.status === 200, 'GET /export returns HTTP 200');
  assert(Boolean(exportRes.body.base64), 'Export returns base64 spreadsheet payload');
  assert(exportRes.body.rowCount > 0, `Export includes rows (${exportRes.body.rowCount} rows generated)`);
  assert(exportRes.body.filename.includes('.xlsx'), `Filename ends with .xlsx (${exportRes.body.filename})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 19. Employee Ratings Calculation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 19. Employee Ratings Preservation ---');
  const ratSubmit = await simulate('POST', '/api/daily-reports', {
    work_date: today,
    ratingSpeed: 8,
    ratingUnderstanding: 8,
    ratingProblemSolving: 8,
    ratingTalkingBehaviour: 8,
    ratingWorkQuality: 8,
    ratingDiscipline: 8,
    isDraft: false
  }, karanToken);

  assert(ratSubmit.status === 200, 'Report with ratings submitted');
  assert(ratSubmit.body.data.rating_average_overall === '8.0', 'Average overall rating computed accurately to 8.0');

  // ─────────────────────────────────────────────────────────────────────────────
  // 20. Multi-Tenant Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 20. Multi-Tenant Data Isolation ---');
  const nexusToday = await simulate('GET', '/api/daily-reports/today', null, nexusToken);
  assert(nexusToday.status === 200, 'Nexus employee GET /today succeeds');
  const nexusTasks = nexusToday.body.tasks || [];
  const hasAcmeTasks = nexusTasks.some(t => t.tasksAssigned && t.tasksAssigned.includes('CameraView'));
  assert(!hasAcmeTasks, 'Nexus employee CANNOT see any Acme employee tasks or carried-forward items');

  const nexusHistory = await simulate('GET', '/api/daily-reports/history', null, nexusToken);
  assert(nexusHistory.status === 200, 'Nexus employee GET /history succeeds');
  assert(nexusHistory.body.data.length === 0, 'Nexus employee has 0 historical reports from Acme organization');

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────────
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
  console.error('Fatal test error:', err);
  process.exit(1);
});
