-- ============================================================================
-- EMS Multi-Organization Platform — Migration 004
-- Adds: public_company_id on organizations, employee_id_number on users,
--       invitations table, password_resets table.
-- Safe: All ALTER TABLE use ADD COLUMN IF NOT EXISTS
-- Database Engine: PostgreSQL (Supabase)
-- ============================================================================

-- 1. PUBLIC COMPANY ID ON ORGANIZATIONS
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS public_company_id VARCHAR(30) UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_size_range VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_orgs_public_company_id ON organizations(public_company_id);

-- 2. PUBLIC EMPLOYEE IDENTIFIERS ON USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id_number VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_employee_id ON users(organization_id, employee_id_number) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_employee_id_number ON users(employee_id_number);

-- 3. EMPLOYEE & STAFF INVITATIONS
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

-- 4. PASSWORD RESETS
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

-- 5. ROW LEVEL SECURITY
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
