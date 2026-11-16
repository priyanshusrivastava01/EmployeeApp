-- ============================================================================
-- Employee Management System (EMS) — Consolidated Staging Database Setup
-- Project Target: EmployeeApp-Staging (Supabase PostgreSQL)
-- Consolidation of schema.sql and Migrations 002 through 013
-- Clean, Idempotent, Production-Hardened DDL
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CORE MULTI-TENANT TABLES (Level 1: Independent / Root Entity)
-- ============================================================================

-- ORGANIZATIONS (Tenant Definition)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    company_code VARCHAR(50),
    public_company_id VARCHAR(50) UNIQUE,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    phone VARCHAR(50),
    address TEXT,
    office_lat NUMERIC(10, 7),
    office_lng NUMERIC(10, 7),
    office_radius_meters INT DEFAULT 150,
    work_start_time TIME DEFAULT '09:30',
    work_end_time TIME DEFAULT '18:30',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    full_day_minutes INTEGER NOT NULL DEFAULT 510,
    half_day_minutes INTEGER NOT NULL DEFAULT 270,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_company_code_upper 
    ON organizations (UPPER(company_code)) WHERE company_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_public_company_id 
    ON organizations (public_company_id);

-- ============================================================================
-- 3. BRANCHES & PHYSICAL OFFICES (Level 2: Child of Organization)
-- ============================================================================

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_org_name_lower 
    ON branches(organization_id, LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(organization_id, is_active);

-- ============================================================================
-- 4. USERS & ROLES (Level 3: Core Personnel)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('founder', 'admin', 'team_leader', 'employee')),
    department VARCHAR(100),
    designation VARCHAR(100),
    phone VARCHAR(50),
    employee_id_number VARCHAR(50),
    monthly_salary NUMERIC DEFAULT 0,
    profile_photo_url TEXT,
    face_enrollment_status VARCHAR(50) DEFAULT 'not_enrolled' CHECK (face_enrollment_status IN ('not_enrolled', 'in_progress', 'completed')),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    work_mode VARCHAR(20) DEFAULT 'WFO' CHECK (work_mode IN ('WFO', 'WFH')),
    team_leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    annual_leave_quota NUMERIC(4, 1) DEFAULT 18.0,
    casual_leave_quota NUMERIC(4, 1) DEFAULT 12.0,
    sick_leave_quota NUMERIC(4, 1) DEFAULT 12.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_team_leader ON users(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_work_mode ON users(work_mode);
CREATE INDEX IF NOT EXISTS idx_users_org_employee_id ON users(organization_id, employee_id_number);

-- ============================================================================
-- 5. ORGANIZATION MEMBERSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('founder', 'admin', 'team_leader', 'employee')),
    is_default BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_org_membership UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id);

-- ============================================================================
-- 6. GEOFENCES (Office Boundary Configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_org ON geofences(organization_id);

-- ============================================================================
-- 7. ATTENDANCE RECORDS (Core Punch-In / Punch-Out)
-- ============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('WFO', 'WFH')),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    branch_name VARCHAR(255),
    
    -- Punch In
    punch_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    punch_in_lat NUMERIC(10, 7) NOT NULL,
    punch_in_lng NUMERIC(10, 7) NOT NULL,
    punch_in_accuracy NUMERIC(8, 2),
    punch_in_photo_path TEXT,
    punch_in_verified BOOLEAN NOT NULL DEFAULT false,
    punch_in_distance_meters NUMERIC(10, 2),
    
    -- Punch Out
    punch_out_time TIMESTAMPTZ,
    punch_out_lat NUMERIC(10, 7),
    punch_out_lng NUMERIC(10, 7),
    punch_out_accuracy NUMERIC(8, 2),
    punch_out_photo_path TEXT,
    punch_out_verified BOOLEAN,
    punch_out_distance_meters NUMERIC(10, 2),
    
    -- Classification
    total_minutes INTEGER,
    attendance_status VARCHAR(20) DEFAULT 'present' CHECK (attendance_status IN ('present', 'half_day', 'absent', 'on_leave', 'holiday', 'pending')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_work_date UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_org ON attendance_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_work_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_mode ON attendance_records(mode);
CREATE INDEX IF NOT EXISTS idx_attendance_branch_id ON attendance_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org_punch_in ON attendance_records(organization_id, punch_in_time DESC);

-- ============================================================================
-- 8. WFH SESSION PINGS (Location Breadcrumbs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wfh_session_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    attendance_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy NUMERIC(8, 2),
    battery_percentage NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pings_org ON wfh_session_pings(organization_id);
CREATE INDEX IF NOT EXISTS idx_pings_attendance ON wfh_session_pings(attendance_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_pings_user ON wfh_session_pings(user_id);

-- ============================================================================
-- 9. TASKS (Management Assigned Tasks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================================
-- 10. DAILY REPORTS (EOD Task Submissions & Evaluations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
    project_name VARCHAR(150),
    tasks_assigned TEXT,
    tasks_completed VARCHAR(10) DEFAULT 'No',
    tasks_pending VARCHAR(10) DEFAULT 'No',
    tasks JSONB DEFAULT '[]'::jsonb,
    carried_forward_count INTEGER DEFAULT 0,
    is_draft BOOLEAN DEFAULT false,
    work_summary TEXT,
    challenges TEXT,
    rating_speed NUMERIC(3, 1),
    rating_understanding NUMERIC(3, 1),
    rating_problem_solving NUMERIC(3, 1),
    rating_talking_behaviour NUMERIC(3, 1),
    rating_work_quality NUMERIC(3, 1),
    rating_discipline NUMERIC(3, 1),
    rating_average_overall NUMERIC(3, 1),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_report_user_date UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_reports_org ON daily_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date_desc ON daily_reports (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_org_date_desc ON daily_reports (organization_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_draft ON daily_reports (organization_id, is_draft);

-- ============================================================================
-- 11. TEAM LEADER AUDITS & REVIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_leader_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auditor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    auditor_name VARCHAR(255),
    auditor_role VARCHAR(50),
    employee_name VARCHAR(255),
    attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
    audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100),
    score NUMERIC(3, 1),
    rating_score SMALLINT CHECK (rating_score BETWEEN 1 AND 5),
    punctuality_rating SMALLINT CHECK (punctuality_rating BETWEEN 1 AND 5),
    task_delivery_rating SMALLINT CHECK (task_delivery_rating BETWEEN 1 AND 5),
    strengths TEXT,
    improvements TEXT,
    action_items TEXT,
    remarks TEXT,
    tl_audit_score NUMERIC(3, 1) CHECK (tl_audit_score BETWEEN 1 AND 10),
    tl_audit_remarks TEXT,
    tl_auditor_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audits_org ON team_leader_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_audits_employee_date ON team_leader_audits(employee_id, audit_date);
CREATE INDEX IF NOT EXISTS idx_audits_reviewer ON team_leader_audits(reviewer_id);

-- ============================================================================
-- 12. ANNOUNCEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (LOWER(priority) IN ('low', 'medium', 'high', 'normal', 'urgent')),
    audience VARCHAR(100) NOT NULL DEFAULT 'all',
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_org ON announcements(organization_id);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_org_created ON announcements(organization_id, created_at DESC);

-- ============================================================================
-- 13. COMPANY RULES & POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS company_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General' CHECK (category IN (
        'General', 'Attendance', 'Geofence', 'Remote Work', 'Ethics',
        'Attendance & Work', 'Leave Policy', 'Code of Conduct', 'Security & Devices', 'Benefits & Perks'
    )),
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    version VARCHAR(20) DEFAULT '1.0',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_rules_org ON company_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_rules_category ON company_rules(category);
CREATE INDEX IF NOT EXISTS idx_rules_org_created ON company_rules(organization_id, created_at DESC);

-- ============================================================================
-- 14. LEAVE APPLICATIONS (Employee Self-Service)
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL CHECK (LOWER(leave_type) IN (
        'paid leave', 'sick leave', 'casual leave', 'unpaid leave', 'comp off',
        'paid', 'sick', 'casual', 'unpaid'
    )),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days NUMERIC(4, 1) NOT NULL CHECK (duration_days > 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_remarks TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leaves_org ON leave_applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_leaves_user ON leave_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_org_status ON leave_applications(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leaves_org_user ON leave_applications(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_start_date ON leave_applications(start_date);

-- ============================================================================
-- 15. TIMESHEET ENTRIES (Project Work Logs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    project_name VARCHAR(150) NOT NULL,
    task_description TEXT NOT NULL,
    hours_spent NUMERIC(4, 2) NOT NULL CHECK (hours_spent > 0 AND hours_spent <= 24),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_remarks TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_org ON timesheet_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_org_user ON timesheet_entries(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_org_date ON timesheet_entries(organization_id, work_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_org_status ON timesheet_entries(organization_id, status);

-- ============================================================================
-- 16. HOLIDAYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    holiday_date DATE NOT NULL,
    is_optional BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_holiday_org_date UNIQUE (organization_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_org ON holidays(organization_id);

-- ============================================================================
-- 17. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

-- ============================================================================
-- 18. AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);

-- ============================================================================
-- 19. ADVANCE PAYMENT REQUESTS (Legacy General Request Table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS advance_payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    repayment_terms TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advance_payment_org_user ON advance_payment_requests(organization_id, user_id);

-- ============================================================================
-- 20. INVITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    employee_id_number VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('founder', 'admin', 'team_leader', 'employee')),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_preview VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- ============================================================================
-- 21. PASSWORD RESETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

-- ============================================================================
-- 22. BANK DETAILS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_holder_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    account_number_masked VARCHAR(50) NOT NULL,
    account_number_hash VARCHAR(255) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    account_type VARCHAR(50) DEFAULT 'Savings',
    status VARCHAR(50) DEFAULT 'Pending Review',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_bank UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_details_org_user ON bank_details (organization_id, user_id);

-- ============================================================================
-- 23. PROFILE UPDATE REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_update_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    new_value TEXT NOT NULL,
    current_value TEXT,
    status VARCHAR(50) DEFAULT 'Pending Review',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_updates_org_user ON profile_update_requests (organization_id, user_id);

-- ============================================================================
-- 24. SALARY ADVANCE REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS salary_advance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    requested_amount NUMERIC NOT NULL,
    repayment_months INT NOT NULL DEFAULT 1,
    tenure VARCHAR(50),
    reason_category VARCHAR(100) NOT NULL,
    reason_description TEXT,
    status VARCHAR(50) DEFAULT 'Pending Approval',
    approved_amount NUMERIC,
    approval_remarks TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    amount_paid NUMERIC DEFAULT 0,
    amount_repaid NUMERIC DEFAULT 0,
    repayments JSONB DEFAULT '[]'::jsonb,
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(100),
    payment_proof_url TEXT,
    payment_remarks TEXT,
    payment_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_recorded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advances_org_user ON salary_advance_requests (organization_id, user_id);

-- ============================================================================
-- 25. IMMUTABLE OWNERSHIP & TENANT ENFORCEMENT FUNCTION & TRIGGERS
-- ============================================================================

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

-- ============================================================================
-- 26. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_session_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_leader_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advance_requests ENABLE ROW LEVEL SECURITY;

-- Branches Policy
DROP POLICY IF EXISTS "Branches organization isolation" ON branches;
CREATE POLICY "Branches organization isolation" ON branches
    FOR ALL
    USING (
        organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    )
    WITH CHECK (
        organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    );

-- Bank Details Policies
DROP POLICY IF EXISTS bank_details_employee_policy ON bank_details;
CREATE POLICY bank_details_employee_policy ON bank_details
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_details_admin_policy ON bank_details;
CREATE POLICY bank_details_admin_policy ON bank_details
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.organization_id = bank_details.organization_id 
              AND users.role IN ('founder', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.organization_id = bank_details.organization_id 
              AND users.role IN ('founder', 'admin')
        )
    );

-- Profile Update Requests Policies
DROP POLICY IF EXISTS profile_updates_employee_policy ON profile_update_requests;
CREATE POLICY profile_updates_employee_policy ON profile_update_requests
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_updates_admin_policy ON profile_update_requests;
CREATE POLICY profile_updates_admin_policy ON profile_update_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.organization_id = profile_update_requests.organization_id 
              AND users.role IN ('founder', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.organization_id = profile_update_requests.organization_id 
              AND users.role IN ('founder', 'admin')
        )
    );

-- Salary Advance Requests Policies
DROP POLICY IF EXISTS salary_advances_employee_policy ON salary_advance_requests;
CREATE POLICY salary_advances_employee_policy ON salary_advance_requests
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS salary_advances_admin_policy ON salary_advance_requests;
CREATE POLICY salary_advances_admin_policy ON salary_advance_requests
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.organization_id = salary_advance_requests.organization_id 
              AND users.role IN ('founder', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
              AND users.organization_id = salary_advance_requests.organization_id 
              AND users.role IN ('founder', 'admin')
        )
    );

-- Announcements Policies
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

DROP POLICY IF EXISTS "Founders and admins can manage announcements" ON announcements;
CREATE POLICY "Founders and admins can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin')
        )
    );

-- Company Rules Policies
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

DROP POLICY IF EXISTS "Founders and admins can manage rules" ON company_rules;
CREATE POLICY "Founders and admins can manage rules" ON company_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin')
        )
    );

-- Leave Applications Policies
DROP POLICY IF EXISTS "Employees view own leaves" ON leave_applications;
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

DROP POLICY IF EXISTS "Employees create own leaves" ON leave_applications;
CREATE POLICY "Employees create own leaves" ON leave_applications
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND status = 'pending'
        AND organization_id = (
            SELECT u.organization_id 
            FROM users u 
            WHERE u.id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Supervisors review leaves" ON leave_applications;
CREATE POLICY "Supervisors review leaves" ON leave_applications
    FOR UPDATE USING (
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

-- Timesheet Entries Policies
DROP POLICY IF EXISTS "Employees view own timesheets" ON timesheet_entries;
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

DROP POLICY IF EXISTS "Employees insert own timesheets" ON timesheet_entries;
CREATE POLICY "Employees insert own timesheets" ON timesheet_entries
    FOR INSERT WITH CHECK (
        user_id = auth.uid() 
        AND status IN ('draft', 'submitted')
        AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Timesheet update policy" ON timesheet_entries;
CREATE POLICY "Timesheet update policy" ON timesheet_entries
    FOR UPDATE USING (
        (user_id = auth.uid() AND status IN ('draft', 'submitted'))
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = timesheet_entries.organization_id 
            AND users.role IN ('founder', 'admin')
            AND auth.uid() <> timesheet_entries.user_id
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = timesheet_entries.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = timesheet_entries.organization_id
            AND auth.uid() <> timesheet_entries.user_id
        )
    )
    WITH CHECK (
        (
            user_id = auth.uid() 
            AND status IN ('draft', 'submitted')
            AND organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.organization_id = timesheet_entries.organization_id 
            AND users.role IN ('founder', 'admin')
            AND auth.uid() <> timesheet_entries.user_id
        )
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = timesheet_entries.user_id
            AND u.team_leader_id = auth.uid()
            AND u.organization_id = timesheet_entries.organization_id
            AND auth.uid() <> timesheet_entries.user_id
        )
    );

DROP POLICY IF EXISTS "Timesheet delete policy" ON timesheet_entries;
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
