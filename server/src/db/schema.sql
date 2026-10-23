-- ============================================================================
-- Employee Management System (EMS) — Initial Database Schema
-- Version: 1.0 (Stage 1B)
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

-- Ensure pgcrypto extension is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS & ROLES
-- Stores company personnel (Founders, Team Leaders, and Employees)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('founder', 'team_leader', 'employee')),
    department VARCHAR(100),
    designation VARCHAR(100),
    phone VARCHAR(20),
    team_leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_team_leader ON users(team_leader_id);

-- ============================================================================
-- 2. GEOFENCES (Office Boundary Configuration)
-- Stores designated office locations for attendance geofence verification
-- ============================================================================
CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. ATTENDANCE RECORDS
-- Core daily attendance lifecycle (Punch In, Punch Out, WFO vs WFH)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('WFO', 'WFH')),
    
    -- Punch In details
    punch_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    punch_in_lat NUMERIC(10, 7) NOT NULL,
    punch_in_lng NUMERIC(10, 7) NOT NULL,
    punch_in_accuracy NUMERIC(8, 2), -- GPS accuracy radius in meters
    punch_in_photo_path TEXT NOT NULL, -- Private path in Supabase Storage
    punch_in_verified BOOLEAN NOT NULL DEFAULT false, -- True if within geofence or approved
    punch_in_distance_meters NUMERIC(10, 2), -- Server-calculated distance to office
    
    -- Punch Out details
    punch_out_time TIMESTAMPTZ,
    punch_out_lat NUMERIC(10, 7),
    punch_out_lng NUMERIC(10, 7),
    punch_out_accuracy NUMERIC(8, 2),
    punch_out_photo_path TEXT,
    punch_out_verified BOOLEAN,
    punch_out_distance_meters NUMERIC(10, 2),
    
    -- Duration metrics
    total_minutes INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate attendance records for the same employee on the same date
    CONSTRAINT uq_user_work_date UNIQUE (user_id, work_date)
);

-- Indexes for attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_work_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_mode ON attendance_records(mode);

-- ============================================================================
-- 4. WFH SESSION PINGS (Location Audit Trail)
-- Periodic breadcrumb locations recorded during active WFH shifts
-- ============================================================================
CREATE TABLE IF NOT EXISTS wfh_session_pings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy NUMERIC(8, 2),
    battery_percentage NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for location timeline
CREATE INDEX IF NOT EXISTS idx_pings_attendance ON wfh_session_pings(attendance_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_pings_user ON wfh_session_pings(user_id);

-- ============================================================================
-- 5. TASKS
-- Daily tasks assigned by Team Leaders / Founders to Employees
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes for task lookup
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================================
-- 6. DAILY REPORTS (End-of-Day EOD Submission)
-- Summary of work completed by employees before punching out
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
    work_summary TEXT NOT NULL,
    challenges TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- An employee submits one summary per work date
    CONSTRAINT uq_daily_report_user_date UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_reports_user_date ON daily_reports(user_id, work_date);

-- ============================================================================
-- 7. TEAM LEADER AUDITS & PERFORMANCE RATINGS
-- Structured reviews of daily performance and attendance submitted by TL/Founder
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_leader_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
    audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rating_score SMALLINT NOT NULL CHECK (rating_score BETWEEN 1 AND 5),
    punctuality_rating SMALLINT CHECK (punctuality_rating BETWEEN 1 AND 5),
    task_delivery_rating SMALLINT CHECK (task_delivery_rating BETWEEN 1 AND 5),
    remarks TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audits_employee_date ON team_leader_audits(employee_id, audit_date);
CREATE INDEX IF NOT EXISTS idx_audits_reviewer ON team_leader_audits(reviewer_id);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures data isolation at the PostgreSQL layer
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_session_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_leader_audits ENABLE ROW LEVEL SECURITY;

-- Note on backend access:
-- The Express backend connects using the SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS
-- to enforce fine-grained business logic on the server.
-- Direct client access using the public ANON key is strictly restricted by default:
-- No public anonymous access is granted directly without going through our API.
