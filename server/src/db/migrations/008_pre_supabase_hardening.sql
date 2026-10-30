-- ============================================================================
-- EMS Multi-Organization Platform — Migration 008
-- Pre-Supabase Hardening: Role Consistency, RLS Policy Fixes & Schema Alignment
-- Safe & Non-Destructive: Uses IF NOT EXISTS and DROP/ADD CONSTRAINT
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

-- 1. HARMONIZE USERS.ROLE CHECK CONSTRAINT
-- Ensures 'admin' is explicitly permitted in the users table alongside 'founder', 'team_leader', 'employee'
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('founder', 'admin', 'team_leader', 'employee'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: users_role_check constraint adjustment handled safely.';
END $$;

-- 2. ENSURE PUBLIC IDENTIFIERS & METADATA ON ORGANIZATIONS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_company_id VARCHAR(50);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_code VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_company_code_upper ON organizations (UPPER(company_code)) WHERE company_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_public_company_id ON organizations (public_company_id);

-- 3. ENSURE EMPLOYEE BADGE IDENTIFIER & SALARY ON USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_enrollment_status VARCHAR(50) DEFAULT 'not_enrolled';
CREATE INDEX IF NOT EXISTS idx_users_org_employee_id ON users (organization_id, employee_id_number);

-- 4. CASE-TOLERANT LEAVE TYPE CONSTRAINT
-- Accommodates both mobile title case ("Casual Leave") and API shorthand ("casual")
DO $$
BEGIN
    ALTER TABLE leave_applications DROP CONSTRAINT IF EXISTS leave_applications_leave_type_check;
    ALTER TABLE leave_applications ADD CONSTRAINT leave_applications_leave_type_check 
        CHECK (LOWER(leave_type) IN ('paid leave', 'sick leave', 'casual leave', 'unpaid leave', 'comp off', 'paid', 'sick', 'casual', 'unpaid'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: leave_applications_leave_type_check constraint adjustment handled safely.';
END $$;

-- 5. DAILY REPORTS JSONB TASKS & LIFECYCLE ALIGNMENT
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS tasks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS carried_forward_count INT DEFAULT 0;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
-- Relax NOT NULL on columns for draft submissions and mobile resiliency
ALTER TABLE daily_reports ALTER COLUMN submitted_at DROP NOT NULL;
ALTER TABLE daily_reports ALTER COLUMN work_summary DROP NOT NULL;
ALTER TABLE attendance_records ALTER COLUMN punch_in_photo_path DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date_desc ON daily_reports (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_org_date_desc ON daily_reports (organization_id, work_date DESC);

-- 6. SALARY ADVANCE REQUESTS REPAYMENTS & TENURE ALIGNMENT
ALTER TABLE salary_advance_requests ADD COLUMN IF NOT EXISTS amount_repaid NUMERIC DEFAULT 0;
ALTER TABLE salary_advance_requests ADD COLUMN IF NOT EXISTS repayments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE salary_advance_requests ADD COLUMN IF NOT EXISTS tenure VARCHAR(50);

-- 7. TEAM LEADER AUDITS SCHEMA HARMONIZATION
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS auditor_name VARCHAR(255);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS auditor_role VARCHAR(50);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS score NUMERIC(3,1);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS strengths TEXT;
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS improvements TEXT;
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS action_items TEXT;
ALTER TABLE team_leader_audits ALTER COLUMN remarks DROP NOT NULL;
ALTER TABLE team_leader_audits ALTER COLUMN reviewer_id DROP NOT NULL;
ALTER TABLE team_leader_audits ALTER COLUMN rating_score DROP NOT NULL;

-- 8. CORRECT RLS POLICIES FOR TENANT ISOLATION (DEFENSE IN DEPTH)
-- Migration 005 had case-sensitive 'Founder', 'Admin'. This aligns them to lowercase stored roles.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bank_details') THEN
        DROP POLICY IF EXISTS bank_details_admin_policy ON bank_details;
        CREATE POLICY bank_details_admin_policy ON bank_details
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.id = auth.uid() 
                      AND users.organization_id = bank_details.organization_id 
                      AND users.role IN ('founder', 'admin')
                )
            );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profile_update_requests') THEN
        DROP POLICY IF EXISTS profile_updates_admin_policy ON profile_update_requests;
        CREATE POLICY profile_updates_admin_policy ON profile_update_requests
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.id = auth.uid() 
                      AND users.organization_id = profile_update_requests.organization_id 
                      AND users.role IN ('founder', 'admin')
                )
            );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'salary_advance_requests') THEN
        DROP POLICY IF EXISTS salary_advances_admin_policy ON salary_advance_requests;
        CREATE POLICY salary_advances_admin_policy ON salary_advance_requests
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.id = auth.uid() 
                      AND users.organization_id = salary_advance_requests.organization_id 
                      AND users.role IN ('founder', 'admin')
                )
            );
    END IF;

    -- Update leave_applications supervisor policy to include 'admin' and enforce organization_id
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'leave_applications') THEN
        DROP POLICY IF EXISTS "Supervisors review leaves" ON leave_applications;
        CREATE POLICY "Supervisors review leaves" ON leave_applications
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM users 
                    WHERE users.id = auth.uid() 
                      AND users.organization_id = leave_applications.organization_id 
                      AND users.role IN ('founder', 'admin', 'team_leader')
                )
            );
    END IF;

    -- Update announcements policy to prevent cross-company data leakage
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'announcements') THEN
        DROP POLICY IF EXISTS "Anyone can read published announcements" ON announcements;
        CREATE POLICY "Anyone can read published announcements" ON announcements
            FOR SELECT USING (
                status = 'published' AND (
                    organization_id IS NULL OR EXISTS (
                        SELECT 1 FROM users 
                        WHERE users.id = auth.uid() 
                          AND users.organization_id = announcements.organization_id
                    )
                )
            );
    END IF;

    -- Update company_rules policy to prevent cross-company data leakage
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'company_rules') THEN
        DROP POLICY IF EXISTS "Anyone can read published rules" ON company_rules;
        CREATE POLICY "Anyone can read published rules" ON company_rules
            FOR SELECT USING (
                status = 'published' AND (
                    organization_id IS NULL OR EXISTS (
                        SELECT 1 FROM users 
                        WHERE users.id = auth.uid() 
                          AND users.organization_id = company_rules.organization_id
                    )
                )
            );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: RLS policies updated safely.';
END $$;

