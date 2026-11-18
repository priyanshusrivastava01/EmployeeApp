-- Migration 014: Organizations Profile & Attendance Policy Fields
-- Adds missing organization profile, contact, and policy columns to organizations table.
-- Ensures parity between production, staging, and future deployments.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS working_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER DEFAULT 15;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wfh_allowed BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_size_range VARCHAR(50);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS min_hours_action VARCHAR(50) DEFAULT 'half_day';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
