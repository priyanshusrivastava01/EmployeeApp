-- ============================================================================
-- EMS Multi-Organization Platform — Migration 013
-- Multi-Branch Office Management & Branch-Specific Geofencing System
-- Safe, Non-destructive, Idempotent
-- Engine: PostgreSQL (Supabase)
-- ============================================================================

-- 1. BRANCHES / LOCATIONS TABLE VERIFICATION & HARDENING
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Head Office',
    address TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    radius_meters INTEGER DEFAULT 150,
    is_headquarters BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique branch name per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_name_lower 
    ON branches(organization_id, LOWER(TRIM(name)));

CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(organization_id, is_active);

-- 2. EXTEND USERS TABLE FOR BRANCH ASSIGNMENT & WORK MODE
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20) DEFAULT 'WFO';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public'
          AND table_name = 'users' 
          AND constraint_name = 'users_work_mode_check'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_work_mode_check CHECK (work_mode IN ('WFO', 'WFH'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_work_mode ON users(work_mode);

-- 3. EXTEND ATTENDANCE RECORDS FOR HISTORICAL BRANCH PRESERVATION
-- Historical attendance rows intentionally retain NULL for branch_id and branch_name
-- to preserve authentic historical logs without inventing retrospective branch associations.
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_attendance_branch_id ON attendance_records(branch_id);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR BRANCHES
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Branches organization isolation" ON branches;
CREATE POLICY "Branches organization isolation" ON branches
    FOR ALL
    USING (
        organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    );

-- 5. POPULATE DEFAULT HEADQUARTERS BRANCH FROM EXISTING ORGS (IF NONE EXISTS)
INSERT INTO branches (organization_id, name, address, latitude, longitude, radius_meters, is_headquarters, is_active)
SELECT 
    o.id AS organization_id,
    COALESCE(o.name || ' Head Office', 'Head Office') AS name,
    o.address,
    o.office_lat AS latitude,
    o.office_lng AS longitude,
    COALESCE(o.office_radius_meters, 150) AS radius_meters,
    true AS is_headquarters,
    true AS is_active
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM branches b WHERE b.organization_id = o.id
)
AND o.office_lat IS NOT NULL 
AND o.office_lng IS NOT NULL;

-- 6. BACKFILL EXISTING WFO USERS TO THEIR ORGANIZATION'S ACTIVE HEADQUARTERS BRANCH
-- Strictly associates existing unassigned WFO employees with their active Headquarters branch.
-- Requires is_headquarters = true; if no active HQ exists, branch_id remains NULL.
-- Preserves existing valid assignments, skips WFH employees, and ignores inactive branches.
UPDATE users u
SET branch_id = (
    SELECT b.id
    FROM branches b
    WHERE b.organization_id = u.organization_id
      AND b.is_active = true
      AND b.is_headquarters = true
    ORDER BY b.created_at ASC
    LIMIT 1
)
WHERE u.branch_id IS NULL
  AND (u.work_mode = 'WFO' OR u.work_mode IS NULL);


