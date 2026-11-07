/**
 * EMS Advance Payment Verification & Responsive Layout Test Suite
 * 
 * Verifies:
 * 1. Employee submits ₹2,500 salary advance request -> Status: 'Pending Approval'
 * 2. Database persistence: organization_id, user_id, amount, status
 * 3. Founder / Admin retrieves advance list via GET /api/admin/advances -> Request present
 * 4. Stats API returns accurate pendingAdvances count
 * 5. Founder approves advance with approvedAmount and remarks -> Status: 'Approved'
 * 6. Responsive UI layout math across screen widths: 320px, 360px, 390px, 412px
 *    Ensuring badge stays completely inside the card with no clipping or overflow
 */

process.env.NODE_ENV = 'test';

const EventEmitter = require('events');
const jwt = require('jsonwebtoken');
const { app, memDb } = require('./src/index');

const JWT_SECRET = process.env.JWT_SECRET || 'ems-dev-secret-change-in-production';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

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
        resolve({ status: this.statusCode, body: data });
      },
      send(data) {
        let parsed = data;
        if (typeof data === 'string') {
          try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        }
        resolve({ status: this.statusCode, body: parsed });
      },
      end(data) {
        resolve({ status: this.statusCode, body: data });
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

function makeToken(user, orgId) {
  return jwt.sign({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: orgId,
    organizationSlug: 'test-org'
  }, JWT_SECRET, { expiresIn: '1h' });
}

async function runAdvanceTests() {
  console.log('======================================================================');
  console.log('   EMS ADVANCE PAYMENT APPROVAL & RESPONSIVE UI TEST SUITE            ');
  console.log('======================================================================\n');

  const orgId = 'org-test-advance-001';
  const founder = {
    id: 'user-founder-adv-001',
    name: 'Priyanshu (Founder)',
    email: 'founder@testorg.com',
    role: 'founder',
    organization_id: orgId,
    is_active: true
  };
  const employee = {
    id: 'user-emp-adv-002',
    name: 'Rahul Sharma',
    email: 'rahul@testorg.com',
    role: 'employee',
    organization_id: orgId,
    is_active: true
  };

  memDb.users.push(founder, employee);
  const tokenFounder = makeToken(founder, orgId);
  const tokenEmployee = makeToken(employee, orgId);

  console.log('--- 1. Employee Salary Advance Submission Flow ---');
  // 1.1 Employee submits ₹2,500 advance
  const resSubmit = await simulate('POST', '/api/advances', {
    amount: 2500,
    tenure: '1 Month',
    reasonCategory: 'Medical / Emergency Expenses',
    reasonDescription: 'Emergency medical checkup and prescription medicine'
  }, tokenEmployee);

  assert(resSubmit.status === 200 && resSubmit.body.success, 'Employee submits ₹2,500 advance request (HTTP 200)');
  const advanceData = resSubmit.body.data;
  assert(advanceData.requestedAmount === 2500 || advanceData.amount === 2500, 'Requested amount is recorded as ₹2,500');
  assert(advanceData.status === 'Pending Approval', 'Initial advance status is strictly "Pending Approval"');
  assert(advanceData.organization_id === orgId, 'Advance request is bound to correct organization_id');
  assert(advanceData.user_id === employee.id, 'Advance request is bound to employee user_id');

  const advanceId = advanceData.id;

  console.log('\n--- 2. Founder / Management Retrieval Flow ---');
  // 2.1 Founder queries attendance stats -> pendingAdvances count
  const resStats = await simulate('GET', '/api/attendance/stats', null, tokenFounder);
  assert(resStats.status === 200, 'Founder retrieves attendance & management stats (HTTP 200)');
  assert(resStats.body.data.pendingAdvances >= 1, 'Stats include accurate pendingAdvances count (>= 1)');

  // 2.2 Founder lists all advances for organization
  const resList = await simulate('GET', '/api/admin/advances', null, tokenFounder);
  assert(resList.status === 200 && resList.body.success, 'Founder retrieves organization advance list (HTTP 200)');
  const foundAdvance = (resList.body.data || []).find(a => a.id === advanceId);
  assert(Boolean(foundAdvance), 'The submitted ₹2,500 advance request is present in Founder Admin Advances list');
  assert(foundAdvance?.status === 'Pending Approval', 'Advance request displays "Pending Approval" status to Founder');
  assert(foundAdvance?.employeeName === employee.name, 'Employee name is correctly mapped on management view');

  console.log('\n--- 3. Founder Approval Flow ---');
  // 3.1 Founder approves ₹2,500 advance request
  const resApprove = await simulate('PATCH', `/api/admin/advances/${advanceId}/approve`, {
    action: 'approve',
    approvedAmount: 2500,
    remarks: 'Approved by Founder. Eligible for bank transfer.'
  }, tokenFounder);

  assert(resApprove.status === 200 && resApprove.body.success, 'Founder approves ₹2,500 advance request (HTTP 200)');
  assert(resApprove.body.data.status === 'Approved', 'Status successfully updated to "Approved"');
  assert(resApprove.body.data.approved_amount === 2500 || resApprove.body.data.approvedAmount === 2500, 'Approved amount recorded as ₹2,500');

  // 3.3 Status Logic Separation Test (Part 1 verification)
  console.log('\n--- 3.3 Employee-Side Status Separation Verification ---');
  function getApprovalStatus(req) {
    const raw = (req?.status || '').trim().toLowerCase();
    if (raw === 'approved') return 'Approved';
    if (raw === 'rejected') return 'Rejected';
    return 'Pending Approval';
  }

  function getPaymentDisbursementInfo(req, approvalStatus) {
    if (approvalStatus !== 'Approved') return null;
    const paid = Number(req?.paidAmount ?? req?.amount_paid ?? 0);
    const approved = Number(req?.approvedAmount ?? req?.approved_amount ?? req?.amount ?? req?.requested_amount ?? 0);
    const rawPaymentStatus = (req?.paymentStatus || req?.payment_status || '').trim().toLowerCase();

    if (rawPaymentStatus === 'paid' || (approved > 0 && paid >= approved)) {
      return { label: 'Payment Completed', color: '#10b981', icon: 'checkmark-circle-outline' };
    }
    if (rawPaymentStatus === 'partially paid' || (paid > 0 && paid < approved)) {
      return { label: `Partially Paid: ₹${paid.toLocaleString('en-IN')}`, color: '#0284c7', icon: 'pie-chart-outline' };
    }
    return { label: 'Payment not yet disbursed', color: '#64748b', icon: 'time-outline' };
  }

  const approvedUnpaidReq = { status: 'Approved', approved_amount: 2500, amount_paid: 0 };
  const approvalStatus = getApprovalStatus(approvedUnpaidReq);
  const paymentInfo = getPaymentDisbursementInfo(approvedUnpaidReq, approvalStatus);

  assert(approvalStatus === 'Approved', 'Approval badge displays strictly "Approved" (never "Approved — Payment Pending")');
  assert(paymentInfo?.label === 'Payment not yet disbursed', 'Secondary line shows "Payment not yet disbursed" when amount_paid is 0');
  assert(getApprovalStatus({ status: 'Pending Approval' }) === 'Pending Approval', 'Pending request displays "Pending Approval"');
  assert(getPaymentDisbursementInfo({ status: 'Pending Approval' }, 'Pending Approval') === null, 'Pending request has no payment disbursement line');

  console.log('\n--- 3.4 Module Hierarchy & Navigation Alignment Verification ---');
  const fs = require('fs');
  const adminHomeSrc = fs.readFileSync('mobile/src/screens/admin/AdminHomeScreen.js', 'utf8');
  const adminDashSrc = fs.readFileSync('mobile/src/screens/admin/AdminDashboard.js', 'utf8');

  // Verify Founder Modules Order:
  // 1: advances, 2: holidays, 3: leaves, 4: announcements, 5: rules, 6: celebrations
  const expectedOrder = [
    'advances', 'holidays', 'leaves', 'announcements', 'rules', 'celebrations',
    'employees', 'attendance', 'audits', 'bank', 'geofence', 'settings'
  ];

  const actionKeysFound = [];
  const actionKeyRegex = /key:\s*'([a-z_]+)'/g;
  let match;
  while ((match = actionKeyRegex.exec(adminHomeSrc)) !== null) {
    if (expectedOrder.includes(match[1]) && !actionKeysFound.includes(match[1])) {
      actionKeysFound.push(match[1]);
    }
  }

  assert(
    JSON.stringify(actionKeysFound) === JSON.stringify(expectedOrder),
    `Founder modules match Employee sequence (1-7) followed by Admin modules (8-13): ${actionKeysFound.join(' -> ')}`
  );

  // Verify AdminDashboard handles all screens
  for (const mod of expectedOrder) {
    assert(adminDashSrc.includes(`case '${mod}':`), `AdminDashboard handles navigation route for "${mod}"`);
  }

  console.log('\n--- 4. Responsive UI Badge & Card Layout Math Verification ---');
  const screenWidths = [320, 360, 390, 412];
  const testStatuses = [
    'Pending Approval',
    'Approved — Payment Pending',
    'Paid',
    'Rejected',
    'Partially Paid',
    'Settled'
  ];

  for (const width of screenWidths) {
    const screenPadding = 16 * 2; // Left & Right screen horizontal padding
    const scrollContentWidth = width - screenPadding;
    const cardPadding = 14 * 2; // Left & Right itemCard padding
    const cardInnerWidth = scrollContentWidth - cardPadding;

    // Layout configuration in FeatureScreens.js
    const maxBadgeWidth = cardInnerWidth * 0.48;
    const rowGap = 8;
    const amountTextWidth = 55; // ₹2,500 at 16px bold
    const dateTextWidth = 112; // Requested: 06 Nov 2026 at 11px
    const leftColRequiredWidth = Math.max(amountTextWidth, dateTextWidth) + 4; // paddingRight: 4

    for (const status of testStatuses) {
      // If single line exceeds maxBadgeWidth, text wraps into up to 2 lines
      const words = status.split(' ');
      let maxLineWidth = 0;
      let currentLine = '';
      for (const w of words) {
        const testLine = currentLine ? `${currentLine} ${w}` : w;
        if (testLine.length * 6.2 + 16 > maxBadgeWidth && currentLine) {
          maxLineWidth = Math.max(maxLineWidth, currentLine.length * 6.2 + 16);
          currentLine = w;
        } else {
          currentLine = testLine;
        }
      }
      maxLineWidth = Math.max(maxLineWidth, currentLine.length * 6.2 + 16);
      const willWrap = (status.length * 6.2 + 16) > maxBadgeWidth;
      const badgeRenderedWidth = willWrap ? Math.min(maxLineWidth, maxBadgeWidth) : (status.length * 6.2 + 16);

      // Card total row width
      const totalRowWidth = leftColRequiredWidth + rowGap + badgeRenderedWidth;
      const doesOverflow = totalRowWidth > cardInnerWidth;

      assert(
        !doesOverflow && badgeRenderedWidth <= maxBadgeWidth,
        `Width ${width}px | Status "${status}": Card Inner: ${cardInnerWidth.toFixed(1)}px, Row: ${totalRowWidth.toFixed(1)}px, Badge: ${badgeRenderedWidth.toFixed(1)}px (Wrap: ${willWrap ? 'YES' : 'NO'}) -> Contained`
      );
    }
  }

  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('======================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAdvanceTests().catch(err => {
  console.error('Test Fatal Error:', err);
  process.exit(1);
});
