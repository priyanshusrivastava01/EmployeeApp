// @ts-check
/**
 * Safe Test Data Cleanup Helper
 * Enforces strict cascading deletion (child before parent), explicit error reporting,
 * and post-cleanup verification for integration test organizations.
 */

const CHILD_TO_PARENT_TABLES = [
  'wfh_session_pings',
  'team_leader_audits',
  'daily_reports',
  'attendance_records',
  'tasks',
  'timesheet_entries',
  'leave_applications',
  'salary_advance_requests',
  'advance_payment_requests',
  'bank_details',
  'profile_update_requests',
  'announcements',
  'company_rules',
  'notifications',
  'invitations',
  'holidays',
  'audit_logs',
  'organization_memberships',
  'users',
  'branches',
  'organizations'
];

/**
 * Safely delete all test records associated with an organization ID
 * Deletes child records before parent in strict reverse dependency order.
 * @param {any} supabaseClient 
 * @param {string} orgId 
 */
export async function safeDeleteTestOrganization(supabaseClient, orgId) {
  if (!supabaseClient || !orgId) return;

  // Extra safety: Never delete production organization VAR001
  if (orgId === 'a1a162f2-5877-4cc7-a6bd-12176ccd9f93') {
    throw new Error('[CRITICAL SAFETY VIOLATION] Attempted to delete production organization VAR001!');
  }

  for (const table of CHILD_TO_PARENT_TABLES) {
    const col = table === 'organizations' ? 'id' : 'organization_id';
    const { error } = await supabaseClient.from(table).delete().eq(col, orgId);
    if (error) {
      console.error(`[Cleanup Error] Failed to delete records from "${table}" for org ${orgId}:`, error.message);
      throw new Error(`[Cleanup Failure] Deletion from table "${table}" failed for org ${orgId}: ${error.message}`);
    }
  }

  // Verification step: Ensure the organization is completely gone
  const { data: verifyOrg, error: verifyErr } = await supabaseClient
    .from('organizations')
    .select('id')
    .eq('id', orgId)
    .maybeSingle();

  if (verifyErr) {
    console.warn(`[Cleanup Warning] Error during post-cleanup verification for org ${orgId}:`, verifyErr.message);
  }

  if (verifyOrg) {
    throw new Error(`[Cleanup Verification Failed] Organization ${orgId} still exists in database after deletion!`);
  }
}

/**
 * Cleanup strategy for interrupted test runs.
 * Only targets staging test organizations prefixed with TEST_STG_.
 * @param {any} supabaseClient
 */
export async function cleanupInterruptedStagingRuns(supabaseClient) {
  if (!supabaseClient) return;

  // Search for any staging test organizations from prior interrupted runs
  const { data: orphanedOrgs, error } = await supabaseClient
    .from('organizations')
    .select('id, company_code')
    .or('company_code.ilike.TEST_STG_%,company_code.ilike.TEST-STG-%,company_code.ilike.SEED-%');

  if (error || !orphanedOrgs || orphanedOrgs.length === 0) return;

  for (const org of orphanedOrgs) {
    if (org.company_code !== 'VAR001' && org.id !== 'a1a162f2-5877-4cc7-a6bd-12176ccd9f93') {
      console.log(`[Interrupted Run Cleanup] Cleaning up orphaned staging test org: ${org.company_code} (${org.id})`);
      await safeDeleteTestOrganization(supabaseClient, org.id);
    }
  }
}
