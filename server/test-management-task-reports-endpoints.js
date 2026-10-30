/**
 * Server Endpoints Test Suite for Management Task Reports & Employee-Wise Excel System
 * Verifies all 6 new server routes in server/src/index.js:
 * 1. GET  /api/management/task-reports/employees
 * 2. GET  /api/management/task-reports/employees/:employeeId
 * 3. GET  /api/management/task-reports/employees/:employeeId/daily/:date
 * 4. POST /api/management/task-reports/employees/:employeeId/tasks
 * 5. GET  /api/management/task-reports/employees/:employeeId/export (multi-sheet .xlsx)
 * 6. GET  /api/management/task-reports/employees/:employeeId/spreadsheet
 */
process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const xlsx = require('xlsx');
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

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('   MANAGEMENT TASK REPORTS SERVER ENDPOINTS TEST SUITE');
  console.log('======================================================================\n');

  // 1. Authenticate Management User (Admin / Founder)
  console.log('--- SETUP: Authentication ---');
  const mgmtLogin = await simulate('POST', '/api/auth/login', {
    companyCode: 'CMP-7K4M9X2Q',
    email: 'admin@acmetech.com',
    password: 'admin123'
  });
  assert(mgmtLogin.status === 200 && mgmtLogin.body?.token, 'Management login succeeded');
  const mgmtToken = mgmtLogin.body?.token;

  // 2. Authenticate Regular Employee (Aarav Sharma)
  const empLogin = await simulate('POST', '/api/auth/login', {
    companyCode: 'CMP-7K4M9X2Q',
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    portal: 'employee'
  });
  assert(empLogin.status === 200 && empLogin.body?.token, 'Employee login succeeded');
  const empToken = empLogin.body?.token;
  const aaravId = empLogin.body?.user?.id;

  // --------------------------------------------------------------------
  // TEST 1: GET /api/management/task-reports/employees
  // --------------------------------------------------------------------
  console.log('\n--- TEST 1: GET /api/management/task-reports/employees ---');
  
  // 1.1 Employee cannot access management endpoint
  const empDenied = await simulate('GET', '/api/management/task-reports/employees', null, empToken);
  assert(empDenied.status === 403, 'Regular employee access is forbidden (403)');

  // 1.2 Management can access endpoint
  const mgmtRes = await simulate('GET', '/api/management/task-reports/employees', null, mgmtToken);
  assert(mgmtRes.status === 200, 'Management access returns HTTP 200');
  assert(mgmtRes.body?.success === true, 'Response indicates success: true');
  assert(Array.isArray(mgmtRes.body?.data), 'Returns employees data array');
  assert(mgmtRes.body.data.length >= 4, `Contains organization employees (count: ${mgmtRes.body.data.length})`);

  // 1.3 Verify Aarav Sharma's metrics in the list
  const aaravInList = mgmtRes.body.data.find(e => e.id === aaravId || e.name === 'Aarav Sharma');
  assert(!!aaravInList, 'Aarav Sharma found in management employees overview');
  assert(aaravInList.department === 'Engineering', `Department correctly indicated: ${aaravInList?.department}`);
  assert(aaravInList.latestReportStatus !== undefined, 'Employee item includes report status');
  assert(aaravInList.totalSubmittedReports >= 1, `Aarav has submitted reports: ${aaravInList?.totalSubmittedReports}`);

  // --------------------------------------------------------------------
  // TEST 2: GET /api/management/task-reports/employees/:employeeId
  // --------------------------------------------------------------------
  console.log('\n--- TEST 2: GET /api/management/task-reports/employees/:employeeId ---');
  
  const empProfileRes = await simulate('GET', `/api/management/task-reports/employees/${aaravId}`, null, mgmtToken);
  assert(empProfileRes.status === 200, 'Management fetch employee report profile returns HTTP 200');
  assert(empProfileRes.body?.success === true, 'Response indicates success: true');
  assert(empProfileRes.body?.data?.employee?.id === aaravId, 'Profile belongs strictly to Aarav Sharma');
  assert(empProfileRes.body?.data?.summary?.totalTasksRecorded >= 2, `Summary total tasks accurate: ${empProfileRes.body?.data?.summary?.totalTasksRecorded}`);
  assert(Array.isArray(empProfileRes.body?.data?.reports), 'Profile includes reports history timeline');
  
  // Verify chronological descending order (newest date first)
  const timelineReports = empProfileRes.body?.data?.reports || [];
  if (timelineReports.length > 1) {
    const d0 = new Date(timelineReports[0].work_date).getTime();
    const d1 = new Date(timelineReports[1].work_date).getTime();
    assert(d0 >= d1, 'Timeline reports strictly ordered descending (newest first)');
  } else {
    assert(timelineReports.length >= 1, 'Timeline contains at least 1 report');
  }

  // --------------------------------------------------------------------
  // TEST 3: GET /api/management/task-reports/employees/:employeeId/daily/:date
  // --------------------------------------------------------------------
  console.log('\n--- TEST 3: GET /api/management/task-reports/employees/:employeeId/daily/:date ---');
  
  const historicalDate = timelineReports[0]?.work_date;
  const dailyRes = await simulate('GET', `/api/management/task-reports/employees/${aaravId}/daily/${historicalDate}`, null, mgmtToken);
  assert(dailyRes.status === 200, 'Daily historical report fetch returns HTTP 200');
  assert(dailyRes.body?.success === true, 'Response indicates success: true');
  assert(dailyRes.body?.data?.work_date === historicalDate, `Report date matches requested date: ${historicalDate}`);
  assert(dailyRes.body?.isReadOnly === true || dailyRes.body?.isReadOnly === false, 'isReadOnly flag present');

  // --------------------------------------------------------------------
  // TEST 4: POST /api/management/task-reports/employees/:employeeId/tasks
  // --------------------------------------------------------------------
  console.log('\n--- TEST 4: POST /api/management/task-reports/employees/:employeeId/tasks ---');
  
  // 4.1 Regular employee cannot assign task
  const empAssignAttempt = await simulate('POST', `/api/management/task-reports/employees/${aaravId}/tasks`, {
    projectName: 'Mobile App',
    taskDescription: 'Unauthorized assignment'
  }, empToken);
  assert(empAssignAttempt.status === 403, 'Regular employee cannot assign tasks (403)');

  // 4.2 Field validation: missing project name
  const invalidTask = await simulate('POST', `/api/management/task-reports/employees/${aaravId}/tasks`, {
    projectName: '',
    taskDescription: 'Some description'
  }, mgmtToken);
  assert(invalidTask.status === 400, 'Validation rejects empty project name (400)');

  // 4.3 Successful Management Task Assignment
  const taskPayload = {
    projectName: 'Mobile App Optimization',
    taskDescription: 'Conduct performance profiling on Android Hermes engine',
    priority: 'High',
    dueTime: '18:00'
  };
  const assignRes = await simulate('POST', `/api/management/task-reports/employees/${aaravId}/tasks`, taskPayload, mgmtToken);
  assert(assignRes.status === 200, 'Management task assignment returns HTTP 200');
  assert(assignRes.body?.success === true, 'Assignment response indicates success');
  assert(assignRes.body?.task?.isManagementAssigned === true, 'Task marked isManagementAssigned: true');
  assert(assignRes.body?.task?.assignedBy !== undefined, `Assigned by identity recorded: ${assignRes.body?.task?.assignedBy}`);
  assert(assignRes.body?.task?.pending === 'Yes', 'Task initially marked Pending: Yes');
  assert(assignRes.body?.task?.completed === 'No', 'Task initially marked Completed: No');

  // 4.4 Duplicate Task Prevention
  const dupAttempt = await simulate('POST', `/api/management/task-reports/employees/${aaravId}/tasks`, taskPayload, mgmtToken);
  assert(dupAttempt.status === 409, 'Consecutive identical task assignment rejected (409 Duplicate)');

  // --------------------------------------------------------------------
  // TEST 5: GET /api/management/task-reports/employees/:employeeId/spreadsheet
  // --------------------------------------------------------------------
  console.log('\n--- TEST 5: GET /api/management/task-reports/employees/:employeeId/spreadsheet ---');
  
  const sheetRes = await simulate('GET', `/api/management/task-reports/employees/${aaravId}/spreadsheet?startDate=2026-10-01&endDate=2026-10-31`, null, mgmtToken);
  assert(sheetRes.status === 200, 'Spreadsheet data fetch returns HTTP 200');
  assert(sheetRes.body?.success === true, 'Spreadsheet response indicates success: true');
  assert(sheetRes.body?.data?.summary !== undefined, 'Spreadsheet includes summary metrics block');
  assert(sheetRes.body?.data?.summary?.totalTasks >= 2, `Spreadsheet summary total tasks updated: ${sheetRes.body?.data?.summary?.totalTasks}`);
  assert(Array.isArray(sheetRes.body?.data?.rows), 'Spreadsheet includes rows array');
  
  const sampleRow = sheetRes.body.data.rows[0];
  assert(sampleRow.workDate !== undefined, 'Row contains workDate');
  assert(sampleRow.dayName !== undefined, 'Row contains dayName');
  assert(sampleRow.projectName !== undefined, 'Row contains projectName');
  assert(sampleRow.taskDescription !== undefined, 'Row contains taskDescription');
  assert(sampleRow.taskStatus !== undefined, 'Row contains taskStatus');

  // --------------------------------------------------------------------
  // TEST 6: GET /api/management/task-reports/employees/:employeeId/export (Multi-Sheet .xlsx)
  // --------------------------------------------------------------------
  console.log('\n--- TEST 6: GET /api/management/task-reports/employees/:employeeId/export (.xlsx) ---');
  
  // 6.1 Validation: Invalid date range
  const invalidDateExport = await simulate('GET', `/api/management/task-reports/employees/${aaravId}/export?startDate=2026-10-31&endDate=2026-10-01&base64=true`, null, mgmtToken);
  assert(invalidDateExport.status === 400, 'Rejects inverted date range startDate > endDate (400)');

  // 6.2 Valid multi-sheet .xlsx generation
  const exportRes = await simulate('GET', `/api/management/task-reports/employees/${aaravId}/export?startDate=2026-10-01&endDate=2026-10-31&base64=true`, null, mgmtToken);
  assert(exportRes.status === 200, 'Excel export returns HTTP 200');
  assert(exportRes.body?.success === true, 'Excel export indicates success: true');
  assert(typeof exportRes.body?.base64 === 'string', 'Returns base64 encoded binary .xlsx string');
  assert(exportRes.body?.filename.startsWith('Employee_Task_Report_Aarav_Sharma'), `Filename follows standard format: ${exportRes.body?.filename}`);

  // 6.3 Parse the base64 string back into an Excel workbook using xlsx
  const buffer = Buffer.from(exportRes.body.base64, 'base64');
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  assert(Array.isArray(workbook.SheetNames), 'Workbook parsed successfully');
  assert(workbook.SheetNames.includes('Daily Summary'), 'Contains Sheet 1: Daily Summary');
  assert(workbook.SheetNames.includes('Task Details'), 'Contains Sheet 2: Task Details');
  assert(workbook.SheetNames.includes('Daily Breakdown'), 'Contains Sheet 3: Daily Breakdown');

  // Verify Sheet 2 (Task Details) content
  const taskSheet = workbook.Sheets['Task Details'];
  const taskRows = xlsx.utils.sheet_to_json(taskSheet);
  assert(taskRows.length >= 2, `Task Details sheet contains recorded tasks (rows: ${taskRows.length})`);
  const firstTaskRow = taskRows[0];
  assert(firstTaskRow['Employee Name'] === 'Aarav Sharma', 'Task Details sheet is strictly scoped to Aarav Sharma');

  // Verify Sheet 1 (Daily Summary) content
  const summarySheet = workbook.Sheets['Daily Summary'];
  const summaryRows = xlsx.utils.sheet_to_json(summarySheet);
  assert(summaryRows.length >= 1, `Daily Summary sheet contains date summary rows (rows: ${summaryRows.length})`);

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${totalTests}`);
  console.log(`PASSED:               ${passedTests}`);
  console.log(`FAILED:               ${totalTests - passedTests}`);
  console.log('======================================================================\n');

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});

