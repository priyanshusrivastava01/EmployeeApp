# EmployeeApp — Staging & Test Environment Guide

This guide explains how to configure a dedicated, completely isolated Supabase staging project for write-based integration and end-to-end testing in EmployeeApp.

---

## 1. Why Staging Isolation is Required

The EmployeeApp production database (`https://ixxueouqbnkpcakeiekb.supabase.co`) stores live organization data (`VAR001` / `Priyaan`), employee profiles, attendance logs, and company policies.

Write-based integration tests create test organizations, register founder accounts, add employees, publish announcements, and submit attendance/task records. To ensure production data integrity, zero downtime, and zero data pollution, **integration tests must run exclusively against an isolated staging Supabase project**.

### Production Safety Guard Architecture

The EmployeeApp test harness includes automated safety guards:
1. **No Fallback to Production**: If `server/.env.test` is missing, integration tests abort immediately with an error. They will **never** fall back to `server/.env`.
2. **Production URL Blocklist**: If `SUPABASE_URL` in `server/.env.test` contains `ixxueouqbnkpcakeiekb.supabase.co` (the production instance), the test runner immediately halts with a `CRITICAL SECURITY VIOLATION`.
3. **Placeholder Rejection**: If `server/.env.test` contains unconfigured placeholders, tests refuse to run.
4. **Child-Before-Parent Cleanup**: All test-created organizations, branches, users, and business records are deleted in reverse dependency order and verified after test execution.

---

## 2. Step-by-Step Staging Setup Instructions

### Step 1: Create a Free Staging Project on Supabase
1. Log in to [Supabase](https://supabase.com).
2. Click **New Project**.
3. Set the project name (e.g., `EmployeeApp-Staging`).
4. Select a database password and choose your nearest region (e.g., `ap-south-1` / Mumbai).
5. Wait for the database provisioning to complete (~1-2 minutes).

### Step 2: Apply Database Schema & Migrations
In your new Supabase project dashboard:
1. Navigate to the **SQL Editor** in the left sidebar.
2. Open and execute the baseline schema:
   - File: `server/src/db/schema.sql`
3. Execute the migrations sequentially in order:
   - `server/src/db/migrations/001_multi_organization_tenancy.sql`
   - `server/src/db/migrations/002_attendance_and_reports.sql`
   - `server/src/db/migrations/003_storage_policies.sql`
   - `server/src/db/migrations/004_daily_reports_and_audits.sql`
   - `server/src/db/migrations/005_performance_ratings_and_leaves.sql`
   - `server/src/db/migrations/006_announcements_and_rules.sql`
   - `server/src/db/migrations/007_timesheets_and_notifications.sql`
   - `server/src/db/migrations/008_bank_details_and_salary_advances.sql`
   - `server/src/db/migrations/009_profile_update_requests.sql`
   - `server/src/db/migrations/010_rls_security_hardening.sql`
   - `server/src/db/migrations/011_fix_recursive_rls_and_unrestricted_tables.sql`
   - `server/src/db/migrations/012_storage_private_buckets_setup.sql`
   - `server/src/db/migrations/013_multi_branch_and_geofencing.sql`

### Step 3: Copy & Configure `server/.env.test`
1. Copy the example configuration template:
   ```powershell
   copy server\.env.test.example server\.env.test
   ```
2. Open `server/.env.test` in your editor.
3. In your staging Supabase project dashboard, navigate to **Project Settings -> API**:
   - Copy **Project URL** into `SUPABASE_URL`
   - Copy **service_role (secret)** into `SUPABASE_SERVICE_ROLE_KEY`
4. Save the file:
   ```ini
   PORT=5000
   NODE_ENV=test
   HOST=0.0.0.0

   SUPABASE_URL=https://<your-staging-project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

   JWT_SECRET=ems_staging_test_jwt_secret_32chars_long
   ORG_SETUP_KEY=staging_test_org_setup_key_2026
   ```

---

## 3. Running Tests

### Running Staging Integration Tests
```bash
# Runs pre-flight safety checks, then executes real backend & UI integration tests
npm run test:integration
```

### Running Non-Destructive Client UI Tests
The client-side UI and component suites do not perform write operations and run without needing a staging database:
```bash
# Run the 23 client UI / role dashboard tests (safe, offline/synthetic)
npx playwright test tests/auth tests/founder-dashboard tests/admin-dashboard tests/team-leader-dashboard tests/employee-dashboard tests/navigation tests/responsive tests/error-handling --project=chromium
```

### Cleaning Up Interrupted Runs
If a test process was forcefully killed (e.g. terminal closed mid-run) before `afterAll` could execute, run the standalone cleanup utility:
```bash
# Cleans orphaned test organizations prefixed with TEST_STG_ from the staging database
npm run test:cleanup
```

---

## 4. Verification & Protection Summary

| Environment | Config File | Database Host | Allowed Tests |
| :--- | :--- | :--- | :--- |
| **Production** | `server/.env` | `ixxueouqbnkpcakeiekb.supabase.co` | **Read-only health/status checks only. Write tests strictly blocked.** |
| **Development** | `server/.env` | Local or Dev instance | Normal application runtime and manual development. |
| **Testing/CI** | `server/.env.test` | Staging project only (`<staging-ref>.supabase.co`) | Full write-based integration and end-to-end suites. |
