/**
 * Test Suite: Verify Removal of Duplicate Company Name in Mobile Management Screens
 * Validates Section 1, 2, 3, 4, 5, 6 of USER_REQUEST
 */

const fs = require('fs');
const path = require('path');
const babel = require('../mobile/node_modules/@babel/parser');

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

console.log('======================================================================');
console.log('   MANAGEMENT HEADER & DUPLICATE COMPANY NAME VERIFICATION');
console.log('======================================================================\n');

// 1. Inspect AdminDashboard.js (Persistent Top Header)
console.log('--- 1. AdminDashboard.js Top Header Invariants ---');
const adminDashboardPath = path.join(__dirname, '../mobile/src/screens/admin/AdminDashboard.js');
assert(fs.existsSync(adminDashboardPath), 'AdminDashboard.js exists');
const adminDashContent = fs.readFileSync(adminDashboardPath, 'utf8');

// Parse with Babel
let dashParsed = false;
try {
  babel.parse(adminDashContent, { sourceType: 'module', plugins: ['jsx'] });
  dashParsed = true;
} catch (e) {
  console.error(e.message);
}
assert(dashParsed, 'AdminDashboard.js parses cleanly with Babel JSX');

assert(adminDashContent.includes('styles.topBar'), 'Persistent topBar is present');
assert(adminDashContent.includes('styles.logoBadge'), 'Company logo badge is present');
assert(adminDashContent.includes('name="shield-checkmark"'), 'Shield icon is present in logo badge');
assert(adminDashContent.includes('organization?.name'), 'Dynamic organization name is rendered in top header');
assert(adminDashContent.includes('styles.topBarOrg'), 'topBarOrg style is applied to company name');
assert(adminDashContent.includes('styles.topBarUser'), 'Logged in user name and role are rendered in top header');
assert(adminDashContent.includes('roleDisplay'), 'Role display (FOUNDER / ADMIN / TEAM LEADER) is formatted in top header');
assert(adminDashContent.includes('styles.settingsIconBtn'), 'Settings icon button is present in top header');
assert(adminDashContent.includes('styles.logoutIconBtn'), 'Logout icon button is present in top header');
assert(adminDashContent.includes('safeInsets.top + 8'), 'Android status bar & safe area offset (safeInsets.top + 8) preserved');
assert(adminDashContent.includes('styles.bottomBar'), 'Bottom navigation bar is preserved');

// 2. Inspect AdminHomeScreen.js (Dashboard Body)
console.log("\n--- 2. AdminHomeScreen.js Body Invariants ---");
const adminHomePath = path.join(__dirname, '../mobile/src/screens/admin/AdminHomeScreen.js');
assert(fs.existsSync(adminHomePath), 'AdminHomeScreen.js exists');
const adminHomeContent = fs.readFileSync(adminHomePath, 'utf8');

let homeParsed = false;
try {
  babel.parse(adminHomeContent, { sourceType: 'module', plugins: ['jsx'] });
  homeParsed = true;
} catch (e) {
  console.error(e.message);
}
assert(adminHomeContent.includes("TODAY'S WORKFORCE METRICS"), "Workforce metrics section is present");
assert(!adminHomeContent.includes('styles.orgBanner'), 'Redundant orgBanner card has been removed from AdminHomeScreen.js');
assert(!adminHomeContent.includes('styles.orgBadge'), 'Redundant orgBadge has been removed');
assert(!adminHomeContent.includes('styles.orgName'), 'Redundant orgName has been removed');
assert(!adminHomeContent.includes('styles.roleTag'), 'Redundant roleTag has been removed');
assert(adminHomeContent.includes('RefreshControl'), 'Pull-to-refresh control is preserved on ScrollView');
assert(adminHomeContent.includes('refreshActionBtn'), 'Dedicated refresh action button is preserved in section header');
assert(adminHomeContent.includes('handleRefresh'), 'handleRefresh function is hooked up');

// 3. Inspect other management screens
console.log('\n--- 3. Audit Other Management Screens for Duplicate Headers ---');
const screensToCheck = [
  { file: 'AdminEmployeesScreen.js', name: 'Staff & Employees' },
  { file: 'AdminAttendanceScreen.js', name: 'Attendance & Shifts' },
  { file: 'AdminLeaveScreen.js', name: 'Approvals & Leaves' },
  { file: 'AdminReportsScreen.js', name: 'Daily Reports' },
  { file: 'AdminAuditsScreen.js', name: 'Audits' },
  { file: 'AdminSettingsScreen.js', name: 'Organization Settings' }
];

screensToCheck.forEach(({ file, name }) => {
  const filePath = path.join(__dirname, '../mobile/src/screens/admin', file);
  assert(fs.existsSync(filePath), `${file} exists`);
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify none has an orgBanner duplicate
  assert(!content.includes('orgBanner'), `${file} (${name}) has no redundant orgBanner`);
});

// Verify AdminSettingsScreen retains its legal settings form fields without duplicate header
const adminSettingsContent = fs.readFileSync(path.join(__dirname, '../mobile/src/screens/admin/AdminSettingsScreen.js'), 'utf8');
assert(adminSettingsContent.includes('Organization Legal Name'), 'AdminSettingsScreen retains Organization Legal Name form field');
assert(adminSettingsContent.includes('profileCard'), 'AdminSettingsScreen retains profile card');

// 4. Employee HomeScreen Invariants
console.log('\n--- 4. Employee Screen Non-Regression Invariants ---');
const empHomePath = path.join(__dirname, '../mobile/src/screens/HomeScreen.js');
assert(fs.existsSync(empHomePath), 'Employee HomeScreen.js exists');
const empHomeContent = fs.readFileSync(empHomePath, 'utf8');
assert(empHomeContent.includes('onNavigateToPunch'), 'Employee Punch navigation preserved');
assert(empHomeContent.includes('displayName'), 'Employee displayName preserved');

console.log('\n======================================================================');
console.log(`TOTAL TESTS EXECUTED: ${passed + failed}`);
console.log(`PASSED:               ${passed}`);
console.log(`FAILED:               ${failed}`);
console.log('======================================================================\n');

if (failed > 0) process.exit(1);
