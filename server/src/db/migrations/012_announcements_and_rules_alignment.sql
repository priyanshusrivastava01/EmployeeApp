-- ============================================================================
-- Employee Management System (EMS) — Migration 012
-- Align Announcements priority and Company Rules category constraints with UI
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

DO $$
BEGIN
    -- 1. ANNOUNCEMENTS: Relax priority CHECK constraint to support Low, Medium, High, Urgent
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'announcements' AND constraint_name = 'announcements_priority_check'
    ) THEN
        ALTER TABLE announcements DROP CONSTRAINT announcements_priority_check;
    END IF;

    -- Add updated check constraint allowing UI priorities (case-insensitive)
    ALTER TABLE announcements
        ADD CONSTRAINT announcements_priority_check
        CHECK (LOWER(priority) IN ('low', 'medium', 'high', 'normal', 'urgent'));

    -- Ensure default is 'medium'
    ALTER TABLE announcements ALTER COLUMN priority SET DEFAULT 'medium';

    -- 2. COMPANY RULES: Relax category CHECK constraint to support EMS policy categories
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'company_rules' AND constraint_name = 'company_rules_category_check'
    ) THEN
        ALTER TABLE company_rules DROP CONSTRAINT company_rules_category_check;
    END IF;

    -- Add updated check constraint supporting General, Attendance, Geofence, Remote Work, Ethics
    -- as well as legacy categories for backward compatibility
    ALTER TABLE company_rules
        ADD CONSTRAINT company_rules_category_check
        CHECK (category IN (
            'General', 'Attendance', 'Geofence', 'Remote Work', 'Ethics',
            'Attendance & Work', 'Leave Policy', 'Code of Conduct', 'Security & Devices', 'Benefits & Perks'
        ));

    -- Ensure default is 'General'
    ALTER TABLE company_rules ALTER COLUMN category SET DEFAULT 'General';

    -- 3. INDEXES: High-efficiency organization-scoped and date sorting
    CREATE INDEX IF NOT EXISTS idx_announcements_org_created
        ON announcements(organization_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_rules_org_created
        ON company_rules(organization_id, created_at DESC);

    -- 4. RLS POLICIES VERIFICATION
    ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE company_rules ENABLE ROW LEVEL SECURITY;

END $$;

