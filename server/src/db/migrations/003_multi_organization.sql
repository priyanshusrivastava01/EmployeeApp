-- ============================================================================
-- EMS Multi-Organization Platform — Migration 003
-- Adds: organizations, organization_memberships, organization_id columns
--       on all tenant-scoped tables, daily_task_summary, holidays,
--       notifications, audit_logs tables.
-- Safe: All ALTER TABLE use ADD COLUMN IF NOT EXISTS
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATIONS
-- One row per independent company/organization using the platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,          -- URL-safe short identifier
    logo_url TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    address TEXT,
    timezone VARCHAR(80) DEFAULT 'Asia/Kolkata',
    working_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    work_start_time TIME DEFAULT '09:30',
    work_end_time TIME DEFAULT '18:30',
    late_threshold_minutes INTEGER DEFAULT 15,
    office_lat NUMERIC(10, 7),
    office_lng NUMERIC(10, 7),
    office_radius_meters INTEGER DEFAULT 100,
    wfh_allowed BOOLEAN DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_active ON organizations(is_active);

-- ============================================================================
-- 2. ORGANIZATION MEMBERSHIPS
-- Maps users to organizations with a role within that org.
-- A single auth user can theoretically belong to multiple orgs (separate rows)
-- but typically one org per user.
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'team_leader', 'employee')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON organization_memberships(role);

-- ============================================================================
-- 3. ADD organization_id TO USERS TABLE (profile-level org association)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- ============================================================================
-- 4. ADD organization_id TO ALL TENANT-SCOPED TABLES
-- These are additive, safe migrations
-- ============================================================================

-- attendance_records
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_attendance_org ON attendance_records(organization_id);

-- wfh_session_pings
ALTER TABLE wfh_session_pings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pings_org ON wfh_session_pings(organization_id);

-- geofences
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_geofences_org ON geofences(organization_id);

-- tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);

-- daily_reports
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
-- Add rich fields for daily report that match the spreadsheet format
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS project_name VARCHAR(150);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS tasks_assigned TEXT;
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS tasks_completed VARCHAR(10) DEFAULT 'No';
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS tasks_pending VARCHAR(10) DEFAULT 'No';
-- Self-rating fields (1-10)
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_speed NUMERIC(3,1);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_understanding NUMERIC(3,1);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_problem_solving NUMERIC(3,1);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_talking_behaviour NUMERIC(3,1);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_work_quality NUMERIC(3,1);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_discipline NUMERIC(3,1);
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS rating_average_overall NUMERIC(3,1);
CREATE INDEX IF NOT EXISTS idx_reports_org ON daily_reports(organization_id);

-- team_leader_audits
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
-- Expand audit rating to 1-10 scale (existing is 1-5, add separate columns)
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS tl_audit_score NUMERIC(3,1) CHECK (tl_audit_score BETWEEN 1 AND 10);
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS tl_audit_remarks TEXT;
ALTER TABLE team_leader_audits ADD COLUMN IF NOT EXISTS tl_auditor_name VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_audits_org ON team_leader_audits(organization_id);

-- announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_announcements_org ON announcements(organization_id);

-- company_rules
ALTER TABLE company_rules ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_rules_org ON company_rules(organization_id);

-- leave_applications
ALTER TABLE leave_applications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_leaves_org ON leave_applications(organization_id);

-- timesheet_entries
ALTER TABLE timesheet_entries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_timesheet_org ON timesheet_entries(organization_id);

-- ============================================================================
-- 5. HOLIDAYS (Organization-specific holiday calendar)
-- ============================================================================
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    holiday_date DATE NOT NULL,
    type VARCHAR(50) DEFAULT 'national' CHECK (type IN ('national', 'regional', 'company', 'restricted')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, holiday_date, name)
);

CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);

-- ============================================================================
-- 6. NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'leave', 'attendance', 'task', 'audit', 'announcement', 'system')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    reference_id UUID,  -- optional link to leave_id, attendance_id etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

-- ============================================================================
-- 7. AUDIT LOGS (Administrative action trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(80),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);

-- ============================================================================
-- 8. ADVANCE PAYMENT REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS advance_payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_requested NUMERIC(10, 2) NOT NULL CHECK (amount_requested > 0),
    reason TEXT NOT NULL,
    repayment_period VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_remarks TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advance_user ON advance_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_advance_org ON advance_payment_requests(organization_id);

-- ============================================================================
-- 9. ENABLE ROW LEVEL SECURITY on new tables
-- NOTE: RLS is enforced at the application (Express) layer because the backend
-- uses the service-role key. These RLS policies provide defense-in-depth for
-- any direct Supabase client connections (mobile anon key usage is NOT allowed).
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payment_requests ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses all RLS (used by Express backend only).
-- No public RLS policies needed since all access routes through Express.
-- Deny all direct access as default:
-- (PostgreSQL denies all by default when RLS is enabled and no permissive policy exists)
