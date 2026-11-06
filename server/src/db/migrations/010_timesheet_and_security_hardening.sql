-- ============================================================================
-- Migration 010: Timesheet & Leave Security Hardening (Audited & Hardened)
-- Purpose:
--   1. Support 'rejected' status and review audit trails on timesheet_entries
--   2. Dynamically clean up legacy check constraints on timesheet_entries with precision
--   3. Drop conflicting legacy RLS policies from migration 002 (preventing RLS bypass)
--   4. Strengthen tenant, team, and self-approval RLS policies for timesheet_entries and leave_applications
--   5. Enforce strict WITH CHECK conditions on all UPDATE policies to prevent ownership & tenant tampering
-- ============================================================================

-- 1. PRECISELY IDENTIFY AND DROP EXISTING TIMESHEET STATUS CHECK CONSTRAINTS & RE-CREATE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'timesheet_entries'
          AND con.contype = 'c'
          AND (
              con.conname = 'timesheet_entries_status_check'
              OR (
                  pg_get_constraintdef(con.oid) ILIKE '%status%'
                  AND pg_get_constraintdef(con.oid) ILIKE '%draft%'
                  AND pg_get_constraintdef(con.oid) ILIKE '%submitted%'
              )
          )
    ) LOOP
        EXECUTE 'ALTER TABLE timesheet_entries DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;

    -- Re-create explicit constraint supporting 'rejected'
    ALTER TABLE timesheet_entries 
        ADD CONSTRAINT timesheet_entries_status_check 
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- 2. ADD AUDIT COLUMNS TO TIMESHEET ENTRIES
ALTER TABLE timesheet_entries 
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS review_remarks TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_timesheet_org_user ON timesheet_entries(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_org_date ON timesheet_entries(organization_id, work_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_org_status ON timesheet_entries(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leaves_org_status ON leave_applications(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leaves_org_user ON leave_applications(organization_id, user_id);

-- 4. HARDEN TIMESHEET ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;

-- Clean up ALL legacy policies from migration 002 & previous attempts
DROP POLICY IF EXISTS "Employees manage own timesheets" ON timesheet_entries;
DROP POLICY IF EXISTS "Supervisors view timesheets" ON timesheet_entries;
DROP POLICY IF EXISTS "Employees view own timesheets" ON timesheet_entries;
DROP POLICY IF EXISTS "Employees insert own timesheets" ON timesheet_entries;
DROP POLICY IF EXISTS "Timesheet update policy" ON timesheet_entries;
DROP POLICY IF EXISTS "Timesheet delete policy" ON timesheet_entries;

-- Policy: SELECT
CREATE POLICY "Employees view own timesheets" ON timesheet_entries
    FOR SELECT USING (
        (user_id = auth.uid() AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = timesheet_entries.organization_id 
            AND users.role IN ('founder', 'admin')
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = timesheet_entries.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = timesheet_entries.organization_id
        )
    );

-- Policy: INSERT
CREATE POLICY "Employees insert own timesheets" ON timesheet_entries
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND status IN ('draft', 'submitted')
        AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    );

-- Policy: UPDATE (With strict WITH CHECK preventing self-approval and ownership tampering)
CREATE POLICY "Timesheet update policy" ON timesheet_entries
    FOR UPDATE USING (
        (user_id = auth.uid() AND status IN ('draft', 'submitted'))
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = timesheet_entries.organization_id 
            AND users.role IN ('founder', 'admin')
            AND auth.uid() <> timesheet_entries.user_id -- Prevent Founder/Admin self-approval
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = timesheet_entries.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = timesheet_entries.organization_id
            AND auth.uid() <> timesheet_entries.user_id -- Prevent TL self-approval
        )
    )
    WITH CHECK (
        -- Employees can only update their own unapproved timesheets and cannot change user_id or organization_id
        (
            user_id = auth.uid() 
            AND status IN ('draft', 'submitted')
            AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
        -- Founder/Admin can review/approve timesheets within their organization (excluding their own)
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = timesheet_entries.organization_id 
            AND users.role IN ('founder', 'admin')
            AND auth.uid() <> timesheet_entries.user_id
        )
        -- Team Leaders can review/approve timesheets for assigned members in their organization (excluding their own)
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = timesheet_entries.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = timesheet_entries.organization_id
            AND auth.uid() <> timesheet_entries.user_id
        )
    );

-- Policy: DELETE
CREATE POLICY "Timesheet delete policy" ON timesheet_entries
    FOR DELETE USING (
        (user_id = auth.uid() AND status IN ('draft', 'submitted'))
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = timesheet_entries.organization_id 
            AND users.role IN ('founder', 'admin')
        )
    );

-- 5. HARDEN LEAVE APPLICATIONS ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees view own leaves" ON leave_applications;
DROP POLICY IF EXISTS "Supervisors review leaves" ON leave_applications;

-- Policy: SELECT
CREATE POLICY "Employees view own leaves" ON leave_applications
    FOR SELECT USING (
        (user_id = auth.uid() AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = leave_applications.organization_id 
            AND users.role IN ('founder', 'admin')
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = leave_applications.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = leave_applications.organization_id
        )
    );

-- Policy: UPDATE (With strict WITH CHECK preventing self-approval and ownership tampering)
CREATE POLICY "Supervisors review leaves" ON leave_applications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = leave_applications.organization_id 
            AND users.role IN ('founder', 'admin')
            AND auth.uid() <> leave_applications.user_id -- Prevent Founder/Admin self-approval
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = leave_applications.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = leave_applications.organization_id
            AND auth.uid() <> leave_applications.user_id -- Prevent TL self-approval
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = leave_applications.organization_id 
            AND users.role IN ('founder', 'admin')
            AND auth.uid() <> leave_applications.user_id
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = leave_applications.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = leave_applications.organization_id
            AND auth.uid() <> leave_applications.user_id
        )
    );

-- 6. IMMUTABLE OWNERSHIP & TENANT ENFORCEMENT TRIGGERS
-- Guarantees that neither user_id nor organization_id can ever be modified on UPDATE,
-- regardless of user role, management privilege, or service-role execution.
CREATE OR REPLACE FUNCTION enforce_ownership_and_tenant_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Ownership immutability violation: user_id cannot be modified.';
    END IF;

    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'Tenant immutability violation: organization_id cannot be modified.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_timesheet_immutability ON timesheet_entries;
CREATE TRIGGER trg_enforce_timesheet_immutability
    BEFORE UPDATE ON timesheet_entries
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ownership_and_tenant_immutability();

DROP TRIGGER IF EXISTS trg_enforce_leave_immutability ON leave_applications;
CREATE TRIGGER trg_enforce_leave_immutability
    BEFORE UPDATE ON leave_applications
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ownership_and_tenant_immutability();
