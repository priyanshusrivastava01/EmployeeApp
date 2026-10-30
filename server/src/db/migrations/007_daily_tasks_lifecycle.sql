-- Migration 007: Daily Task Lifecycle & History Management
-- Adds JSONB task items, carry-forward tracking, and submission timestamps

DO $$ 
BEGIN 
  -- 1. Add tasks JSONB column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_reports' AND column_name = 'tasks'
  ) THEN
    ALTER TABLE daily_reports ADD COLUMN tasks JSONB DEFAULT '[]'::jsonb;
  END IF;

  -- 2. Add carried_forward_count column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_reports' AND column_name = 'carried_forward_count'
  ) THEN
    ALTER TABLE daily_reports ADD COLUMN carried_forward_count INT DEFAULT 0;
  END IF;

  -- 3. Add submitted_at column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_reports' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE daily_reports ADD COLUMN submitted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Indexes for performance on date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON daily_reports (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_org_date ON daily_reports (organization_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_reports_draft ON daily_reports (organization_id, is_draft);

COMMENT ON COLUMN daily_reports.tasks IS 'Detailed JSON array of task items with id, projectName, tasksAssigned, completed, pending, isCarriedForward, carriedForwardFromDate';
COMMENT ON COLUMN daily_reports.carried_forward_count IS 'Count of tasks carried forward from previous pending days';

