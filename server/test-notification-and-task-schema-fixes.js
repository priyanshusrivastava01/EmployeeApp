process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
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
    process.exit(1);
  }
}

async function runSuite() {
  console.log('======================================================================');
  console.log('   NOTIFICATIONS & DAILY REPORTS SCHEMA FIXES VERIFICATION');
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
  // TEST 1: Management Assigns Task to Employee
  // --------------------------------------------------------------------
  console.log('\n--- TEST 1: POST /api/management/task-reports/employees/:employeeId/tasks ---');
  const taskDesc = `Schema Verification Task ${Date.now()}`;
  const assignRes = await simulate(
    'POST',
    `/api/management/task-reports/employees/${aaravId}/tasks`,
    {
      projectName: 'Supabase Migration Preflight',
      taskDescription: taskDesc,
      priority: 'High',
      dueTime: '06:00 PM'
    },
    mgmtToken
  );

  assert(assignRes.status === 200, 'Task assignment returns HTTP 200');
  assert(assignRes.body?.success === true, 'Task assignment reports success: true');
  assert(assignRes.body?.task?.isManagementAssigned === true, 'Task flagged as management assigned');

  // Verify daily report payload structure
  const report = assignRes.body?.report;
  assert(report !== null && typeof report === 'object', 'Report object returned in response');
  assert(report.is_draft === true || report.isDraft === true, 'Report marked as draft');
  assert(Array.isArray(report.tasks), 'Report tasks is an array');
  assert(report.tasks.some(t => t.taskDescription === taskDesc), 'Assigned task is present in tasks array');
  assert(report.status === 'Draft', 'Virtual status "Draft" available in API contract for frontend');
  assert(typeof report.day_name === 'string', 'Virtual day_name available in API contract for frontend');

  // --------------------------------------------------------------------
  // TEST 2: Employee Checks Notifications
  // --------------------------------------------------------------------
  console.log('\n--- TEST 2: GET /api/notifications (Schema & Response Contract) ---');
  const notifRes = await simulate('GET', '/api/notifications', null, empToken);
  assert(notifRes.status === 200, 'Notifications endpoint returns HTTP 200');
  assert(notifRes.body?.success === true, 'Notifications response reports success: true');
  assert(Array.isArray(notifRes.body?.data), 'Notifications data is an array');

  // Check the notification that was created by task assignment
  const notif = notifRes.body.data.find(n => n.body?.includes(taskDesc) || n.message?.includes(taskDesc));
  assert(notif !== undefined, 'Assigned task notification delivered to employee');

  // Verify schema compliance
  const validTypes = ['info', 'leave', 'attendance', 'task', 'audit', 'announcement', 'system'];
  assert(validTypes.includes(notif.type), `Notification type '${notif.type}' is one of schema-allowed types: ${validTypes.join(', ')}`);
  assert(typeof notif.body === 'string' && notif.body.length > 0, 'Notification has NOT NULL "body" column matching schema');
  assert(typeof notif.message === 'string' && notif.message.length > 0, 'Notification retains "message" property for client contract');
  assert(typeof notif.text === 'string' && notif.text.length > 0, 'Notification retains "text" property for client contract');
  assert(notif.is_read === false, 'Notification has "is_read: false" database column');
  assert(notif.unread === true, 'Notification has "unread: true" mobile contract property');

  // --------------------------------------------------------------------
  // TEST 3: Employee Marks Notification As Read
  // --------------------------------------------------------------------
  console.log('\n--- TEST 3: PATCH /api/notifications/:id/read ---');
  const markReadRes = await simulate('PATCH', `/api/notifications/${notif.id}/read`, null, empToken);
  assert(markReadRes.status === 200, 'Mark read returns HTTP 200');
  assert(markReadRes.body?.success === true, 'Mark read reports success: true');

  // Re-fetch notifications to verify update
  const notifResAfterRead = await simulate('GET', '/api/notifications', null, empToken);
  const updatedNotif = notifResAfterRead.body.data.find(n => n.id === notif.id);
  assert(updatedNotif.is_read === true, 'is_read updated to true');
  assert(updatedNotif.unread === false, 'unread updated to false');

  // --------------------------------------------------------------------
  // TEST 4: Mark All Notifications Read
  // --------------------------------------------------------------------
  console.log('\n--- TEST 4: POST /api/notifications/mark-all-read ---');
  const markAllRes = await simulate('POST', '/api/notifications/mark-all-read', null, empToken);
  assert(markAllRes.status === 200, 'Mark all read returns HTTP 200');
  assert(markAllRes.body?.success === true, 'Mark all read reports success: true');

  const finalNotifsRes = await simulate('GET', '/api/notifications', null, empToken);
  assert(finalNotifsRes.body.data.every(n => n.is_read === true && n.unread === false), 'All notifications are marked read');

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS EXECUTED: ${totalTests}`);
  console.log(`PASSED:               ${passedTests}`);
  console.log(`FAILED:               0`);
  console.log('======================================================================\n');
  process.exit(0);
}

runSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

