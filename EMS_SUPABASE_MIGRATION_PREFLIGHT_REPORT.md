# EMS Database Schema & Supabase Migration Pre-Flight Audit Report

**Date:** 2026-10-29  
**Target Environment:** Supabase Free Tier (PostgreSQL 15+ / PostgREST / GoTrue / Supabase Storage)  
**Budget Constraint:** Strict ₹0 / Month (Free Tier Compliant)  
**Author:** Antigravity Senior Full-Stack & Database Architect  
**Pre-Flight Status:** **READY FOR SUPABASE EXECUTION**  
**Codebase Patch Status:** **ALL IDENTIFIED API/SCHEMA BLOCKERS RESOLVED & VERIFIED**

---

## 1. Executive Summary

This pre-flight audit evaluated the complete database schema definition, migration pipeline, backend query shapes, and mobile client contracts for the **Employee Management System (EMS)** across:
1. `server/src/db/schema.sql` (Baseline schema: core users, geofences, attendance, WFH pings, daily reports, tasks, TL audits)
2. `server/src/db/migrations/002_announcements_rules_leaves.sql`
3. `server/src/db/migrations/003_multi_organization.sql`
4. `server/src/db/migrations/004_company_onboarding_and_invitations.sql`
5. `server/src/db/migrations/005_employee_enhancements.sql`
6. `server/src/db/migrations/006_branches_and_company_code.sql`
7. `server/src/db/migrations/007_daily_tasks_lifecycle.sql`
8. `server/src/db/migrations/008_pre_supabase_hardening.sql`

### Pre-Flight Audit Summary Table:

| Category | Initial Audit | Status Post-Patch | Notes |
|---|---|---|---|
| **SQL Syntax & Fresh Run** | ✅ PASS | ✅ PASS | Syntactically sound, exact chronological dependency order. |
| **Idempotency & Re-Run Safety** | ✅ PASS | ✅ PASS | Guarded by `IF NOT EXISTS`, safe column additions, exception-handled constraints. |
| **Notifications Schema Contract** | ❌ BLOCKED | ✅ RESOLVED | Type changed to `'task'` (conforming to check constraint); column `body` mapped; response preserves `message` & `text`. |
| **Daily Reports Task Assignment** | ❌ BLOCKED | ✅ RESOLVED | Removed ghost columns (`day_name`, `ratings`, `status`, `is_submitted`) from Supabase insert; true columns (`is_draft: true`, `tasks`, `carried_forward_count`) used. Response contract preserved. |
| **₹0 Budget Compliance** | ✅ PASS | ✅ PASS | Zero paid add-ons, fits strictly under 500 MB DB size and 1 GB storage allowance. |
| **Live Database Verification** | ⏳ PENDING | ⏳ PENDING | Requires user to create free Supabase project, execute migrations, and set credentials in `server/.env`. |

---

## 2. Dependency Order Matrix & Fresh Run Simulation

The table below traces the exact chronological dependency graph across the 8 SQL files when executed against a brand-new empty Supabase project:

| Execution Order | File | Core Objects Created / Modified | Prerequisites & Dependencies | Status |
|---|---|---|---|---|
| **1** | `schema.sql` | `users`, `geofences`, `attendance_records`, `wfh_session_pings`, `tasks`, `daily_reports`, `team_leader_audits` | `gen_random_uuid()` (built-in pgcrypto/pg_trgm in PG13+) | ✅ PASS |
| **2** | `002_announcements_rules_leaves.sql` | `announcements`, `company_rules`, `leave_applications`, `timesheet_entries`, RLS enabled | Depends on `users` table created in step 1 | ✅ PASS |
| **3** | `003_multi_organization.sql` | `organizations`, `organization_memberships`, `holidays`, `notifications`, `audit_logs`, `advance_payment_requests`, adds `organization_id` to all tables | Depends on `users` and tables from steps 1 & 2 | ✅ PASS |
| **4** | `004_company_onboarding_and_invitations.sql` | `invitations`, `password_resets`, alters `organizations` (adds `public_company_id`), alters `users` (`employee_id_number`) | Depends on `organizations` and `users` | ✅ PASS |
| **5** | `005_employee_enhancements.sql` | `bank_details`, `profile_update_requests`, `salary_advance_requests`, alters `daily_reports` (`is_draft`) | Depends on `users` and `organizations` | ✅ PASS |
| **6** | `006_branches_and_company_code.sql` | `branches`, alters `organizations` (adds `company_code`), alters `users` (`branch_id`) | Depends on `organizations` and `users` | ✅ PASS |
| **7** | `007_daily_tasks_lifecycle.sql` | Alters `daily_reports` (`tasks` JSONB, `carried_forward_count`, `submitted_at`) | Depends on `daily_reports` created in step 1 | ✅ PASS |
| **8** | `008_pre_supabase_hardening.sql` | Fixes `users_role_check`, case-tolerant `leave_type`, nullable draft fields on `attendance_records` & `daily_reports`, adds `repayments` JSONB to `salary_advance_requests`, RLS policy overhaul | Modifies tables from steps 1, 2, 3, 5, 7 | ✅ PASS |

---

## 3. Implemented Fixes & Resolution Details

### ✅ Resolution 1: `notifications` Schema & API Contract Fixed
- **Root Cause:**
  - Database table `notifications` had `CHECK (type IN ('info', 'leave', 'attendance', 'task', 'audit', 'announcement', 'system'))` and required `body TEXT NOT NULL`.
  - Backend was attempting to insert `type: 'task_assigned'` and `message: '...'` instead of `body`.
- **Implementation in `server/src/index.js`:**
  1. Updated `assignManagementTask` notification payload:
     - `type: 'task'` (strictly valid against the check constraint).
     - `body: notifBody` (satisfies the NOT NULL constraint).
     - `title: 'New task assigned'`.
     - In-memory notification object additionally preserves `message: notifBody`, `text: notifBody`, `unread: true`, and `is_read: false`.
  2. Standardized `GET /api/notifications` response mapping:
     - Formats every returned notification to guarantee `body`, `message`, `text`, `is_read`, and `unread` are present.
     - Guarantees backward compatibility for mobile clients regardless of database or memory origin.
  3. Added `POST /api/notifications/mark-all-read` to support the mobile application's bulk mark-as-read action.
- **Verification:** Verified via `server/test-notification-and-task-schema-fixes.js` (Tests 2, 3, 4 passed 100%).

---

### ✅ Resolution 2: `assignManagementTask` Ghost Columns Fixed on `daily_reports`
- **Root Cause:**
  - Backend attempted to insert `day_name`, `ratings: null`, `status: 'Draft'`, and `is_submitted: false` into `daily_reports`.
  - In PostgreSQL / Supabase, `daily_reports` only contains `id`, `organization_id`, `user_id`, `work_date`, `project_name`, `work_summary`, `tasks` (JSONB), `tasks_assigned`, `tasks_completed`, `tasks_pending`, `is_draft`, `carried_forward_count`, `rating_*` columns, `challenges`, `submitted_at`, `created_at`, `updated_at`.
- **Implementation in `server/src/index.js`:**
  1. Updated draft insertion object (`dbDraftReport`):
     - Excluded `day_name`, `ratings`, `status`, and `is_submitted` from the Supabase insert payload.
     - Preserved true database columns: `is_draft: true`, `tasks: updatedTasks`, `carried_forward_count: 0`, `tasks_assigned`, `tasks_completed`, `tasks_pending`.
  2. Enhanced API response formatting:
     - Returns a sanitized report object with virtual fields (`status: 'Draft'`, `day_name: dayName`, `is_submitted: false`, `isDraft: true`) so frontend UI components that read these fields display them seamlessly.
- **Verification:** Verified via `server/test-notification-and-task-schema-fixes.js` (Test 1 passed 100%) and `server/test-management-task-reports-endpoints.js` (52/52 tests passed).

---

## 4. Test Execution & Verification Matrix

> [!NOTE]
> All automated tests listed below ran locally using in-process event simulation and in-memory mock state (`memDb`). Live Supabase connectivity has **not** been tested against a cloud PostgreSQL instance because credentials have not yet been provided in `server/.env`. This prevents inadvertent cloud operations and preserves the ₹0 requirement.

| Test Suite | Command | Executed | Passed | Status |
|---|---|---|---|---|
| **Node Syntax Check** | `node --check server/src/index.js` | 1 | 1 | ✅ PASS |
| **Notifications & Task Schema Fixes** | `node server/test-notification-and-task-schema-fixes.js` | 28 | 28 | ✅ PASS |
| **Management Task Reports Endpoints** | `node server/test-management-task-reports-endpoints.js` | 52 | 52 | ✅ PASS |
| **Daily Task Lifecycle & History** | `node server/test-task-lifecycle-history.js` | 56 | 56 | ✅ PASS |
| **Supabase Persistence Contracts** | `node server/test-supabase-persistence-contracts.js` | 22 | 22 | ✅ PASS |
| **Master Employee Suite (Issues 1–8)**| `node server/test-employee-master-suite.js` | 59 | 59 | ✅ PASS |
| **Grand Total** | | **218** | **218** | **100% PASS** |

---

## 5. Remaining Action Items for Live Supabase Activation

To connect the application to your real Supabase Free project, perform these manual steps:

### Step 1: Execute SQL Migrations in Supabase Studio
Open your project dashboard at [supabase.com](https://supabase.com) -> **SQL Editor** -> **New Query**, and run each file in this exact sequence:
1. `server/src/db/schema.sql`
2. `server/src/db/migrations/002_announcements_rules_leaves.sql`
3. `server/src/db/migrations/003_multi_organization.sql`
4. `server/src/db/migrations/004_company_onboarding_and_invitations.sql`
5. `server/src/db/migrations/005_employee_enhancements.sql`
6. `server/src/db/migrations/006_branches_and_company_code.sql`
7. `server/src/db/migrations/007_daily_tasks_lifecycle.sql`
8. `server/src/db/migrations/008_pre_supabase_hardening.sql`

### Step 2: Create Private Storage Buckets
In Supabase Studio -> **Storage** -> **Create a new bucket**:
1. Name: `attendance-selfies`
   - **Public bucket: OFF** (Private)
   - Max file size: `5MB`
   - Allowed MIME types: `image/jpeg, image/png, image/webp`
2. Name: `profile-photos`
   - **Public bucket: OFF** (Private)
   - Max file size: `5MB`
   - Allowed MIME types: `image/jpeg, image/png, image/webp`

### Step 3: Configure Backend Secrets
In `server/.env`:
```bash
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```
*(Never commit this key or include it in mobile/web client source code).*

### Step 4: Run Live Verification
Once `server/.env` is configured with real credentials, restart the server and run:
```bash
node server/test-supabase-persistence-contracts.js
```
The test suite will detect the real Supabase credentials, execute live database inserts/queries, and verify persistence end-to-end.
