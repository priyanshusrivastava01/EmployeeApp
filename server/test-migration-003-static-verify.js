const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('   MIGRATION 003 STATIC & CROSS-STAGE DEPENDENCY AUDIT');
console.log('======================================================================\n');

const schemaPath = path.join(__dirname, 'src/db/schema.sql');
const mig002Path = path.join(__dirname, 'src/db/migrations/002_announcements_rules_leaves.sql');
const mig003Path = path.join(__dirname, 'src/db/migrations/003_multi_organization.sql');
const mig004Path = path.join(__dirname, 'src/db/migrations/004_company_onboarding_and_invitations.sql');
const mig005Path = path.join(__dirname, 'src/db/migrations/005_employee_enhancements.sql');
const mig006Path = path.join(__dirname, 'src/db/migrations/006_branches_and_company_code.sql');
const mig007Path = path.join(__dirname, 'src/db/migrations/007_daily_tasks_lifecycle.sql');
const mig008Path = path.join(__dirname, 'src/db/migrations/008_pre_supabase_hardening.sql');

const files = [schemaPath, mig002Path, mig003Path, mig004Path, mig005Path, mig006Path, mig007Path, mig008Path];
files.forEach(f => assert(fs.existsSync(f), `File must exist: ${f}`));

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
const mig002Sql = fs.readFileSync(mig002Path, 'utf8');
const mig003Sql = fs.readFileSync(mig003Path, 'utf8');
const mig004Sql = fs.readFileSync(mig004Path, 'utf8');
const mig005Sql = fs.readFileSync(mig005Path, 'utf8');
const mig006Sql = fs.readFileSync(mig006Path, 'utf8');
const mig007Sql = fs.readFileSync(mig007Path, 'utf8');
const mig008Sql = fs.readFileSync(mig008Path, 'utf8');

// 1. Verify existence of all tables altered in 003
console.log('--- 1. Verification of Pre-existing Tables Altered in 003 ---');
const preExistingTables = [
  { table: 'users', source: 'schema.sql' },
  { table: 'attendance_records', source: 'schema.sql' },
  { table: 'wfh_session_pings', source: 'schema.sql' },
  { table: 'geofences', source: 'schema.sql' },
  { table: 'tasks', source: 'schema.sql' },
  { table: 'daily_reports', source: 'schema.sql' },
  { table: 'team_leader_audits', source: 'schema.sql' },
  { table: 'announcements', source: '002' },
  { table: 'company_rules', source: '002' },
  { table: 'leave_applications', source: '002' },
  { table: 'timesheet_entries', source: '002' }
];

preExistingTables.forEach(t => {
  const present = (t.source === 'schema.sql' ? schemaSql : mig002Sql).includes(`TABLE IF NOT EXISTS ${t.table}`);
  assert(present, `Pre-requisite table ${t.table} must exist in ${t.source}`);
  console.log(`  [PASS] Target table '${t.table}' confirmed created in ${t.source}`);
});

// 2. Foreign Key Integrity within 003
console.log('\n--- 2. Foreign Key & Dependency Integrity ---');
assert(mig003Sql.includes('CREATE TABLE IF NOT EXISTS organizations'), '003 defines organizations table');
assert(mig003Sql.includes('REFERENCES organizations(id)'), '003 foreign keys reference organizations(id)');
assert(mig003Sql.includes('REFERENCES users(id)'), '003 foreign keys reference users(id)');
console.log('  [PASS] All foreign key targets (organizations, users) are valid');

// 3. Downstream Dependency Verification (004 through 008 relying on 003)
console.log('\n--- 3. Downstream Compatibility (Migrations 004 - 008) ---');
// 004 relies on organizations and users.organization_id
assert(mig004Sql.includes('ALTER TABLE organizations'), '004 extends organizations table created in 003');
assert(mig004Sql.includes('users(organization_id'), '004 creates index using organization_id added in 003');
assert(mig004Sql.includes('REFERENCES organizations(id)'), '004 invitations references organizations(id)');
console.log('  [PASS] Migration 004 dependencies on 003 confirmed');

// 005 relies on organizations
assert(mig005Sql.includes('REFERENCES organizations(id)'), '005 tables reference organizations(id)');
console.log('  [PASS] Migration 005 dependencies on 003 confirmed');

// 006 relies on organizations
assert(mig006Sql.includes('ALTER TABLE organizations'), '006 extends organizations table');
assert(mig006Sql.includes('REFERENCES organizations(id)'), '006 branches references organizations(id)');
console.log('  [PASS] Migration 006 dependencies on 003 confirmed');

// 007 relies on daily_reports.organization_id
assert(mig007Sql.includes('idx_daily_reports_org_date ON daily_reports (organization_id'), '007 indexes organization_id on daily_reports');
console.log('  [PASS] Migration 007 dependencies on 003 confirmed');

// 008 relies on organizations and multi-tenant schema
assert(mig008Sql.includes('ALTER TABLE organizations'), '008 hardens organizations');
console.log('  [PASS] Migration 008 dependencies on 003 confirmed');

// 4. Idempotency & Re-run Safety
console.log('\n--- 4. Idempotency & Re-Run Safety Analysis ---');
const tableCreates = mig003Sql.match(/CREATE TABLE/g) || [];
const ifNotExistsTables = mig003Sql.match(/CREATE TABLE IF NOT EXISTS/g) || [];
assert.strictEqual(tableCreates.length, ifNotExistsTables.length, 'All CREATE TABLE must use IF NOT EXISTS');

const alterAdds = mig003Sql.match(/ADD COLUMN/g) || [];
const ifNotExistsCols = mig003Sql.match(/ADD COLUMN IF NOT EXISTS/g) || [];
assert.strictEqual(alterAdds.length, ifNotExistsCols.length, 'All ADD COLUMN must use IF NOT EXISTS');

const indexCreates = mig003Sql.match(/CREATE INDEX/g) || [];
const ifNotExistsIndexes = mig003Sql.match(/CREATE INDEX IF NOT EXISTS/g) || [];
assert.strictEqual(indexCreates.length, ifNotExistsIndexes.length, 'All CREATE INDEX must use IF NOT EXISTS');
console.log(`  [PASS] All ${tableCreates.length} tables, ${alterAdds.length} column additions, and ${indexCreates.length} indexes are protected with IF NOT EXISTS`);

// 5. EMS Role Coverage & Notifications Resilience
console.log('\n--- 5. EMS Roles & Dual-Field Schema Resilience ---');
assert(mig003Sql.includes("'founder', 'admin', 'team_leader', 'employee'"), 'organization_memberships includes all 4 EMS roles');
console.log('  [PASS] organization_memberships accommodates founder, admin, team_leader, and employee');

assert(mig003Sql.includes('body TEXT NOT NULL'), 'notifications has body column');
assert(mig003Sql.includes('message TEXT'), 'notifications has dual-support message column');
assert(mig003Sql.includes("'task', 'task_assigned'"), 'notifications check constraint accommodates both task and task_assigned');
console.log('  [PASS] notifications table dual-supports body/message and task/task_assigned');

console.log('\n======================================================================');
console.log('   MIGRATION 003 VERIFICATION COMPLETE: ALL CHECKS PASSED (100%)');
console.log('======================================================================\n');

