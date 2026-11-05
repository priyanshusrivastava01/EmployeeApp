-- ============================================================================
-- MIGRATION 009: ATTENDANCE LIFECYCLE & WORKING HOURS POLICY
-- Adds organization-level Full Day / Half Day configurable thresholds
-- and attendance_status classification to attendance_records.
-- ============================================================================

-- 1. ADD CONFIGURABLE WORKING HOUR THRESHOLDS TO ORGANIZATIONS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS full_day_minutes INTEGER DEFAULT 480;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS half_day_minutes INTEGER DEFAULT 240;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS min_hours_action VARCHAR(50) DEFAULT 'Absent';

-- 2. ADD ATTENDANCE CLASSIFICATION STATUS TO ATTENDANCE RECORDS
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(50) DEFAULT 'In Progress';
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(attendance_status);

-- 3. RETROACTIVE BACKFILL FOR EXISTING ATTENDANCE RECORDS
UPDATE attendance_records
SET attendance_status = CASE
    WHEN punch_out_time IS NULL THEN 'In Progress'
    WHEN COALESCE(total_minutes, 0) >= 480 THEN 'Full Day'
    WHEN COALESCE(total_minutes, 0) >= 240 THEN 'Half Day'
    ELSE 'Absent'
END
WHERE attendance_status IS NULL OR attendance_status = 'In Progress';

