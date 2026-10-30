-- ============================================================================
-- Employee Management System (EMS) — Migration 002
-- Add Announcements, Company Notes & Rules, Leave Applications, Timesheets,
-- and Profile Photo / Biometric Status columns.
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

-- 1. Extend USERS table with Profile Photo URL & Biometric Enrollment Status
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_enrollment_status VARCHAR(50) DEFAULT 'not_enrolled' CHECK (face_enrollment_status IN ('not_enrolled', 'in_progress', 'completed'));

-- 2. ANNOUNCEMENTS (Founder/Admin Managed)
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    audience VARCHAR(100) NOT NULL DEFAULT 'all', -- 'all', 'Engineering', 'Operations', etc.
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON announcements(published_at);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON announcements(audience);

-- 3. COMPANY NOTES & RULES (Founder/Admin Managed Policies)
CREATE TABLE IF NOT EXISTS company_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General' CHECK (category IN ('Attendance & Work', 'Leave Policy', 'Code of Conduct', 'Security & Devices', 'Benefits & Perks', 'General')),
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    version VARCHAR(20) DEFAULT '1.0',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_rules_category ON company_rules(category);
CREATE INDEX IF NOT EXISTS idx_company_rules_status ON company_rules(status);

-- 4. LEAVE APPLICATIONS (Employee Self-Service)
CREATE TABLE IF NOT EXISTS leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL CHECK (leave_type IN ('Paid Leave', 'Sick Leave', 'Casual Leave', 'Unpaid Leave', 'Comp Off')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days NUMERIC(4, 1) NOT NULL CHECK (duration_days > 0),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_remarks TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaves_user ON leave_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leave_applications(status);
CREATE INDEX IF NOT EXISTS idx_leaves_start_date ON leave_applications(start_date);

-- 5. TIMESHEET ENTRIES (Project Work Logs)
CREATE TABLE IF NOT EXISTS timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    project_name VARCHAR(150) NOT NULL,
    task_description TEXT NOT NULL,
    hours_spent NUMERIC(4, 2) NOT NULL CHECK (hours_spent > 0 AND hours_spent <= 24),
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_user ON timesheet_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet_entries(work_date);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Announcements: Anyone authenticated can read published announcements; founders and admins manage
DROP POLICY IF EXISTS "Anyone can read published announcements" ON announcements;
CREATE POLICY "Anyone can read published announcements" ON announcements
    FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Founders can manage announcements" ON announcements;
DROP POLICY IF EXISTS "Founders and admins can manage announcements" ON announcements;
CREATE POLICY "Founders and admins can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin')
        )
    );

-- Company Rules: Anyone authenticated can read published rules; founders and admins manage
DROP POLICY IF EXISTS "Anyone can read published rules" ON company_rules;
CREATE POLICY "Anyone can read published rules" ON company_rules
    FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Founders can manage rules" ON company_rules;
DROP POLICY IF EXISTS "Founders and admins can manage rules" ON company_rules;
CREATE POLICY "Founders and admins can manage rules" ON company_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin')
        )
    );

-- Leave Applications: Employees see their own leaves; supervisors (founders, admins, team leaders) can view and review
DROP POLICY IF EXISTS "Employees view own leaves" ON leave_applications;
CREATE POLICY "Employees view own leaves" ON leave_applications
    FOR SELECT USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin', 'team_leader')
        )
    );

DROP POLICY IF EXISTS "Employees create own leaves" ON leave_applications;
CREATE POLICY "Employees create own leaves" ON leave_applications
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Supervisors review leaves" ON leave_applications;
CREATE POLICY "Supervisors review leaves" ON leave_applications
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin', 'team_leader')
        )
    );

-- Timesheet: Employees view/create own entries; supervisors (founders, admins, team leaders) can view
DROP POLICY IF EXISTS "Employees manage own timesheets" ON timesheet_entries;
CREATE POLICY "Employees manage own timesheets" ON timesheet_entries
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Supervisors view timesheets" ON timesheet_entries;
CREATE POLICY "Supervisors view timesheets" ON timesheet_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('founder', 'admin', 'team_leader')
        )
    );
