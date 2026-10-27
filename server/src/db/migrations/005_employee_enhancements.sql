-- Migration 005: Employee Enhancements
-- Bank Details, Profile Update Requests, Task Report Drafts, Salary Advances & Audit Trails

-- 1. Bank Details
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
  status VARCHAR(50) DEFAULT 'Pending Review', -- 'Pending Review', 'Verified', 'Rejected', 'Update Requested'
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_bank UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_details_org_user ON bank_details (organization_id, user_id);

-- 2. Profile Update Requests (For Employee self-service updates requiring review)
CREATE TABLE IF NOT EXISTS profile_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL, -- 'phone', 'address', etc.
  new_value TEXT NOT NULL,
  current_value TEXT,
  status VARCHAR(50) DEFAULT 'Pending Review', -- 'Pending Review', 'Approved', 'Rejected'
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_updates_org_user ON profile_update_requests (organization_id, user_id);

-- 3. Update daily_reports for Draft support
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_reports' AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE daily_reports ADD COLUMN is_draft BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Salary Advance Requests
CREATE TABLE IF NOT EXISTS salary_advance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  requested_amount NUMERIC NOT NULL,
  repayment_months INT NOT NULL DEFAULT 1,
  reason_category VARCHAR(100) NOT NULL,
  reason_description TEXT,
  status VARCHAR(50) DEFAULT 'Pending Approval', -- 'Pending Approval', 'Approved', 'Rejected', 'Payment Pending', 'Partially Paid', 'Paid', 'Settled'
  approved_amount NUMERIC,
  approval_remarks TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  amount_paid NUMERIC DEFAULT 0,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(100),
  payment_proof_url TEXT,
  payment_remarks TEXT,
  payment_recorded_by UUID REFERENCES users(id),
  payment_recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advances_org_user ON salary_advance_requests (organization_id, user_id);

-- 5. Row Level Security Policies
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advance_requests ENABLE ROW LEVEL SECURITY;

-- Bank Details RLS: Employee accesses own; Admin/Founder accesses org
DROP POLICY IF EXISTS bank_details_employee_policy ON bank_details;
CREATE POLICY bank_details_employee_policy ON bank_details
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bank_details_admin_policy ON bank_details;
CREATE POLICY bank_details_admin_policy ON bank_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND organization_id = bank_details.organization_id AND role IN ('Founder', 'Admin')
    )
  );

-- Profile Update Requests RLS
DROP POLICY IF EXISTS profile_updates_employee_policy ON profile_update_requests;
CREATE POLICY profile_updates_employee_policy ON profile_update_requests
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS profile_updates_admin_policy ON profile_update_requests;
CREATE POLICY profile_updates_admin_policy ON profile_update_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND organization_id = profile_update_requests.organization_id AND role IN ('Founder', 'Admin')
    )
  );

-- Salary Advances RLS
DROP POLICY IF EXISTS salary_advances_employee_policy ON salary_advance_requests;
CREATE POLICY salary_advances_employee_policy ON salary_advance_requests
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS salary_advances_admin_policy ON salary_advance_requests;
CREATE POLICY salary_advances_admin_policy ON salary_advance_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND organization_id = salary_advance_requests.organization_id AND role IN ('Founder', 'Admin')
    )
  );
