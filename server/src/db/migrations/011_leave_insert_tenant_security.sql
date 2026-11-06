-- ============================================================================
-- Migration 011: Leave Application INSERT Tenant & Workflow Security Hardening
-- Purpose:
--   1. Replace the legacy permissive 'Employees create own leaves' policy on leave_applications
--   2. Enforce strict tenant isolation: organization_id must match the authenticated user's organization_id
--   3. Enforce user ownership: user_id must match auth.uid()
--   4. Preserve valid employee self-service workflow while preventing unauthorized privilege escalation:
--      initial leave submission status must be 'pending'
-- ============================================================================

-- Ensure Row Level Security is active on leave_applications
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;

-- Drop legacy permissive INSERT policy that lacked tenant organization validation
DROP POLICY IF EXISTS "Employees create own leaves" ON leave_applications;

-- Create hardened INSERT policy enforcing ownership, tenant boundaries, and initial pending status
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

