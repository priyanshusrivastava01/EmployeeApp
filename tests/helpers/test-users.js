/**
 * Playwright Test Session & User Fixtures
 * Uses isolated synthetic test identities - never modifies real database records.
 */

export const TEST_ORG = {
  id: 'org-test-001',
  name: 'Acme Tech',
  slug: 'acme-tech',
  company_code: 'ACME01',
  is_active: true
};

export const TEST_FOUNDER = {
  id: 'user-test-founder',
  name: 'Rohan Deshmukh',
  email: 'admin@acmetech.com',
  role: 'founder',
  department: 'Management',
  designation: 'Founder & CEO',
  is_active: true
};

export const TEST_ADMIN = {
  id: 'user-test-admin',
  name: 'Acme Admin',
  email: 'admin@acmetech.com',
  role: 'admin',
  department: 'Administration',
  designation: 'System Administrator',
  is_active: true
};

export const TEST_TEAM_LEADER = {
  id: 'user-test-tl',
  name: 'Priya Nair',
  email: 'priya.n@acmetech.com',
  role: 'team_leader',
  department: 'Engineering',
  designation: 'Lead Engineer',
  is_active: true
};

export const TEST_EMPLOYEE = {
  id: 'user-test-emp',
  name: 'Aarav Sharma',
  email: 'aarav.sharma@acmetech.com',
  role: 'employee',
  department: 'Engineering',
  designation: 'Software Engineer',
  is_active: true
};

/**
 * Pre-authenticates the browser session using localStorage before page script execution.
 */
export async function injectSession(page, user, org = TEST_ORG) {
  await page.addInitScript(({ u, o }) => {
    localStorage.setItem('ems_web_token', 'test-e2e-isolated-jwt-token');
    localStorage.setItem('ems_web_user', JSON.stringify(u));
    localStorage.setItem('ems_web_org', JSON.stringify(o));
  }, { u: user, o: org });
}
