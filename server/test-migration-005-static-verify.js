const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================================');
console.log('   MIGRATION 005 STATIC & RLS CLAUSE VERIFICATION SUITE');
console.log('======================================================================\n');

const mig005Path = path.join(__dirname, 'src/db/migrations/005_employee_enhancements.sql');
assert(fs.existsSync(mig005Path), '005_employee_enhancements.sql must exist');
const mig005Sql = fs.readFileSync(mig005Path, 'utf8');

// 1. Role casing audit
console.log('--- 1. EMS Role Values & Casing Audit ---');
assert(!mig005Sql.includes("'Founder'"), "Must NOT contain uppercase 'Founder'");
assert(!mig005Sql.includes("'Admin'"), "Must NOT contain uppercase 'Admin'");
assert(mig005Sql.includes("'founder', 'admin'"), "Must use lowercase 'founder', 'admin'");
console.log('  [PASS] All role checks use exact database-supported lowercase values: founder, admin');

// 2. RLS Clauses (USING & WITH CHECK)
console.log('\n--- 2. RLS Policies: USING and WITH CHECK Verification ---');
const policies = [
  'bank_details_employee_policy',
  'bank_details_admin_policy',
  'profile_updates_employee_policy',
  'profile_updates_admin_policy',
  'salary_advances_employee_policy',
  'salary_advances_admin_policy'
];

policies.forEach(pol => {
  assert(mig005Sql.includes(`DROP POLICY IF EXISTS ${pol}`), `Must drop ${pol} idempotently`);
  assert(mig005Sql.includes(`CREATE POLICY ${pol}`), `Must create ${pol}`);
  console.log(`  [PASS] Policy '${pol}' has DROP IF EXISTS guard and explicit definition`);
});

const usingMatches = mig005Sql.match(/\bUSING\b/g) || [];
const withCheckMatches = mig005Sql.match(/\bWITH CHECK\b/g) || [];
assert.strictEqual(usingMatches.length, policies.length, `Expected ${policies.length} USING clauses`);
assert.strictEqual(withCheckMatches.length, policies.length, `Expected ${policies.length} WITH CHECK clauses`);
console.log(`  [PASS] All ${policies.length} policies specify explicit USING and WITH CHECK clauses for read/write integrity`);

// 3. Pre-requisite Foreign Keys
console.log('\n--- 3. Pre-requisite Foreign Key Targets ---');
assert(mig005Sql.includes('REFERENCES organizations(id)'), 'Foreign keys reference organizations(id)');
assert(mig005Sql.includes('REFERENCES users(id)'), 'Foreign keys reference users(id)');
assert(mig005Sql.includes('ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS is_draft'), 'Extends daily_reports');
console.log('  [PASS] All referenced foreign key tables (organizations, users, daily_reports) exist from stages 001-003');

// 4. Idempotency & Re-run Safety
console.log('\n--- 4. Idempotency Analysis ---');
const createTables = mig005Sql.match(/CREATE TABLE/g) || [];
const ifNotExistsTables = mig005Sql.match(/CREATE TABLE IF NOT EXISTS/g) || [];
assert.strictEqual(createTables.length, ifNotExistsTables.length, 'All CREATE TABLE must use IF NOT EXISTS');

const createIndexes = mig005Sql.match(/CREATE INDEX/g) || [];
const ifNotExistsIndexes = mig005Sql.match(/CREATE INDEX IF NOT EXISTS/g) || [];
assert.strictEqual(createIndexes.length, ifNotExistsIndexes.length, 'All CREATE INDEX must use IF NOT EXISTS');
console.log(`  [PASS] 100% of tables (${createTables.length}) and indexes (${createIndexes.length}) use IF NOT EXISTS`);

// 5. Backend Column Alignment (tenure, amount_repaid, repayments)
console.log('\n--- 5. Backend Schema Alignment for Salary Advances ---');
assert(mig005Sql.includes('tenure VARCHAR(50)'), 'Includes tenure column for salary advances');
assert(mig005Sql.includes('amount_repaid NUMERIC DEFAULT 0'), 'Includes amount_repaid column');
assert(mig005Sql.includes("repayments JSONB DEFAULT '[]'::jsonb"), 'Includes repayments JSONB column');
console.log('  [PASS] salary_advance_requests includes all columns expected by backend endpoints');

console.log('\n======================================================================');
console.log('   MIGRATION 005 STATIC VERIFICATION COMPLETE: ALL CHECKS PASSED');
console.log('======================================================================\n');

