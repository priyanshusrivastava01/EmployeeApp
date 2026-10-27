-- ============================================================================
-- EMS Multi-Organization Platform — Migration 006
-- Adds: company_code on organizations, branches table for multi-location support
-- Safe: All ALTER TABLE use ADD COLUMN IF NOT EXISTS
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

-- 1. USER-CHOSEN COMPANY CODE ON ORGANIZATIONS
-- public_company_id is the system-generated CMP-XXXXXXXX identifier.
-- company_code is the user-chosen short identifier (e.g. VAR007) for easy sharing.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_code VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_company_code ON organizations(UPPER(company_code)) WHERE company_code IS NOT NULL;

-- 2. BRANCHES / LOCATIONS TABLE
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

CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(organization_id, is_active);

-- 3. ROW LEVEL SECURITY
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
