/**
 * Employee Management System (EMS) — Multi-Organization Backend API
 * Version: 3.0.0 — Phase 2–4 Implementation
 *
 * Architecture:
 *  - JWT-based authentication (bcryptjs + jsonwebtoken)
 *  - Organization-scoped data isolation enforced server-side
 *  - Supabase PostgreSQL when configured, in-memory fallback for development
 *  - All protected routes validate: auth → role → org membership → business logic
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const xlsx = require('xlsx');
const { supabase } = require('./config/supabase');
const { requireAuth, requireRole, generateToken } = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY DATA STORE (Development fallback when Supabase not configured)
// ─────────────────────────────────────────────────────────────────────────────
const memDb = {
  organizations: [
    {
      id: 'org-demo-001',
      public_company_id: 'CMP-7K4M9X2Q',
      name: 'Acme Technologies Pvt. Ltd.',
      slug: 'acme-tech',
      industry: 'Information Technology',
      country: 'India',
      city: 'Bengaluru',
      employee_size_range: '50-100',
      logo_url: null,
      contact_email: 'admin@acmetech.com',
      contact_phone: '+91 98765 00001',
      address: 'Bangalore Technology Park, Whitefield, Bengaluru 560066',
      timezone: 'Asia/Kolkata',
      working_days: 'Mon,Tue,Wed,Thu,Fri',
      work_start_time: '09:30',
      work_end_time: '18:30',
      late_threshold_minutes: 15,
      office_lat: 12.9716,
      office_lng: 77.5946,
      office_radius_meters: 150,
      wfh_allowed: true,
      is_active: true,
      created_at: new Date('2026-01-01').toISOString()
    },
    {
      id: 'org-demo-002',
      public_company_id: 'CMP-3N8V2P6W',
      name: 'Nexus Solutions Ltd.',
      slug: 'nexus-solutions',
      industry: 'Software Consulting',
      country: 'India',
      city: 'Gurugram',
      employee_size_range: '20-50',
      logo_url: null,
      contact_email: 'hr@nexussolutions.in',
      contact_phone: '+91 97654 00002',
      address: 'Gurgaon Innovation Hub, Sector 44, Gurugram 122003',
      timezone: 'Asia/Kolkata',
      working_days: 'Mon,Tue,Wed,Thu,Fri',
      work_start_time: '10:00',
      work_end_time: '19:00',
      late_threshold_minutes: 20,
      office_lat: 28.4595,
      office_lng: 77.0266,
      office_radius_meters: 200,
      wfh_allowed: true,
      is_active: true,
      created_at: new Date('2026-02-01').toISOString()
    }
  ],

  // Demo users (password is admin123 for all demo accounts)
  users: [
    {
      id: 'user-admin-001',
      organization_id: 'org-demo-001',
      employee_id_number: 'FND-0001',
      email: 'admin@acmetech.com',
      password_hash: '$2b$10$ZdS.xY3NUYUlGp14Ninj5e17gZcqbzKPkj/kmiEz56u/txooGEZuy', // admin123
      name: 'Rohan Deshmukh',
      role: 'founder',
      department: 'Management',
      designation: 'Founder & CEO',
      phone: '+91 98765 00001',
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date('2026-01-01').toISOString()
    },
    {
      id: 'user-admin-002',
      organization_id: 'org-demo-001',
      employee_id_number: 'ADM-0001',
      email: 'ananya.r@acmetech.com',
      password_hash: '$2b$10$ZdS.xY3NUYUlGp14Ninj5e17gZcqbzKPkj/kmiEz56u/txooGEZuy', // admin123
      name: 'Ananya Roy',
      role: 'admin',
      department: 'Operations',
      designation: 'Operations Director',
      phone: '+91 98765 00003',
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date('2026-01-02').toISOString()
    },
    {
      id: 'user-tl-001',
      organization_id: 'org-demo-001',
      employee_id_number: 'TLD-0001',
      email: 'priya.n@acmetech.com',
      password_hash: '$2b$10$ZdS.xY3NUYUlGp14Ninj5e17gZcqbzKPkj/kmiEz56u/txooGEZuy', // admin123
      name: 'Priya Nambiar',
      role: 'team_leader',
      department: 'Engineering',
      designation: 'Frontend Lead',
      phone: '+91 98234 56789',
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date('2026-01-05').toISOString()
    },
    {
      id: 'user-emp-001',
      organization_id: 'org-demo-001',
      employee_id_number: 'EMP-0001',
      email: 'aarav.sharma@acmetech.com',
      password_hash: '$2b$10$ZdS.xY3NUYUlGp14Ninj5e17gZcqbzKPkj/kmiEz56u/txooGEZuy', // admin123
      name: 'Aarav Sharma',
      role: 'employee',
      department: 'Engineering',
      designation: 'Senior Frontend Engineer',
      monthly_salary: 45000,
      phone: '+91 98765 43210',
      team_leader_id: 'user-tl-001',
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date('2026-01-10').toISOString()
    },
    {
      id: 'user-emp-002',
      organization_id: 'org-demo-001',
      employee_id_number: 'EMP-0002',
      email: 'karan.v@acmetech.com',
      password_hash: '$2b$10$ZdS.xY3NUYUlGp14Ninj5e17gZcqbzKPkj/kmiEz56u/txooGEZuy', // admin123
      name: 'Karan Verma',
      role: 'employee',
      department: 'Operations',
      designation: 'Logistics Coordinator',
      phone: '+91 91234 87654',
      team_leader_id: null,
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date('2026-01-15').toISOString()
    },
    {
      id: 'user-nexus-001',
      organization_id: 'org-demo-002',
      employee_id_number: 'FND-0001',
      email: 'admin@nexussolutions.in',
      password_hash: '$2b$10$ZdS.xY3NUYUlGp14Ninj5e17gZcqbzKPkj/kmiEz56u/txooGEZuy', // admin123
      name: 'Vikram Mehta',
      role: 'founder',
      department: 'Management',
      designation: 'Managing Director',
      phone: '+91 97654 00002',
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date('2026-02-01').toISOString()
    }
  ],
  audits: [],

  invitations: [],
  passwordResets: [],

  attendance: [],
  dailyReports: [],
  leaves: [],
  announcements: [],
  rules: [],
  notifications: [],
  holidays: [],
  timesheets: [],
  bankDetails: [],
  profileUpdateRequests: [],
  salaryAdvances: [],

  // Seed some attendance for demo employee
  _init() {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    this.attendance = [
      {
        id: 'att-demo-001',
        organization_id: 'org-demo-001',
        user_id: 'user-emp-001',
        work_date: yesterday,
        mode: 'WFO',
        punch_in_time: `${yesterday}T09:32:00.000Z`,
        punch_in_lat: 12.9716,
        punch_in_lng: 77.5946,
        punch_in_accuracy: 12,
        punch_in_verified: true,
        punch_in_distance_meters: 45,
        punch_out_time: `${yesterday}T18:35:00.000Z`,
        punch_out_lat: 12.9718,
        punch_out_lng: 77.5948,
        punch_out_verified: true,
        total_minutes: 543,
        created_at: `${yesterday}T09:32:00.000Z`
      }
    ];

    this.announcements = [
      {
        id: 'ann-org1-001',
        organization_id: 'org-demo-001',
        title: 'Quarterly Town Hall — Q3 2026',
        message: 'Join us this Friday at 4:30 PM in the Main Conference Room for Q3 milestones, team recognition awards, and H2 product roadmap.',
        priority: 'high',
        audience: 'all',
        status: 'published',
        published_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        expires_at: null,
        created_by: 'user-admin-001',
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 3600000).toISOString()
      }
    ];

    this.rules = [
      {
        id: 'rule-org1-001',
        organization_id: 'org-demo-001',
        title: 'Working Hours & Core Overlap Policy',
        category: 'Attendance & Work',
        body: 'Standard office hours run from 9:30 AM to 6:30 PM Monday through Friday. Core collaboration window is 11:00 AM to 5:00 PM IST where all team members must be reachable.',
        status: 'published',
        version: '1.2',
        created_by: 'user-admin-001',
        created_at: new Date('2026-09-01').toISOString(),
        updated_at: new Date('2026-09-01').toISOString()
      }
    ];

    this.audits = [
      {
        id: 'audit-org1-001',
        organization_id: 'org-demo-001',
        auditor_id: 'user-tl-001',
        auditor_name: 'Priya Nambiar',
        auditor_role: 'team_leader',
        employee_id: 'user-emp-001',
        employee_name: 'Aarav Sharma',
        audit_date: '2026-10-23',
        category: 'Work Quality & Discipline',
        score: 9.0,
        strengths: 'Outstanding sprint delivery and proactive technical problem solving on mobile attendance module.',
        improvements: 'Maintain earlier daily report submissions before 6:30 PM.',
        remarks: 'Exceeding expectations for Q3 milestones.',
        action_items: 'Lead the next architecture review for offline geofencing.',
        created_at: new Date('2026-10-23T17:00:00Z').toISOString()
      }
    ];

    this.bankDetails = [
      {
        id: 'bank-demo-001',
        organization_id: 'org-demo-001',
        user_id: 'user-emp-001',
        account_holder_name: 'Aarav Sharma',
        bank_name: 'State Bank of India',
        account_number_masked: 'XXXXXX4892',
        account_number_hash: crypto.createHash('sha256').update('123456784892').digest('hex'),
        ifsc_code: 'SBIN0001234',
        account_type: 'Savings',
        status: 'Verified',
        rejection_reason: null,
        reviewed_by: 'user-admin-001',
        reviewed_at: new Date('2026-02-15T11:00:00Z').toISOString(),
        created_at: new Date('2026-02-10T09:30:00Z').toISOString(),
        updated_at: new Date('2026-02-15T11:00:00Z').toISOString()
      }
    ];

    this.salaryAdvances = [
      {
        id: 'adv-demo-001',
        organization_id: 'org-demo-001',
        user_id: 'user-emp-001',
        requested_amount: 15000,
        repayment_months: 2,
        reason_category: 'Rent / Housing Expenses',
        reason_description: 'Advance payment for apartment security deposit',
        status: 'Paid',
        approved_amount: 15000,
        approval_remarks: 'Approved as per standard company policy',
        reviewed_by: 'user-admin-001',
        reviewed_at: new Date('2026-09-05T10:00:00Z').toISOString(),
        amount_paid: 15000,
        payment_method: 'Bank Transfer (NEFT)',
        transaction_reference: 'UTR984729184712',
        payment_proof_url: null,
        payment_remarks: 'Disbursed to verified bank account',
        payment_recorded_by: 'user-admin-001',
        payment_recorded_at: new Date('2026-09-06T14:30:00Z').toISOString(),
        created_at: new Date('2026-09-04T12:00:00Z').toISOString(),
        updated_at: new Date('2026-09-06T14:30:00Z').toISOString()
      }
    ];
  }
};

memDb._init();

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: org-scoped query helpers for in-memory fallback
// ─────────────────────────────────────────────────────────────────────────────
const mem = {
  findUserByEmail: (email) => memDb.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findUserById: (id) => memDb.users.find(u => u.id === id),
  findOrgBySlug: (slug) => memDb.organizations.find(o => o.slug.toLowerCase() === slug.toLowerCase()),
  findOrgById: (id) => memDb.organizations.find(o => o.id === id),
  findOrgByCompanyId: (companyId) => memDb.organizations.find(o => o.public_company_id && o.public_company_id.toUpperCase() === companyId.toUpperCase()),
  findUserByMemberId: (orgId, memberId) => memDb.users.find(u => u.organization_id === orgId && u.employee_id_number && u.employee_id_number.toUpperCase() === memberId.toUpperCase()),
  findInvitationByTokenHash: (orgId, tokenHash) => (memDb.invitations || []).find(i => (!orgId || i.organization_id === orgId) && i.token_hash === tokenHash),
  getInvitationsForOrg: (orgId) => (memDb.invitations || []).filter(i => i.organization_id === orgId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  findPasswordResetByTokenHash: (tokenHash) => (memDb.passwordResets || []).find(r => r.token_hash === tokenHash && r.status === 'pending'),
  getUsersForOrg: (orgId) => memDb.users.filter(u => u.organization_id === orgId),
  getAttendanceForOrg: (orgId, userId) => {
    let list = memDb.attendance.filter(a => a.organization_id === orgId);
    if (userId) list = list.filter(a => a.user_id === userId);
    return list.sort((a, b) => new Date(b.work_date) - new Date(a.work_date));
  },
  getLeavesForOrg: (orgId, userId) => {
    let list = memDb.leaves.filter(l => l.organization_id === orgId);
    if (userId) list = list.filter(l => l.user_id === userId);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  getAnnouncementsForOrg: (orgId, publishedOnly) => {
    let list = memDb.announcements.filter(a => a.organization_id === orgId);
    if (publishedOnly) list = list.filter(a => a.status === 'published');
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  getRulesForOrg: (orgId, publishedOnly) => {
    let list = memDb.rules.filter(r => r.organization_id === orgId);
    if (publishedOnly) list = list.filter(r => r.status === 'published');
    return list;
  },
  getReportsForOrg: (orgId, userId) => {
    let list = memDb.dailyReports.filter(r => r.organization_id === orgId);
    if (userId) list = list.filter(r => r.user_id === userId);
    return list.sort((a, b) => new Date(b.work_date) - new Date(a.work_date));
  },
  getAuditsForOrg: (orgId, auditorId, employeeId) => {
    let list = (memDb.audits || []).filter(a => a.organization_id === orgId);
    if (auditorId) list = list.filter(a => a.auditor_id === auditorId);
    if (employeeId) list = list.filter(a => a.employee_id === employeeId);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  getHolidaysForOrg: (orgId) => memDb.holidays.filter(h => h.organization_id === orgId).sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date)),
  getNotificationsForUser: (orgId, userId) => memDb.notifications.filter(n => n.organization_id === orgId && n.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  getBankDetailsForUser: (orgId, userId) => memDb.bankDetails.find(b => b.organization_id === orgId && b.user_id === userId),
  getBankDetailsForOrg: (orgId) => memDb.bankDetails.filter(b => b.organization_id === orgId),
  getProfileUpdatesForUser: (orgId, userId) => (memDb.profileUpdateRequests || []).filter(p => p.organization_id === orgId && p.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  getProfileUpdatesForOrg: (orgId) => (memDb.profileUpdateRequests || []).filter(p => p.organization_id === orgId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  getAdvancesForUser: (orgId, userId) => (memDb.salaryAdvances || []).filter(a => a.organization_id === orgId && a.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  getAdvancesForOrg: (orgId) => (memDb.salaryAdvances || []).filter(a => a.organization_id === orgId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
};

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER GENERATION & CRYPTO HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function generateCompanyId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id = '';
  do {
    id = 'CMP-';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      id += chars[bytes[i] % chars.length];
    }
  } while (memDb.organizations.some(o => o.public_company_id === id));
  return id;
}

function generateMemberId(role, orgId) {
  let prefix = 'EMP';
  if (role === 'founder') prefix = 'FND';
  else if (role === 'admin') prefix = 'ADM';
  else if (role === 'team_leader') prefix = 'TLD';

  const orgUsers = memDb.users.filter(u => u.organization_id === orgId && u.employee_id_number && u.employee_id_number.startsWith(`${prefix}-`));
  let maxSeq = 0;
  for (const u of orgUsers) {
    const parts = u.employee_id_number.split('-');
    if (parts.length === 2) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
}

function generateInvitationCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'INV-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generateResetCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'RST-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function hashToken(token) {
  if (!token) return '';
  return crypto.createHash('sha256').update(token.trim().toUpperCase()).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: safeUserView — remove sensitive fields before sending to clients
// ─────────────────────────────────────────────────────────────────────────────
function safeUserView(user, includePhone = false) {
  const { password_hash, ...rest } = user;
  if (!includePhone) delete rest.phone;
  if (rest.employee_id_number) {
    rest.employeeId = rest.employee_id_number;
  }
  return rest;
}

function getRolePermissions(role) {
  const isFounder = role === 'founder';
  const isAdmin = role === 'admin' || isFounder;
  const isTeamLeader = role === 'team_leader';
  const isManagement = isFounder || isAdmin || isTeamLeader;

  return {
    role,
    isManagement,
    canManageOrgSettings: isFounder,
    canManageGeofence: isAdmin,
    canManageStaff: isAdmin,
    canAssignRoles: isFounder,
    canViewAllAttendance: isAdmin,
    canViewAllReports: isAdmin,
    canAuditTeam: isManagement,
    canApproveLeaves: isManagement,
    canBroadcastAnnouncements: isAdmin,
    canManageRules: isAdmin,
    scope: isFounder || isAdmin ? 'organization' : isTeamLeader ? 'team' : 'self'
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'EMS Multi-Organization API',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: supabase ? 'supabase_connected' : 'memory_fallback',
    organizations: memDb.organizations.length,
    users: memDb.users.length
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'EMS API v3 running. See /api/health' });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY VERIFICATION & CODE AVAILABILITY (Public, unauthenticated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/companies/verify-code
 * Verifies whether a company code (user-chosen) or public_company_id exists and is active.
 * Does NOT authenticate the user. Does NOT expose private company data.
 */
app.post('/api/companies/verify-code', authLimiter, async (req, res) => {
  try {
    const { companyCode } = req.body;
    if (!companyCode || !companyCode.trim()) {
      return res.status(400).json({ success: false, error: 'Company code is required.' });
    }

    const code = companyCode.trim().toUpperCase();
    let org = null;

    if (supabase) {
      // Check both company_code and public_company_id
      const { data } = await supabase
        .from('organizations')
        .select('id, name, slug, public_company_id, company_code, is_active')
        .or(`company_code.ilike.${code},public_company_id.eq.${code}`)
        .limit(1)
        .maybeSingle();
      if (data) org = data;
    }

    if (!org) {
      // Fallback to in-memory
      org = memDb.organizations.find(o =>
        (o.company_code && o.company_code.toUpperCase() === code) ||
        (o.public_company_id && o.public_company_id.toUpperCase() === code)
      );
    }

    if (!org) {
      return res.status(404).json({
        success: false,
        error: 'No company found with this code. Please check the code and try again.'
      });
    }

    if (!org.is_active) {
      return res.status(403).json({
        success: false,
        error: 'This company account is currently inactive. Please contact the company administrator.'
      });
    }

    res.status(200).json({
      success: true,
      company: {
        id: org.id,
        companyCode: org.company_code || org.public_company_id,
        name: org.name,
        status: 'active'
      }
    });
  } catch (err) {
    console.error('[Verify Code] Error:', err.message);
    res.status(500).json({ success: false, error: 'Company verification failed. Please try again.' });
  }
});

/**
 * POST /api/companies/check-code-availability
 * Checks if a user-chosen company code is available for registration.
 * Does NOT create anything. Public endpoint.
 */
app.post('/api/companies/check-code-availability', authLimiter, async (req, res) => {
  try {
    const { companyCode } = req.body;
    if (!companyCode || !companyCode.trim()) {
      return res.status(400).json({ success: false, error: 'Company code is required.' });
    }

    const code = companyCode.trim().toUpperCase();

    // Validate format: 3-20 alphanumeric characters, may include hyphens
    if (!/^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$/.test(code) && !/^[A-Z0-9]{3,20}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Company code must be 3-20 characters using letters, numbers, and hyphens.',
        available: false
      });
    }

    let taken = false;

    if (supabase) {
      const { data } = await supabase
        .from('organizations')
        .select('id')
        .or(`company_code.ilike.${code},public_company_id.eq.${code}`)
        .limit(1)
        .maybeSingle();
      if (data) taken = true;
    }

    if (!taken) {
      taken = memDb.organizations.some(o =>
        (o.company_code && o.company_code.toUpperCase() === code) ||
        (o.public_company_id && o.public_company_id.toUpperCase() === code)
      );
    }

    res.status(200).json({
      success: true,
      available: !taken,
      companyCode: code,
      message: taken
        ? 'This company code is already in use. Please choose another code.'
        : 'This company code is available.'
    });
  } catch (err) {
    console.error('[Check Code] Error:', err.message);
    res.status(500).json({ success: false, error: 'Could not check code availability.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3: AUTHENTICATION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Authenticates a user with email + password and optional portal.
 * Returns a JWT with role and organizationId embedded (trusted values from DB).
 */
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password, portal, companyId } = req.body;
    const identifier = (email || '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Email or Employee ID, and password are required.' });
    }

    // 1. If companyId was provided, resolve and validate targetOrg first
    let targetOrg = null;
    if (companyId && companyId.trim()) {
      const compId = companyId.trim().toUpperCase();
      if (supabase) {
        const { data: dbOrg } = await supabase
          .from('organizations')
          .select('*')
          .or(`public_company_id.eq.${compId},slug.eq.${companyId.trim().toLowerCase()},id.eq.${companyId.trim()}`)
          .single();
        if (dbOrg) targetOrg = dbOrg;
      }
      if (!targetOrg) {
        targetOrg = mem.findOrgByCompanyId(compId) || mem.findOrgBySlug(companyId.trim().toLowerCase()) || mem.findOrgById(companyId.trim());
      }

      // If user provided a Company ID that does not exist, reject immediately
      if (!targetOrg) {
        return res.status(401).json({
          success: false,
          error: 'Specified Company ID was not found or is invalid.'
        });
      }
    }

    // Find user in DB or memory store
    let user = null;
    let org = targetOrg;

    if (identifier.includes('@')) {
      const normalizedEmail = identifier.toLowerCase();
      if (supabase) {
        let query = supabase
          .from('users')
          .select('*, organizations!organization_id(*)')
          .eq('email', normalizedEmail);
        if (targetOrg) {
          query = query.eq('organization_id', targetOrg.id);
        }
        const { data: userData, error } = await query.single();
        if (!error && userData) {
          user = userData;
          org = userData.organizations;
        }
      }

      if (!user) {
        user = mem.findUserByEmail(normalizedEmail);
        if (user) {
          // If targetOrg was specified, enforce that user must belong to targetOrg
          if (targetOrg && user.organization_id !== targetOrg.id) {
            return res.status(401).json({
              success: false,
              error: 'This account does not belong to the specified company.'
            });
          }
          org = mem.findOrgById(user.organization_id);
        }
      }
    } else {
      // Lookup by Employee ID (e.g. EMP-0001, FND-0001)
      const empId = identifier.toUpperCase();
      if (targetOrg) {
        org = targetOrg;
        if (supabase) {
          const { data: userData } = await supabase
            .from('users')
            .select('*, organizations!organization_id(*)')
            .eq('organization_id', targetOrg.id)
            .ilike('employee_id_number', empId)
            .single();
          if (userData) {
            user = userData;
            org = userData.organizations || targetOrg;
          }
        }
        if (!user) {
          user = mem.findUserByMemberId(targetOrg.id, empId);
        }
      } else {
        const matchingUsers = memDb.users.filter(u => u.employee_id_number && u.employee_id_number.toUpperCase() === empId);
        if (matchingUsers.length === 1) {
          user = matchingUsers[0];
          org = mem.findOrgById(user.organization_id);
        } else if (matchingUsers.length > 1) {
          return res.status(400).json({
            success: false,
            error: 'Multiple organizations found with this Employee ID. Please enter your Company ID to log in.'
          });
        }
      }
    }

    if (!user) {
      // Generic error to prevent user enumeration
      return res.status(401).json({ success: false, error: 'Invalid email, Employee ID, or password.' });
    }

    if (targetOrg && user.organization_id !== targetOrg.id) {
      return res.status(401).json({
        success: false,
        error: 'This account does not belong to the specified company.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Your account is pending activation or has been deactivated. Please contact your administrator.'
      });
    }

    // Verify password
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!org) {
      org = mem.findOrgById(user.organization_id);
    }
    if (!org) {
      return res.status(500).json({ success: false, error: 'Organization not found. Please contact support.' });
    }

    // Portal validation: Management vs Employee
    if (portal === 'management' && user.role === 'employee') {
      return res.status(403).json({
        success: false,
        error: 'This account is an Employee account. Please switch to Employee Login.',
        code: 'PORTAL_MISMATCH',
        expectedPortal: 'employee'
      });
    }

    if (portal === 'employee' && ['founder', 'admin', 'team_leader'].includes(user.role)) {
      const roleName = user.role === 'founder' ? 'Founder' : user.role === 'admin' ? 'Admin' : 'Team Leader';
      return res.status(403).json({
        success: false,
        error: `This account is a Management account (${roleName}). Please switch to Management Login.`,
        code: 'PORTAL_MISMATCH',
        expectedPortal: 'management'
      });
    }

    // Issue JWT — role comes from DB, never from client
    const token = generateToken(user, org.id, org.slug);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        employeeId: user.employee_id_number,
        role: user.role,       // 'founder' | 'admin' | 'team_leader' | 'employee'
        department: user.department,
        designation: user.designation,
        phone: user.phone,
        profilePhotoUrl: user.profile_photo_url,
        faceEnrollmentStatus: user.face_enrollment_status,
        permissions: getRolePermissions(user.role)
      },
      organization: {
        id: org.id,
        companyId: org.public_company_id,
        public_company_id: org.public_company_id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logo_url,
        timezone: org.timezone
      }
    });
  } catch (err) {
    console.error('[Auth Login] Error:', err.message);
    res.status(500).json({ success: false, error: 'Login failed due to a server error.' });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user's profile and organization.
 */
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    let user = null;
    let org = null;

    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, department, designation, phone, profile_photo_url, face_enrollment_status, is_active, organization_id, employee_id_number')
        .eq('id', req.user.id)
        .single();
      if (!error && data) user = data;
      const { data: orgData } = await supabase.from('organizations').select('*').eq('id', req.user.organizationId).single();
      if (orgData) org = orgData;
    }

    if (!user) user = mem.findUserById(req.user.id);
    if (!org) org = mem.findOrgById(req.user.organizationId);

    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    res.json({
      success: true,
      user: {
        ...safeUserView(user, true),
        permissions: getRolePermissions(user.role)
      },
      organization: org ? {
        ...org,
        companyId: org.public_company_id
      } : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user context.' });
  }
});

/**
 * POST /api/auth/register-company
 * Public self-service registration for a new company and its initial Founder.
 * Zero-cost, no paid APIs. Atomic creation with compensating rollback.
 */
app.post('/api/auth/register-company', authLimiter, async (req, res) => {
  try {
    const {
      fullName, founderName,
      email, founderEmail,
      phone,
      password, confirmPassword, founderPassword,
      companyName, name,
      companySlug, slug,
      industry, country, city, timezone, employeeSize
    } = req.body;

    const fName = (fullName || founderName || '').trim();
    const fEmail = (email || founderEmail || '').trim().toLowerCase();
    const fPassword = password || founderPassword;
    const cName = (companyName || name || '').trim();
    const userCompanyCode = (req.body.companyCode || '').trim().toUpperCase();

    // Check company code format and uniqueness early if provided
    if (userCompanyCode) {
      if (!/^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$/.test(userCompanyCode) && !/^[A-Z0-9]{3,20}$/.test(userCompanyCode)) {
        return res.status(400).json({
          success: false,
          error: 'Company code must be 3-20 characters using letters, numbers, and hyphens.'
        });
      }
      const codeExists = memDb.organizations.some(o =>
        (o.company_code && o.company_code.toUpperCase() === userCompanyCode) ||
        (o.public_company_id && o.public_company_id.toUpperCase() === userCompanyCode)
      );
      if (codeExists) {
        return res.status(409).json({
          success: false,
          error: 'This company code is already in use. Please choose another code.'
        });
      }
      if (supabase) {
        const { data: existingCode } = await supabase
          .from('organizations')
          .select('id')
          .or(`company_code.ilike.${userCompanyCode},public_company_id.eq.${userCompanyCode}`)
          .limit(1)
          .maybeSingle();
        if (existingCode) {
          return res.status(409).json({
            success: false,
            error: 'This company code is already in use. Please choose another code.'
          });
        }
      }
    }

    let cSlug = (companySlug || slug || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cSlug && cName) {
      cSlug = cName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
    if (!cSlug && userCompanyCode) {
      cSlug = userCompanyCode.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    if (!fName || !fEmail || !fPassword || !cName || !cSlug) {
      return res.status(400).json({
        success: false,
        error: 'Full name, email, password, company name, and company workspace slug are required.'
      });
    }

    if (confirmPassword && fPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    if (fPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    // Check slug uniqueness across organizations
    let existingOrg = mem.findOrgBySlug(cSlug);
    if (existingOrg) {
      // If slug was auto-generated, avoid false collision by appending random hex
      if (!companySlug && !slug) {
        cSlug = `${cSlug}-${crypto.randomBytes(2).toString('hex')}`;
      } else {
        return res.status(409).json({
          success: false,
          error: `Company workspace slug "${cSlug}" is already taken. Please choose another.`
        });
      }
    }

    // Check email uniqueness across users
    const existingUser = mem.findUserByEmail(fEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please log in instead.'
      });
    }

    // Assign validated user company code
    let validatedCompanyCode = userCompanyCode || null;

    // Extract location fields
    const locationData = req.body.location || {};
    const locAddress = (typeof locationData === 'string') ? locationData : (locationData.address || req.body.address || req.body.officeAddress || null);
    const locLat = locationData.latitude != null ? parseFloat(locationData.latitude) : (req.body.latitude != null ? parseFloat(req.body.latitude) : (req.body.officeLatitude != null ? parseFloat(req.body.officeLatitude) : null));
    const locLng = locationData.longitude != null ? parseFloat(locationData.longitude) : (req.body.longitude != null ? parseFloat(req.body.longitude) : (req.body.officeLongitude != null ? parseFloat(req.body.officeLongitude) : null));

    // Validate coordinates if provided
    if (locLat != null && (isNaN(locLat) || locLat < -90 || locLat > 90)) {
      return res.status(400).json({ success: false, error: 'Invalid latitude value. Must be between -90 and 90.' });
    }
    if (locLng != null && (isNaN(locLng) || locLng < -180 || locLng > 180)) {
      return res.status(400).json({ success: false, error: 'Invalid longitude value. Must be between -180 and 180.' });
    }

    const companyId = validatedCompanyCode || generateCompanyId();
    const founderId = 'FND-0001';
    const orgId = `org-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const userId = `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const branchId = `branch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const passwordHash = await bcrypt.hash(fPassword, 12);

    const newOrg = {
      id: orgId,
      public_company_id: companyId,
      name: cName,
      slug: cSlug,
      industry: industry || null,
      country: country || 'India',
      city: city || null,
      employee_size_range: employeeSize || null,
      logo_url: null,
      contact_email: fEmail,
      contact_phone: phone || null,
      company_code: validatedCompanyCode || null,
      address: locAddress || null,
      timezone: timezone || 'Asia/Kolkata',
      working_days: 'Mon,Tue,Wed,Thu,Fri',
      work_start_time: '09:30',
      work_end_time: '18:30',
      late_threshold_minutes: 15,
      office_lat: null,
      office_lng: null,
      office_radius_meters: 100,
      wfh_allowed: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newUser = {
      id: userId,
      organization_id: orgId,
      employee_id_number: founderId,
      email: fEmail,
      password_hash: passwordHash,
      name: fName,
      role: 'founder', // Server strictly enforces founder role for initial company creator
      department: 'Management',
      designation: 'Founder & CEO',
      phone: phone || null,
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { error: orgErr } = await supabase.from('organizations').insert([newOrg]);
      if (orgErr) {
        return res.status(500).json({ success: false, error: `Organization creation failed: ${orgErr.message}` });
      }
      const { error: userErr } = await supabase.from('users').insert([newUser]);
      if (userErr) {
        // Compensating rollback: delete organization to prevent orphaned records!
        await supabase.from('organizations').delete().eq('id', orgId);
        return res.status(500).json({ success: false, error: `Founder account creation failed: ${userErr.message}. Organization creation was rolled back.` });
      }
    }

    memDb.organizations.push(newOrg);
    memDb.users.push(newUser);

    // Create initial branch/location record
    const newBranch = {
      id: branchId,
      organization_id: orgId,
      name: 'Head Office',
      address: locAddress || null,
      latitude: locLat || null,
      longitude: locLng || null,
      radius_meters: 150,
      is_headquarters: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { error: branchErr } = await supabase.from('branches').insert([newBranch]);
      if (branchErr) {
        console.warn('[Register Company] Branch creation warning:', branchErr.message);
        // Non-fatal: company and user are already created
      }
    }

    if (!memDb.branches) memDb.branches = [];
    memDb.branches.push(newBranch);

    // Update org with office coordinates if provided
    if (locLat != null && locLng != null) {
      newOrg.office_lat = locLat;
      newOrg.office_lng = locLng;
      if (supabase) {
        await supabase.from('organizations').update({ office_lat: locLat, office_lng: locLng }).eq('id', orgId).catch(() => {});
      }
    }

    const token = generateToken(newUser, orgId, cSlug);
    res.status(201).json({
      success: true,
      message: 'Company and Founder account created successfully.',
      companyId: newOrg.public_company_id,
      founderId: newUser.employee_id_number,
      token,
      user: safeUserView(newUser, true),
      organization: {
        id: newOrg.id,
        companyId: newOrg.public_company_id,
        public_company_id: newOrg.public_company_id,
        company_code: newOrg.company_code,
        name: newOrg.name,
        slug: newOrg.slug,
        industry: newOrg.industry,
        country: newOrg.country,
        city: newOrg.city,
        timezone: newOrg.timezone
      },
      branch: {
        id: newBranch.id,
        name: newBranch.name,
        address: newBranch.address,
        latitude: newBranch.latitude,
        longitude: newBranch.longitude,
        is_headquarters: newBranch.is_headquarters
      }
    });
  } catch (err) {
    console.error('[Register Company] Error:', err.message);
    res.status(500).json({ success: false, error: 'Company registration failed due to a server error.' });
  }
});

/**
 * POST /api/auth/join-company
 * Activates an invited employee's account using Company ID, Employee ID or Email,
 * and the cryptographically secure invitation code.
 */
app.post('/api/auth/join-company', authLimiter, async (req, res) => {
  try {
    const companyId = req.body.companyId || req.body.companyCode;
    const employeeIdOrEmail = req.body.employeeIdOrEmail || req.body.email || req.body.employeeId;
    const { invitationCode, password, confirmPassword } = req.body;

    if (!companyId || !employeeIdOrEmail || !invitationCode || !password) {
      return res.status(400).json({
        success: false,
        error: 'Company ID, Employee ID or Email, Invitation Code, and Password are required.'
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    // Resolve company
    const trimmedCompId = companyId.trim().toUpperCase();
    let org = mem.findOrgByCompanyId(trimmedCompId) || mem.findOrgBySlug(companyId.trim().toLowerCase()) || mem.findOrgById(companyId.trim());
    if (!org) {
      return res.status(404).json({ success: false, error: 'Unknown Company ID. No matching company found.' });
    }

    // Hash the invitation code to verify
    const tokenHash = hashToken(invitationCode);
    const invite = mem.findInvitationByTokenHash(org.id, tokenHash);

    if (!invite) {
      // Check if token belongs to another organization
      const foreignInvite = (memDb.invitations || []).find(i => i.token_hash === tokenHash);
      if (foreignInvite) {
        return res.status(403).json({ success: false, error: 'This invitation does not belong to the specified company.' });
      }
      return res.status(400).json({ success: false, error: 'Invalid invitation code or company details.' });
    }

    if (invite.status === 'accepted') {
      return res.status(400).json({ success: false, error: 'This invitation has already been used to activate an account.' });
    }

    if (invite.status === 'revoked') {
      return res.status(400).json({ success: false, error: 'This invitation has been revoked by company administration.' });
    }

    if (invite.status === 'expired' || new Date(invite.expires_at) < new Date()) {
      invite.status = 'expired';
      return res.status(400).json({ success: false, error: 'This invitation has expired. Please contact your administrator for a new invite.' });
    }

    // Validate employee identifier matches invitation
    const empIdent = employeeIdOrEmail.trim().toLowerCase();
    const inviteEmail = (invite.email || '').toLowerCase();
    const inviteEmpId = (invite.employee_id_number || '').toLowerCase();
    if (empIdent !== inviteEmail && empIdent !== inviteEmpId) {
      return res.status(400).json({
        success: false,
        error: 'The provided Employee ID or Email does not match this invitation record.'
      });
    }

    // Find the associated user record
    let user = mem.findUserById(invite.user_id) || mem.findUserByEmail(invite.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile associated with invitation not found.' });
    }

    // Update user: activate account and set password
    const passwordHash = await bcrypt.hash(password, 12);
    user.password_hash = passwordHash;
    user.is_active = true;
    user.updated_at = new Date().toISOString();

    // Consume invitation
    invite.status = 'accepted';
    invite.accepted_at = new Date().toISOString();
    invite.updated_at = new Date().toISOString();

    if (supabase) {
      await supabase.from('users').update({ password_hash: passwordHash, is_active: true, updated_at: user.updated_at }).eq('id', user.id);
      await supabase.from('invitations').update({ status: 'accepted', accepted_at: invite.accepted_at, updated_at: invite.updated_at }).eq('id', invite.id);
    }

    const token = generateToken(user, org.id, org.slug);
    res.status(200).json({
      success: true,
      message: `Account activated successfully! Welcome to ${org.name}.`,
      token,
      user: safeUserView(user, true),
      organization: {
        id: org.id,
        companyId: org.public_company_id,
        public_company_id: org.public_company_id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logo_url,
        timezone: org.timezone
      }
    });
  } catch (err) {
    console.error('[Join Company] Error:', err.message);
    res.status(500).json({ success: false, error: 'Account activation failed due to a server error.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Initiates password reset. Single-use, short-lived reset token (15 mins).
 * Zero-cost: Returns devResetCode in response/logs when SMTP is not configured.
 */
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = mem.findUserByEmail(normalizedEmail);

    let devResetCode = null;
    if (user) {
      const resetCode = generateResetCode();
      const tokenHash = hashToken(resetCode);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const resetRecord = {
        id: `rst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        user_id: user.id,
        email: normalizedEmail,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt,
        created_at: new Date().toISOString()
      };

      memDb.passwordResets.push(resetRecord);
      if (supabase) {
        await supabase.from('password_resets').insert([{
          id: resetRecord.id,
          user_id: resetRecord.user_id,
          token_hash: resetRecord.token_hash,
          status: resetRecord.status,
          expires_at: resetRecord.expires_at,
          created_at: resetRecord.created_at
        }]);
      }

      devResetCode = resetCode;
      console.log(`[Zero-Cost Dev Recovery] Reset code for ${normalizedEmail}: ${resetCode} (Expires in 15 mins)`);
    }

    res.status(200).json({
      success: true,
      message: 'If an account with this email exists, password reset instructions have been generated.',
      devResetCode: devResetCode, // Provided in zero-cost development mode without paid SMTP
      resetCode: devResetCode
    });
  } catch (err) {
    console.error('[Forgot Password] Error:', err.message);
    res.status(500).json({ success: false, error: 'Password recovery request failed.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Resets user password using the single-use reset code.
 */
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, resetCode, newPassword, confirmPassword } = req.body;
    if (!email || !resetCode || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, reset code, and new password are required.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = mem.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired password reset code.' });
    }

    const tokenHash = hashToken(resetCode);
    const resetRecord = (memDb.passwordResets || []).find(r => r.user_id === user.id && r.token_hash === tokenHash && r.status === 'pending');

    if (!resetRecord) {
      return res.status(400).json({ success: false, error: 'Invalid or expired password reset code.' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      resetRecord.status = 'expired';
      return res.status(400).json({ success: false, error: 'Password reset code has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.password_hash = passwordHash;
    user.updated_at = new Date().toISOString();

    resetRecord.status = 'used';
    resetRecord.used_at = new Date().toISOString();

    if (supabase) {
      await supabase.from('users').update({ password_hash: passwordHash, updated_at: user.updated_at }).eq('id', user.id);
      await supabase.from('password_resets').update({ status: 'used', used_at: resetRecord.used_at }).eq('id', resetRecord.id);
    }

    res.status(200).json({
      success: true,
      message: 'Password has been successfully updated. You may now log in with your new password.'
    });
  } catch (err) {
    console.error('[Reset Password] Error:', err.message);
    res.status(500).json({ success: false, error: 'Password reset failed.' });
  }
});

/**
 * POST /api/invitations
 * Create employee profile and single-use invitation code (Founder/Admin only).
 */
app.post('/api/invitations', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const { name, email, role = 'employee', department, designation, phone, teamLeaderId } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Full name and email address are required.' });
    }

    if (!['employee', 'team_leader', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role.' });
    }

    if (role === 'admin' && req.user.role !== 'founder') {
      return res.status(403).json({ success: false, error: 'Only a Founder can invite Admin accounts.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingActive = mem.findUserByEmail(normalizedEmail);
    if (existingActive && existingActive.is_active) {
      return res.status(409).json({ success: false, error: 'An active user with this email address already exists.' });
    }

    const employeeId = generateMemberId(role, req.user.organizationId);
    const invitationCode = generateInvitationCode();
    const tokenHash = hashToken(invitationCode);

    // Temp unguessable password until employee activates account
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const userId = existingActive ? existingActive.id : `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newUser = {
      id: userId,
      organization_id: req.user.organizationId,
      employee_id_number: employeeId,
      email: normalizedEmail,
      password_hash: passwordHash,
      name,
      role,
      department: department || null,
      designation: designation || null,
      phone: phone || null,
      team_leader_id: teamLeaderId || null,
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: false, // Inactive until invitation activation
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const inviteId = `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const newInvite = {
      id: inviteId,
      organization_id: req.user.organizationId,
      user_id: userId,
      email: normalizedEmail,
      employee_id_number: employeeId,
      role,
      token_hash: tokenHash,
      token_preview: invitationCode.slice(0, 7),
      status: 'pending',
      expires_at: expiresAt,
      created_by: req.user.id,
      accepted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingActive) {
      const idx = memDb.users.findIndex(u => u.id === existingActive.id);
      if (idx !== -1) memDb.users[idx] = newUser;
    } else {
      memDb.users.push(newUser);
    }
    memDb.invitations.push(newInvite);

    if (supabase) {
      await supabase.from('users').upsert([newUser]);
      await supabase.from('invitations').insert([newInvite]);
    }

    const org = mem.findOrgById(req.user.organizationId);

    res.status(201).json({
      success: true,
      message: 'Employee record created and invitation generated.',
      invitation: {
        id: newInvite.id,
        email: newInvite.email,
        employeeId: employeeId,
        role: newInvite.role,
        status: newInvite.status,
        expiresAt: newInvite.expires_at,
        invitationCode: invitationCode, // Exposed in zero-cost mode for Founder to copy/share
        companyId: org ? org.public_company_id : null,
        companyName: org ? org.name : null
      },
      user: safeUserView(newUser, true)
    });
  } catch (err) {
    console.error('[Create Invitation] Error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create employee invitation.' });
  }
});

/**
 * GET /api/invitations
 * List all invitations for current organization (Founder/Admin only).
 */
app.get('/api/invitations', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const invites = mem.getInvitationsForOrg(req.user.organizationId).map(i => ({
      id: i.id,
      email: i.email,
      employeeId: i.employee_id_number,
      role: i.role,
      status: i.status,
      expiresAt: i.expires_at,
      tokenPreview: i.token_preview,
      createdAt: i.created_at,
      acceptedAt: i.accepted_at
    }));
    res.json({ success: true, data: invites, invitations: invites, total: invites.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch invitations.' });
  }
});

/**
 * POST /api/invitations/:id/revoke
 * Revoke an active invitation (Founder/Admin only).
 */
app.post('/api/invitations/:id/revoke', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const invite = (memDb.invitations || []).find(i => i.id === id && i.organization_id === req.user.organizationId);
    if (!invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found in your organization.' });
    }
    if (invite.status === 'accepted') {
      return res.status(400).json({ success: false, error: 'Cannot revoke an invitation that has already been accepted.' });
    }

    invite.status = 'revoked';
    invite.updated_at = new Date().toISOString();

    if (supabase) {
      await supabase.from('invitations').update({ status: 'revoked', updated_at: invite.updated_at }).eq('id', id);
    }

    res.json({ success: true, message: 'Invitation has been revoked.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to revoke invitation.' });
  }
});

/**
 * POST /api/auth/register-org
 * Creates a new organization and its first admin user.
 * CONTROLLED: Protected by a setup secret to prevent public exploitation.
 * In production, restrict this endpoint or use a one-time setup key.
 */
app.post('/api/auth/register-org', authLimiter, async (req, res) => {
  try {
    const { setupKey, orgName, orgSlug, adminName, adminEmail, adminPassword } = req.body;

    // Simple setup key check — must be set in .env
    const expectedKey = process.env.ORG_SETUP_KEY || 'ems-setup-2026';
    if (setupKey !== expectedKey) {
      return res.status(403).json({ success: false, error: 'Invalid setup key.' });
    }

    if (!orgName || !orgSlug || !adminEmail || !adminPassword || !adminName) {
      return res.status(400).json({ success: false, error: 'All fields required: orgName, orgSlug, adminName, adminEmail, adminPassword.' });
    }

    if (adminPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    // Check slug uniqueness
    const existingOrg = mem.findOrgBySlug(orgSlug);
    if (existingOrg) {
      return res.status(409).json({ success: false, error: `Organization slug "${orgSlug}" is already taken.` });
    }

    const existingUser = mem.findUserByEmail(adminEmail);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'A user with that email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const orgId = `org-${Date.now()}`;
    const userId = `user-${Date.now()}`;

    const newOrg = {
      id: orgId,
      public_company_id: generateCompanyId(),
      name: orgName,
      slug: orgSlug,
      logo_url: null,
      contact_email: adminEmail,
      contact_phone: null,
      address: null,
      timezone: 'Asia/Kolkata',
      working_days: 'Mon,Tue,Wed,Thu,Fri',
      work_start_time: '09:30',
      work_end_time: '18:30',
      late_threshold_minutes: 15,
      office_lat: null,
      office_lng: null,
      office_radius_meters: 100,
      wfh_allowed: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newUser = {
      id: userId,
      organization_id: orgId,
      employee_id_number: 'ADM-0001',
      email: adminEmail.toLowerCase(),
      password_hash: passwordHash,
      name: adminName,
      role: 'admin',
      department: 'Management',
      designation: 'Administrator',
      phone: null,
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memDb.organizations.push(newOrg);
    memDb.users.push(newUser);

    if (supabase) {
      await supabase.from('organizations').insert([newOrg]);
      await supabase.from('users').insert([{ ...newUser }]);
    }

    const token = generateToken(newUser, orgId, orgSlug);
    res.status(201).json({
      success: true,
      message: `Organization "${orgName}" created successfully.`,
      token,
      organization: newOrg,
      user: safeUserView(newUser)
    });
  } catch (err) {
    console.error('[Register Org] Error:', err.message);
    res.status(500).json({ success: false, error: 'Organization registration failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4: ORGANIZATION & USER MANAGEMENT (Admin-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/org/settings
 * Returns current organization settings.
 */
app.get('/api/org/settings', requireAuth, async (req, res) => {
  try {
    let org = null;
    if (supabase) {
      const { data } = await supabase.from('organizations').select('*').eq('id', req.user.organizationId).single();
      org = data;
    }
    if (!org) org = mem.findOrgById(req.user.organizationId);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found.' });
    res.json({
      success: true,
      data: {
        ...org,
        companyId: org.public_company_id
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch organization settings.' });
  }
});

/**
 * PATCH /api/org/settings
 * Update organization settings (Admin only).
 */
app.patch('/api/org/settings', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const allowed = ['name', 'logo_url', 'contact_email', 'contact_phone', 'address',
      'timezone', 'working_days', 'work_start_time', 'work_end_time',
      'late_threshold_minutes', 'office_lat', 'office_lng', 'office_radius_meters', 'wfh_allowed'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.updated_at = new Date().toISOString();

    if (supabase) {
      const { data, error } = await supabase.from('organizations')
        .update(updates)
        .eq('id', req.user.organizationId)
        .select()
        .single();
      if (!error && data) return res.json({ success: true, data, source: 'supabase' });
    }

    const idx = memDb.organizations.findIndex(o => o.id === req.user.organizationId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Organization not found.' });
    memDb.organizations[idx] = { ...memDb.organizations[idx], ...updates };
    res.json({ success: true, data: memDb.organizations[idx], source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update organization settings.' });
  }
});

/**
 * GET /api/users
 * List all users in the caller's organization.
 * Admin/TL can list. Employees see only coworker-safe profile.
 */
app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const { role, search, department, status } = req.query;
    let users = [];

    if (supabase) {
      let query = supabase.from('users')
        .select('id, name, email, role, department, designation, phone, profile_photo_url, face_enrollment_status, is_active, team_leader_id, created_at')
        .eq('organization_id', req.user.organizationId);
      if (status && status !== 'all') query = query.eq('is_active', status === 'active');
      const { data, error } = await query;
      if (!error && data) users = data;
    }

    if (!users.length) {
      users = mem.getUsersForOrg(req.user.organizationId);
    }

    // Team Leaders only see assigned team members + themselves
    if (req.user.role === 'team_leader') {
      users = users.filter(u => u.team_leader_id === req.user.id || u.id === req.user.id);
    }

    // Employees cannot see phone numbers of coworkers (privacy)
    const isManagement = ['founder', 'admin', 'team_leader'].includes(req.user.role);
    users = users.map(u => ({
      id: u.id,
      name: u.name,
      email: isManagement ? u.email : undefined,
      role: u.role,
      department: u.department,
      designation: u.designation,
      phone: isManagement ? u.phone : undefined,
      profilePhotoUrl: u.profile_photo_url,
      faceEnrollmentStatus: isManagement ? u.face_enrollment_status : undefined,
      isActive: u.is_active,
      teamLeaderId: u.team_leader_id,
      joinedDate: u.created_at ? u.created_at.slice(0, 10) : null
    }));

    // Apply search/filter
    if (search) {
      const q = search.toLowerCase();
      users = users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.designation?.toLowerCase().includes(q));
    }
    if (department && department !== 'all') {
      users = users.filter(u => u.department === department);
    }
    if (role && role !== 'all') {
      users = users.filter(u => u.role === role);
    }

    res.json({ success: true, data: users, users: users, total: users.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch users.' });
  }
});

/**
 * GET /api/users/:id
 * Get single user profile. Admins see full data; employees see limited data.
 */
app.get('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let user = null;

    if (supabase) {
      const { data } = await supabase.from('users').select('*').eq('id', id).eq('organization_id', req.user.organizationId).single();
      user = data;
    }
    if (!user) {
      user = memDb.users.find(u => u.id === id && u.organization_id === req.user.organizationId);
    }

    if (!user) return res.status(404).json({ success: false, error: 'User not found in your organization.' });

    // Team Leader can only view assigned team members or self
    if (req.user.role === 'team_leader' && user.team_leader_id !== req.user.id && user.id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied. You can only view assigned team members.' });
    }

    const isAdminOrSelf = ['founder', 'admin', 'team_leader'].includes(req.user.role) || req.user.id === id;
    res.json({ success: true, data: safeUserView(user, isAdminOrSelf) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user.' });
  }
});

/**
 * POST /api/users
 * Create a new employee in the current organization (Founder/Admin only).
 */
app.post('/api/users', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const { name, email, password, role = 'employee', department, designation, phone, teamLeaderId } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email, and password are required.' });
    }
    if (!['employee', 'team_leader', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role.' });
    }
    // Only founder can create admin accounts
    if (role === 'admin' && req.user.role !== 'founder') {
      return res.status(403).json({ success: false, error: 'Only a Founder can create Admin accounts.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const existing = mem.findUserByEmail(email);
    if (existing) return res.status(409).json({ success: false, error: 'A user with that email already exists.' });

    const employeeId = generateMemberId(role, req.user.organizationId);
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: `user-${Date.now()}`,
      organization_id: req.user.organizationId,
      employee_id_number: employeeId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name,
      role,
      department: department || null,
      designation: designation || null,
      phone: phone || null,
      team_leader_id: teamLeaderId || null,
      profile_photo_url: null,
      face_enrollment_status: 'not_enrolled',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase.from('users').insert([newUser]).select().single();
      if (!error && data) {
        memDb.users.push(data);
        return res.status(201).json({ success: true, data: safeUserView(data, true), source: 'supabase' });
      }
    }

    memDb.users.push(newUser);
    res.status(201).json({ success: true, data: safeUserView(newUser, true), source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create user.' });
  }
});

/**
 * PATCH /api/users/:id
 * Update user profile. Admin can update any org user. Employee can update only their own permitted fields.
 */
app.patch('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, error: 'You can only update your own profile.' });
    }

    // Admin can update: name, role, department, designation, phone, teamLeaderId, isActive
    // Employee can update: name, phone, profile_photo_url
    const adminFields = ['name', 'role', 'department', 'designation', 'phone', 'team_leader_id', 'is_active'];
    const employeeFields = ['name', 'phone', 'profile_photo_url'];
    const allowedFields = isAdmin ? adminFields : employeeFields;

    const updates = {};
    allowedFields.forEach(field => {
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[field] !== undefined) updates[field] = req.body[field];
      if (req.body[camelField] !== undefined) updates[field] = req.body[camelField];
    });
    updates.updated_at = new Date().toISOString();

    if (supabase) {
      const { data, error } = await supabase.from('users')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', req.user.organizationId)
        .select()
        .single();
      if (!error && data) {
        const uIdx = memDb.users.findIndex(u => u.id === id);
        if (uIdx !== -1) memDb.users[uIdx] = { ...memDb.users[uIdx], ...updates };
        return res.json({ success: true, data: safeUserView(data, true), source: 'supabase' });
      }
    }

    const idx = memDb.users.findIndex(u => u.id === id && u.organization_id === req.user.organizationId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'User not found.' });
    memDb.users[idx] = { ...memDb.users[idx], ...updates };
    res.json({ success: true, data: safeUserView(memDb.users[idx], true), source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update user.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/attendance
 * Admin/TL: get all org attendance.
 * Employee: get own attendance only.
 */
app.get('/api/attendance', requireAuth, async (req, res) => {
  try {
    const isFounderOrAdmin = ['founder', 'admin'].includes(req.user.role);
    const isTeamLeader = req.user.role === 'team_leader';
    const isEmployee = req.user.role === 'employee';

    let targetUserId = null;
    let allowedTeamIds = null;

    if (isEmployee) {
      targetUserId = req.user.id;
    } else if (isTeamLeader) {
      const team = mem.getUsersForOrg(req.user.organizationId).filter(u => u.team_leader_id === req.user.id || u.id === req.user.id);
      allowedTeamIds = new Set(team.map(u => u.id));
      if (req.query.user_id) {
        if (!allowedTeamIds.has(req.query.user_id)) {
          return res.status(403).json({ success: false, error: 'Access denied. You can only view attendance for your assigned team members.' });
        }
        targetUserId = req.query.user_id;
      }
    } else {
      // Founder or Admin
      targetUserId = req.query.user_id || null;
    }

    const dateFrom = req.query.date_from;
    const dateTo = req.query.date_to;

    let records = [];
    if (supabase) {
      let query = supabase.from('attendance_records')
        .select('*, users!user_id(name, designation, department, profile_photo_url)')
        .eq('organization_id', req.user.organizationId)
        .order('work_date', { ascending: false })
        .limit(100);
      if (targetUserId) query = query.eq('user_id', targetUserId);
      if (dateFrom) query = query.gte('work_date', dateFrom);
      if (dateTo) query = query.lte('work_date', dateTo);
      const { data, error } = await query;
      if (!error && data) records = data;
    }

    if (!records.length) {
      records = mem.getAttendanceForOrg(req.user.organizationId, targetUserId);
      if (dateFrom) records = records.filter(r => r.work_date >= dateFrom);
      if (dateTo) records = records.filter(r => r.work_date <= dateTo);
    }

    if (isTeamLeader && !targetUserId && allowedTeamIds) {
      records = records.filter(r => allowedTeamIds.has(r.user_id));
    }

    res.json({ success: true, data: records, total: records.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch attendance.' });
  }
});

/**
 * POST /api/attendance/punch-in
 * Submit a Punch In record for the authenticated employee.
 */
app.post('/api/attendance/punch-in', requireAuth, async (req, res) => {
  try {
    const { mode = 'WFO', latitude, longitude, accuracy } = req.body;
    const photoPath = req.body.photoPath || req.body.photoUri;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'GPS coordinates are required for punch in.' });
    }
    if (!photoPath) {
      return res.status(400).json({ success: false, error: 'Attendance photo reference is required.' });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check for duplicate punch-in today
    const existingToday = memDb.attendance.find(
      a => a.user_id === req.user.id && a.work_date === today && a.organization_id === req.user.organizationId
    );
    if (existingToday) {
      return res.status(409).json({ success: false, error: 'You have already punched in today. Use punch-out to end your current session.' });
    }

    // Geofence check for WFO
    const org = mem.findOrgById(req.user.organizationId);
    let distanceMeters = null;
    let isVerified = mode === 'WFH'; // WFH doesn't require geofence

    if (mode === 'WFO' && org && org.office_lat && org.office_lng) {
      distanceMeters = haversineDistance(
        latitude, longitude,
        org.office_lat, org.office_lng
      );
      isVerified = distanceMeters <= (org.office_radius_meters || 100);
    }

    const punchInIso = new Date().toISOString();
    const newRecord = {
      id: `att-${Date.now()}`,
      organization_id: req.user.organizationId,
      user_id: req.user.id,
      work_date: today,
      mode,
      punch_in_time: punchInIso,
      punchInTime: punchInIso,
      punch_in_lat: latitude,
      punch_in_lng: longitude,
      punch_in_accuracy: accuracy || null,
      punch_in_photo_path: photoPath,
      punch_in_verified: isVerified,
      punch_in_distance_meters: distanceMeters,
      punch_out_time: null,
      punch_out_lat: null,
      punch_out_lng: null,
      total_minutes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase.from('attendance_records').insert([newRecord]).select().single();
      if (!error && data) {
        memDb.attendance.push(data);
        return res.status(201).json({ success: true, data, attendance: data, geofenceVerified: data.punch_in_verified, distanceMeters, source: 'supabase' });
      }
    }

    memDb.attendance.push(newRecord);
    res.status(201).json({
      success: true,
      data: newRecord,
      attendance: newRecord,
      geofenceVerified: isVerified,
      distanceMeters,
      source: 'memory'
    });
  } catch (err) {
    console.error('[Punch In]', err.message);
    res.status(500).json({ success: false, error: 'Punch in failed.' });
  }
});

/**
 * POST /api/attendance/punch-out
 * Submit a Punch Out record.
 */
app.post('/api/attendance/punch-out', requireAuth, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, photoPath } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'GPS coordinates are required for punch out.' });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Find today's open session
    let sessionIdx = memDb.attendance.findIndex(
      a => a.user_id === req.user.id &&
           a.work_date === today &&
           a.organization_id === req.user.organizationId &&
           !a.punch_out_time
    );

    if (sessionIdx === -1) {
      return res.status(400).json({ success: false, error: 'No active punch-in session found for today. Please punch in first.' });
    }

    const session = memDb.attendance[sessionIdx];
    const punchInTime = new Date(session.punch_in_time);
    const punchOutTime = new Date();
    const totalMinutes = Math.floor((punchOutTime - punchInTime) / 60000);

    // Org geofence check
    const org = mem.findOrgById(req.user.organizationId);
    let distanceMeters = null;
    let isVerified = session.mode === 'WFH';

    if (session.mode === 'WFO' && org && org.office_lat && org.office_lng) {
      distanceMeters = haversineDistance(latitude, longitude, org.office_lat, org.office_lng);
      isVerified = distanceMeters <= (org.office_radius_meters || 100);
    }

    const updates = {
      punch_out_time: punchOutTime.toISOString(),
      punch_out_lat: latitude,
      punch_out_lng: longitude,
      punch_out_accuracy: accuracy || null,
      punch_out_photo_path: photoPath || null,
      punch_out_verified: isVerified,
      punch_out_distance_meters: distanceMeters,
      total_minutes: totalMinutes,
      updated_at: new Date().toISOString()
    };

    const punchOutIso = new Date().toISOString();
    updates.punch_out_time = punchOutIso;
    updates.punchOutTime = punchOutIso;

    if (supabase) {
      const { data, error } = await supabase.from('attendance_records')
        .update(updates)
        .eq('id', session.id)
        .eq('organization_id', req.user.organizationId)
        .select()
        .single();
      if (!error && data) {
        memDb.attendance[sessionIdx] = data;
        return res.json({ success: true, data, attendance: data, totalMinutes, source: 'supabase' });
      }
    }

    memDb.attendance[sessionIdx] = { ...session, ...updates };
    const outRecord = memDb.attendance[sessionIdx];
    res.json({ success: true, data: outRecord, attendance: outRecord, totalMinutes, source: 'memory' });
  } catch (err) {
    console.error('[Punch Out]', err.message);
    res.status(500).json({ success: false, error: 'Punch out failed.' });
  }
});

/**
 * GET /api/attendance/today
 * Returns today's attendance record for the current user.
 */
app.get('/api/attendance/today', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let record = null;

    if (supabase) {
      const { data } = await supabase.from('attendance_records')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('organization_id', req.user.organizationId)
        .eq('work_date', today)
        .single();
      record = data;
    }

    if (!record) {
      record = memDb.attendance.find(
        a => a.user_id === req.user.id && a.work_date === today && a.organization_id === req.user.organizationId
      ) || null;
    }

    const isPunchedIn = Boolean(record && record.punch_in_time && !record.punch_out_time);
    const isPunchedOut = Boolean(record && record.punch_out_time);

    res.json({
      success: true,
      data: record,
      record,
      isPunchedIn,
      isPunchedOut
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch today\'s attendance.' });
  }
});

/**
 * GET /api/attendance/stats
 * Returns org-wide attendance stats (Admin/TL only).
 */
app.get('/api/attendance/stats', requireAuth, requireRole(['founder', 'admin', 'team_leader']), async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let orgUsers = mem.getUsersForOrg(req.user.organizationId);
    let todayRecords = memDb.attendance.filter(
      a => a.organization_id === req.user.organizationId && a.work_date === today
    );

    // If Team Leader, scope calculations to assigned team
    if (req.user.role === 'team_leader') {
      const teamIds = new Set(
        orgUsers.filter(u => u.team_leader_id === req.user.id || u.id === req.user.id).map(u => u.id)
      );
      orgUsers = orgUsers.filter(u => teamIds.has(u.id));
      todayRecords = todayRecords.filter(a => teamIds.has(a.user_id));
    }

    const org = mem.findOrgById(req.user.organizationId);
    const lateMinutes = org?.late_threshold_minutes || 15;
    const workStartParts = (org?.work_start_time || '09:30').split(':');
    const workStartH = parseInt(workStartParts[0]);
    const workStartM = parseInt(workStartParts[1]);

    const presentToday = todayRecords.length;
    const wfoCount = todayRecords.filter(a => a.mode === 'WFO').length;
    const wfhCount = todayRecords.filter(a => a.mode === 'WFH').length;
    const lateArrivals = todayRecords.filter(a => {
      const punchTime = new Date(a.punch_in_time);
      const punchH = punchTime.getHours();
      const punchM = punchTime.getMinutes();
      const punchTotalMin = punchH * 60 + punchM;
      const workStartTotalMin = workStartH * 60 + workStartM + lateMinutes;
      return punchTotalMin > workStartTotalMin;
    }).length;

    const totalActive = orgUsers.filter(u => u.is_active && u.role !== 'admin' && u.role !== 'founder').length;

    const statsData = {
      totalEmployees: orgUsers.filter(u => u.role !== 'admin' && u.role !== 'founder').length,
      activeEmployees: totalActive,
      presentToday,
      absentToday: Math.max(0, totalActive - presentToday),
      lateArrivals,
      wfoCount,
      wfhCount,
      pendingLeaves: mem.getLeavesForOrg(req.user.organizationId, null).filter(l => l.status === 'pending').length,
      pendingReports: 0
    };

    res.json({
      success: true,
      data: statsData,
      ...statsData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch attendance stats.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DAILY REPORTS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/daily-reports', requireAuth, async (req, res) => {
  try {
    const isFounderOrAdmin = ['founder', 'admin'].includes(req.user.role);
    const isTeamLeader = req.user.role === 'team_leader';
    const isEmployee = req.user.role === 'employee';

    let targetUserId = null;
    let allowedTeamIds = null;

    if (isEmployee) {
      targetUserId = req.user.id;
    } else if (isTeamLeader) {
      const team = mem.getUsersForOrg(req.user.organizationId).filter(u => u.team_leader_id === req.user.id || u.id === req.user.id);
      allowedTeamIds = new Set(team.map(u => u.id));
      if (req.query.user_id) {
        if (!allowedTeamIds.has(req.query.user_id)) {
          return res.status(403).json({ success: false, error: 'Access denied. You can only view reports for your assigned team members.' });
        }
        targetUserId = req.query.user_id;
      }
    } else {
      targetUserId = req.query.user_id || null;
    }

    let reports = mem.getReportsForOrg(req.user.organizationId, targetUserId);
    if (isTeamLeader && !targetUserId && allowedTeamIds) {
      reports = reports.filter(r => allowedTeamIds.has(r.user_id));
    }

    res.json({ success: true, data: reports, total: reports.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch reports.' });
  }
});

// GET current user's draft report for today
app.get('/api/daily-reports/draft', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const draft = memDb.dailyReports.find(
      r => r.user_id === req.user.id && r.work_date === today && r.organization_id === req.user.organizationId && r.is_draft === true
    );
    if (!draft) return res.json({ success: true, data: null, draft: null });
    const draftPayload = {
      ...draft,
      projectName: draft.project_name,
      isDraft: draft.is_draft,
      tasks: draft.tasks || []
    };
    res.json({
      success: true,
      data: draftPayload,
      draft: draftPayload
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch draft report.' });
  }
});

// GET export submitted reports to genuine Excel .xlsx
app.get('/api/daily-reports/export', requireAuth, async (req, res) => {
  try {
    const isFounderOrAdmin = ['founder', 'admin'].includes(req.user.role);
    const isTeamLeader = req.user.role === 'team_leader';
    const isEmployee = req.user.role === 'employee';

    let targetUserId = isEmployee ? req.user.id : (req.query.user_id || (isFounderOrAdmin ? null : req.user.id));
    if (isTeamLeader && req.query.user_id) {
      const team = mem.getUsersForOrg(req.user.organizationId).filter(u => u.team_leader_id === req.user.id || u.id === req.user.id);
      const allowedTeamIds = new Set(team.map(u => u.id));
      if (!allowedTeamIds.has(req.query.user_id)) {
        return res.status(403).json({ success: false, error: 'Access denied. You can only export reports for your assigned team.' });
      }
      targetUserId = req.query.user_id;
    }

    let reports = mem.getReportsForOrg(req.user.organizationId, targetUserId);
    // Filter out drafts from official export
    reports = reports.filter(r => !r.is_draft);

    const monthFilter = req.query.month; // e.g. '2026-10'
    if (monthFilter) {
      reports = reports.filter(r => r.work_date && r.work_date.startsWith(monthFilter));
    }

    const org = mem.findOrgById(req.user.organizationId);
    const user = mem.findUserById(targetUserId || req.user.id);

    // Build genuine Excel spreadsheet rows
    const excelRows = reports.map(r => {
      const d = r.work_date ? new Date(r.work_date) : new Date();
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const monthStr = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      return {
        'Employee Name': r.user_name || user?.name || 'Staff Member',
        'Employee ID': user?.employee_id_number || 'N/A',
        'Company Workspace': org?.name || 'Acme Technologies',
        'Month': monthStr,
        'Date': r.work_date || 'N/A',
        'Day': dayName,
        'Project Name': r.project_name || 'General Operations',
        'Tasks Assigned / Work Description': r.tasks_assigned || r.work_summary || 'Daily operational tasks',
        'Completed Status': r.tasks_completed || 'No',
        'Pending Status': r.tasks_pending || 'No',
        'Speed Rating (1-10)': r.rating_speed != null ? Number(r.rating_speed) : '',
        'Understanding Rating (1-10)': r.rating_understanding != null ? Number(r.rating_understanding) : '',
        'Problem Solving Approach Rating (1-10)': r.rating_problem_solving != null ? Number(r.rating_problem_solving) : '',
        'Talking Behaviour Rating (1-10)': r.rating_talking_behaviour != null ? Number(r.rating_talking_behaviour) : '',
        'Work Quality Rating (1-10)': r.rating_work_quality != null ? Number(r.rating_work_quality) : '',
        'Discipline Rating (1-10)': r.rating_discipline != null ? Number(r.rating_discipline) : '',
        'Average Overall Rating': r.rating_average_overall != null ? Number(r.rating_average_overall) : ''
      };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelRows.length > 0 ? excelRows : [{
      'Employee Name': user?.name || 'Employee',
      'Employee ID': user?.employee_id_number || 'N/A',
      'Company Workspace': org?.name || '',
      'Status': 'No submitted task reports recorded for this period'
    }]);

    // Set readable column widths
    const colWidths = [
      { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 12 },
      { wch: 12 }, { wch: 25 }, { wch: 45 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 20 },
      { wch: 18 }, { wch: 20 }
    ];
    ws['!cols'] = colWidths;

    xlsx.utils.book_append_sheet(wb, ws, 'Daily Task Summary');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeMonth = monthFilter || new Date().toISOString().slice(0, 7);
    const filename = `Employee_Task_Reports_${safeMonth}.xlsx`;

    // If base64 parameter requested (for React Native FileSystem sharing)
    if (req.query.base64 === 'true') {
      return res.json({
        success: true,
        filename,
        base64: buffer.toString('base64'),
        rowCount: reports.length
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Export Reports] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate Excel task export.' });
  }
});

app.post('/api/daily-reports', requireAuth, async (req, res) => {
  try {
    const {
      projectName, tasksAssigned, tasksCompleted, tasksPending,
      ratingSpeed, ratingUnderstanding, ratingProblemSolving,
      ratingTalkingBehaviour, ratingWorkQuality, ratingDiscipline,
      workSummary, challenges, isDraft, is_draft
    } = req.body;

    const shouldSaveAsDraft = isDraft === true || is_draft === true;
    const today = new Date().toISOString().slice(0, 10);

    const existingIndex = memDb.dailyReports.findIndex(
      r => r.user_id === req.user.id && r.work_date === today && r.organization_id === req.user.organizationId
    );

    const ratings = [ratingSpeed, ratingUnderstanding, ratingProblemSolving, ratingTalkingBehaviour, ratingWorkQuality, ratingDiscipline].filter(r => r != null);
    const avg = ratings.length ? (ratings.reduce((a, b) => a + Number(b), 0) / ratings.length).toFixed(1) : null;

    if (existingIndex !== -1) {
      const existing = memDb.dailyReports[existingIndex];
      // If report was already submitted final, cannot modify or resubmit
      if (!existing.is_draft && !shouldSaveAsDraft) {
        return res.status(409).json({ success: false, error: 'You have already submitted a daily report for today.' });
      }

      // If updating an existing draft (or submitting an existing draft final)
      existing.project_name = projectName || existing.project_name;
      existing.tasks_assigned = tasksAssigned || existing.tasks_assigned;
      existing.tasks_completed = tasksCompleted || existing.tasks_completed;
      existing.tasks_pending = tasksPending || existing.tasks_pending;
      existing.tasks = req.body.tasks || existing.tasks || [];
      existing.rating_speed = ratingSpeed !== undefined ? ratingSpeed : existing.rating_speed;
      existing.rating_understanding = ratingUnderstanding !== undefined ? ratingUnderstanding : existing.rating_understanding;
      existing.rating_problem_solving = ratingProblemSolving !== undefined ? ratingProblemSolving : existing.rating_problem_solving;
      existing.rating_talking_behaviour = ratingTalkingBehaviour !== undefined ? ratingTalkingBehaviour : existing.rating_talking_behaviour;
      existing.rating_work_quality = ratingWorkQuality !== undefined ? ratingWorkQuality : existing.rating_work_quality;
      existing.rating_discipline = ratingDiscipline !== undefined ? ratingDiscipline : existing.rating_discipline;
      existing.rating_average_overall = avg || existing.rating_average_overall;
      existing.work_summary = workSummary || existing.work_summary;
      existing.challenges = challenges || existing.challenges;
      existing.is_draft = shouldSaveAsDraft;
      existing.updated_at = new Date().toISOString();
      if (!shouldSaveAsDraft && !existing.submitted_at) {
        existing.submitted_at = new Date().toISOString();
      }

      return res.status(200).json({
        success: true,
        data: {
          ...existing,
          isDraft: existing.is_draft,
          projectName: existing.project_name,
          tasks: existing.tasks
        },
        message: shouldSaveAsDraft ? 'Draft updated successfully.' : 'Daily report submitted successfully.'
      });
    }

    const newReport = {
      id: `rpt-${Date.now()}`,
      organization_id: req.user.organizationId,
      user_id: req.user.id,
      user_name: req.user.name,
      work_date: today,
      project_name: projectName || null,
      tasks_assigned: tasksAssigned || null,
      tasks_completed: tasksCompleted || 'No',
      tasks_pending: tasksPending || 'No',
      tasks: req.body.tasks || [],
      rating_speed: ratingSpeed != null ? ratingSpeed : null,
      rating_understanding: ratingUnderstanding != null ? ratingUnderstanding : null,
      rating_problem_solving: ratingProblemSolving != null ? ratingProblemSolving : null,
      rating_talking_behaviour: ratingTalkingBehaviour != null ? ratingTalkingBehaviour : null,
      rating_work_quality: ratingWorkQuality != null ? ratingWorkQuality : null,
      rating_discipline: ratingDiscipline != null ? ratingDiscipline : null,
      rating_average_overall: avg,
      work_summary: workSummary || null,
      challenges: challenges || null,
      is_draft: shouldSaveAsDraft,
      submitted_at: shouldSaveAsDraft ? null : new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memDb.dailyReports.push(newReport);
    res.status(shouldSaveAsDraft ? 200 : 201).json({
      success: true,
      data: {
        ...newReport,
        isDraft: newReport.is_draft,
        projectName: newReport.project_name,
        tasks: newReport.tasks
      },
      message: shouldSaveAsDraft ? 'Draft saved successfully.' : 'Daily report submitted successfully.'
    });
  } catch (err) {
    console.error('[Daily Reports Post] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to process daily report.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TEAM LEADER & MANAGEMENT AUDITS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/audits', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      return res.status(403).json({ success: false, error: 'Employees cannot access management audit records.' });
    }

    let audits = mem.getAuditsForOrg(req.user.organizationId);

    if (req.user.role === 'team_leader') {
      const team = mem.getUsersForOrg(req.user.organizationId).filter(u => u.team_leader_id === req.user.id || u.id === req.user.id);
      const allowedTeamIds = new Set(team.map(u => u.id));
      audits = audits.filter(a => a.auditor_id === req.user.id || allowedTeamIds.has(a.employee_id));
    }

    if (req.query.employee_id) {
      audits = audits.filter(a => a.employee_id === req.query.employee_id);
    }

    res.json({ success: true, data: audits, total: audits.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch audits.' });
  }
});

app.post('/api/audits', requireAuth, requireRole(['founder', 'admin', 'team_leader']), async (req, res) => {
  try {
    const { employeeId, employeeName, category = 'Performance & Quality', score, rating, strengths, improvements, remarks, actionItems } = req.body;
    const rawScore = score !== undefined ? score : rating;

    if (!employeeId || rawScore === undefined) {
      return res.status(400).json({ success: false, error: 'employeeId and score (1-10) are required.' });
    }

    const targetUser = mem.findUserById(employeeId) || mem.findUserByMemberId(req.user.organizationId, employeeId);
    if (req.user.role === 'team_leader') {
      if (!targetUser || (targetUser.team_leader_id !== req.user.id && targetUser.id !== req.user.id)) {
        return res.status(403).json({ success: false, error: 'Team leaders can only audit their assigned team members.' });
      }
    }

    const resolvedName = employeeName || targetUser?.name || 'Employee';

    const newAudit = {
      id: `audit-${Date.now()}`,
      organization_id: req.user.organizationId,
      auditor_id: req.user.id,
      auditor_name: req.user.name,
      auditor_role: req.user.role,
      employee_id: targetUser ? targetUser.id : employeeId,
      employee_name: resolvedName,
      audit_date: new Date().toISOString().slice(0, 10),
      category,
      score: Number(rawScore),
      strengths: strengths || null,
      improvements: improvements || null,
      remarks: remarks || null,
      action_items: actionItems || null,
      created_at: new Date().toISOString()
    };

    if (!memDb.audits) memDb.audits = [];
    memDb.audits.push(newAudit);

    res.status(201).json({ success: true, data: newAudit, audit: newAudit, message: 'Audit recorded successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to record audit.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/leaves', requireAuth, async (req, res) => {
  try {
    const isFounderOrAdmin = ['founder', 'admin'].includes(req.user.role);
    const isTeamLeader = req.user.role === 'team_leader';
    const isEmployee = req.user.role === 'employee';

    let targetUserId = null;
    let allowedTeamIds = null;

    if (isEmployee) {
      targetUserId = req.user.id;
    } else if (isTeamLeader) {
      const team = mem.getUsersForOrg(req.user.organizationId).filter(u => u.team_leader_id === req.user.id || u.id === req.user.id);
      allowedTeamIds = new Set(team.map(u => u.id));
      if (req.query.user_id) {
        if (!allowedTeamIds.has(req.query.user_id)) {
          return res.status(403).json({ success: false, error: 'Access denied. You can only view leaves for your assigned team members.' });
        }
        targetUserId = req.query.user_id;
      }
    } else {
      targetUserId = req.query.user_id || null;
    }

    let leaves = mem.getLeavesForOrg(req.user.organizationId, targetUserId);
    if (isTeamLeader && !targetUserId && allowedTeamIds) {
      leaves = leaves.filter(l => allowedTeamIds.has(l.user_id));
    }
    if (req.query.status && req.query.status !== 'all') {
      leaves = leaves.filter(l => l.status === req.query.status);
    }
    res.json({ success: true, data: leaves, total: leaves.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaves.' });
  }
});

app.post('/api/leaves', requireAuth, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, durationDays, reason } = req.body;
    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, error: 'leaveType, startDate, endDate, and reason are required.' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, error: 'End date cannot be before start date.' });
    }

    const newLeave = {
      id: `leave-${Date.now()}`,
      organization_id: req.user.organizationId,
      user_id: req.user.id,
      user_name: req.user.name,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      duration_days: Number(durationDays) || 1,
      reason,
      status: 'pending',
      reviewed_by: null,
      review_remarks: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memDb.leaves.push(newLeave);
    res.status(201).json({ success: true, data: newLeave, source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit leave request.' });
  }
});

const handleLeaveUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewRemarks, decisionComment } = req.body;
    const remarks = decisionComment || reviewRemarks || null;

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Use: approved, rejected, or cancelled.' });
    }

    const idx = memDb.leaves.findIndex(l => l.id === id && l.organization_id === req.user.organizationId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Leave request not found.' });

    memDb.leaves[idx] = {
      ...memDb.leaves[idx],
      status,
      reviewed_by: req.user.id,
      reviewed_by_name: req.user.name,
      review_remarks: remarks,
      decision_comment: remarks,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.json({ success: true, data: memDb.leaves[idx], source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update leave status.' });
  }
};

app.patch('/api/leaves/:id', requireAuth, requireRole(['admin', 'team_leader']), handleLeaveUpdate);
app.patch('/api/leaves/:id/status', requireAuth, requireRole(['admin', 'team_leader']), handleLeaveUpdate);

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS (org-scoped)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/announcements', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const showAll = req.query.all === 'true' && isAdmin;
    let list = mem.getAnnouncementsForOrg(req.user.organizationId, !showAll);
    res.json({ success: true, data: list, total: list.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch announcements.' });
  }
});

app.post('/api/announcements', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const { title, message, content, priority = 'normal', audience = 'all', status = 'published' } = req.body;
    const msg = message || content;
    if (!title || !msg) return res.status(400).json({ success: false, error: 'title and message are required.' });

    const newAnn = {
      id: `ann-${Date.now()}`,
      organization_id: req.user.organizationId,
      title,
      message: msg,
      content: msg,
      priority, audience, status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      expires_at: null,
      created_by: req.user.id,
      created_by_name: req.user.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memDb.announcements.push(newAnn);
    res.status(201).json({ success: true, data: newAnn, announcement: newAnn, source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create announcement.' });
  }
});

app.put('/api/announcements/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const idx = memDb.announcements.findIndex(a => a.id === id && a.organization_id === req.user.organizationId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Announcement not found.' });

    const { title, message, priority, audience, status } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title) updates.title = title;
    if (message) updates.message = message;
    if (priority) updates.priority = priority;
    if (audience) updates.audience = audience;
    if (status) {
      updates.status = status;
      if (status === 'published' && !memDb.announcements[idx].published_at) {
        updates.published_at = new Date().toISOString();
      }
    }

    memDb.announcements[idx] = { ...memDb.announcements[idx], ...updates };
    res.json({ success: true, data: memDb.announcements[idx], source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update announcement.' });
  }
});

app.delete('/api/announcements/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const idx = memDb.announcements.findIndex(a => a.id === id && a.organization_id === req.user.organizationId);
    if (idx !== -1) memDb.announcements.splice(idx, 1);
    res.json({ success: true, message: 'Announcement deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete announcement.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY RULES (org-scoped)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/rules', requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const showAll = req.query.all === 'true' && isAdmin;
    let list = mem.getRulesForOrg(req.user.organizationId, !showAll);
    if (req.query.category && req.query.category !== 'all') {
      list = list.filter(r => r.category === req.query.category);
    }
    res.json({ success: true, data: list, total: list.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch rules.' });
  }
});

app.post('/api/rules', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { title, category = 'General', body, version = '1.0', status = 'published' } = req.body;
    if (!title || !body) return res.status(400).json({ success: false, error: 'title and body are required.' });

    const newRule = {
      id: `rule-${Date.now()}`,
      organization_id: req.user.organizationId,
      title, category, body, version, status,
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memDb.rules.push(newRule);
    res.status(201).json({ success: true, data: newRule, source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create rule.' });
  }
});

app.put('/api/rules/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const idx = memDb.rules.findIndex(r => r.id === id && r.organization_id === req.user.organizationId);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Rule not found.' });

    const { title, category, body, version, status } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title) updates.title = title;
    if (category) updates.category = category;
    if (body) updates.body = body;
    if (version) updates.version = version;
    if (status) updates.status = status;

    memDb.rules[idx] = { ...memDb.rules[idx], ...updates };
    res.json({ success: true, data: memDb.rules[idx], source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update rule.' });
  }
});

app.delete('/api/rules/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const idx = memDb.rules.findIndex(r => r.id === id && r.organization_id === req.user.organizationId);
    if (idx !== -1) memDb.rules.splice(idx, 1);
    res.json({ success: true, message: 'Rule deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete rule.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HOLIDAYS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/holidays', requireAuth, async (req, res) => {
  try {
    const holidays = mem.getHolidaysForOrg(req.user.organizationId);
    res.json({ success: true, data: holidays });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch holidays.' });
  }
});

app.post('/api/holidays', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { name, holidayDate, type = 'company', description } = req.body;
    if (!name || !holidayDate) return res.status(400).json({ success: false, error: 'name and holidayDate are required.' });

    const newHoliday = {
      id: `hol-${Date.now()}`,
      organization_id: req.user.organizationId,
      name, holiday_date: holidayDate, type, description: description || null,
      created_at: new Date().toISOString()
    };
    memDb.holidays.push(newHoliday);
    res.status(201).json({ success: true, data: newHoliday, source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create holiday.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const notifications = mem.getNotificationsForUser(req.user.organizationId, req.user.id);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch notifications.' });
  }
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const idx = memDb.notifications.findIndex(n => n.id === req.params.id && n.user_id === req.user.id);
    if (idx !== -1) memDb.notifications[idx].is_read = true;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark notification.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/profile', requireAuth, (req, res) => {
  const user = mem.findUserById(req.user.id);
  const org = mem.findOrgById(req.user.organizationId);
  if (!user) return res.status(404).json({ success: false, error: 'Profile not found.' });
  res.json({ success: true, data: safeUserView(user, true), organization: org });
});

app.patch('/api/profile', requireAuth, async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'profile_photo_url'];
    const updates = {};
    allowed.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    updates.updated_at = new Date().toISOString();

    const idx = memDb.users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'User not found.' });
    memDb.users[idx] = { ...memDb.users[idx], ...updates };
    res.json({ success: true, data: safeUserView(memDb.users[idx], true), source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TIMESHEETS
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/timesheets', requireAuth, async (req, res) => {
  try {
    const isAdmin = ['admin', 'team_leader'].includes(req.user.role);
    const targetUserId = isAdmin ? (req.query.user_id || null) : req.user.id;
    let list = memDb.timesheets.filter(t => t.organization_id === req.user.organizationId);
    if (targetUserId) list = list.filter(t => t.user_id === targetUserId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch timesheets.' });
  }
});

app.post('/api/timesheets', requireAuth, async (req, res) => {
  try {
    const { workDate, projectName, taskDescription, hoursSpent } = req.body;
    const pName = projectName || req.body.project || 'General Tasks';
    const taskDesc = taskDescription || req.body.tasksSummary || req.body.summary || req.body.description;
    const hours = hoursSpent !== undefined ? hoursSpent : (req.body.totalHours !== undefined ? req.body.totalHours : req.body.hours);

    if (!pName || !taskDesc || !hours) {
      return res.status(400).json({ success: false, error: 'projectName, taskDescription, and hoursSpent are required.' });
    }
    const entry = {
      id: `ts-${Date.now()}`,
      organization_id: req.user.organizationId,
      user_id: req.user.id,
      work_date: workDate || req.body.weekStartDate || new Date().toISOString().slice(0, 10),
      project_name: pName,
      task_description: taskDesc,
      hours_spent: Number(hours),
      status: 'submitted',
      created_at: new Date().toISOString()
    };
    memDb.timesheets.push(entry);
    res.status(201).json({ success: true, data: entry, source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to log timesheet.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BANK DETAILS & SALARY ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

// Employee: View current bank details (masked)
app.get('/api/bank-details/me', requireAuth, async (req, res) => {
  try {
    const bank = mem.getBankDetailsForUser(req.user.organizationId, req.user.id);
    if (!bank) {
      return res.json({ success: true, data: null });
    }
    // Strict data masking: never leak full account number or internal hash
    const safeBank = {
      id: bank.id,
      accountHolderName: bank.account_holder_name,
      bankName: bank.bank_name,
      accountNumberMasked: bank.account_number_masked,
      maskedAccountNumber: bank.account_number_masked,
      ifscCode: bank.ifsc_code,
      accountType: bank.account_type,
      status: bank.status,
      rejectionReason: bank.rejection_reason,
      reviewedAt: bank.reviewed_at,
      updatedAt: bank.updated_at
    };
    res.json({ success: true, data: safeBank });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch bank details.' });
  }
});

// Employee: Submit or update bank details
app.post('/api/bank-details', requireAuth, async (req, res) => {
  try {
    const { accountHolderName, bankName, accountNumber, ifscCode, accountType = 'Savings' } = req.body;
    const confirmAccountNumber = req.body.confirmAccountNumber || accountNumber;

    if (!accountHolderName || !accountHolderName.trim()) {
      return res.status(400).json({ success: false, error: 'Account holder name is required.' });
    }
    if (!bankName || !bankName.trim()) {
      return res.status(400).json({ success: false, error: 'Bank name is required.' });
    }
    if (!accountNumber || !confirmAccountNumber) {
      return res.status(400).json({ success: false, error: 'Account number and confirmation are required.' });
    }
    if (accountNumber !== confirmAccountNumber) {
      return res.status(400).json({ success: false, error: 'Account number and confirm account number do not match.' });
    }

    const cleanAcc = accountNumber.replace(/\s+/g, '');
    if (!/^\d{9,18}$/.test(cleanAcc)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid bank account number (9 to 18 digits).' });
    }

    const cleanIfsc = (ifscCode || '').trim().toUpperCase();
    // Indian standard IFSC validation (4 letters, 0, 6 letters/digits)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IFSC code format. Standard Indian IFSC format is 4 letters, followed by 0, and 6 alphanumeric characters (e.g., SBIN0001234).'
      });
    }

    const masked = 'XXXXXX' + cleanAcc.slice(-4);
    const hash = crypto.createHash('sha256').update(cleanAcc).digest('hex');

    const existingIdx = memDb.bankDetails.findIndex(
      b => b.organization_id === req.user.organizationId && b.user_id === req.user.id
    );

    const now = new Date().toISOString();
    let record;

    if (existingIdx !== -1) {
      // Re-submission resets verification status to 'Pending Review'
      record = memDb.bankDetails[existingIdx];
      record.account_holder_name = accountHolderName.trim();
      record.bank_name = bankName.trim();
      record.account_number_masked = masked;
      record.account_number_hash = hash;
      record.ifsc_code = cleanIfsc;
      record.account_type = accountType;
      record.status = 'Pending Review';
      record.rejection_reason = null;
      record.reviewed_by = null;
      record.reviewed_at = null;
      record.updated_at = now;
    } else {
      record = {
        id: `bank-${Date.now()}`,
        organization_id: req.user.organizationId,
        user_id: req.user.id,
        account_holder_name: accountHolderName.trim(),
        bank_name: bankName.trim(),
        account_number_masked: masked,
        account_number_hash: hash,
        ifsc_code: cleanIfsc,
        account_type: accountType,
        status: 'Pending Review',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: now,
        updated_at: now
      };
      memDb.bankDetails.push(record);
    }

    res.status(200).json({
      success: true,
      message: 'Bank details submitted successfully. Verification status is Pending Review by company management.',
      data: {
        id: record.id,
        accountHolderName: record.account_holder_name,
        bankName: record.bank_name,
        accountNumberMasked: record.account_number_masked,
        maskedAccountNumber: record.account_number_masked,
        ifscCode: record.ifsc_code,
        accountType: record.account_type,
        status: record.status,
        updatedAt: record.updated_at
      }
    });
  } catch (err) {
    console.error('[Bank Details Submission] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit bank details.' });
  }
});

// Management: List submitted bank details for org (Admin/Founder only, TL forbidden)
app.get('/api/admin/bank-details', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const list = mem.getBankDetailsForOrg(req.user.organizationId).map(b => {
      const u = mem.findUserById(b.user_id);
      return {
        id: b.id,
        userId: b.user_id,
        employeeName: u?.name || 'Unknown',
        employeeId: u?.employee_id_number || 'N/A',
        department: u?.department || 'Operations',
        accountHolderName: b.account_holder_name,
        bankName: b.bank_name,
        accountNumberMasked: b.account_number_masked,
        ifscCode: b.ifsc_code,
        accountType: b.account_type,
        status: b.status,
        rejectionReason: b.rejection_reason,
        reviewedBy: b.reviewed_by,
        reviewedAt: b.reviewed_at,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      };
    });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch bank details.' });
  }
});

// Management: Verify or Reject bank details (Admin/Founder only)
app.patch('/api/admin/bank-details/:id/verify', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const rawStatus = req.body.status || req.body.verificationStatus;
    const { rejectionReason, reviewNotes } = req.body;
    const normalizedStatus = rawStatus?.toLowerCase() === 'verified' ? 'Verified' : rawStatus?.toLowerCase() === 'rejected' ? 'Rejected' : rawStatus;
    if (!['Verified', 'Rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Status must be Verified or Rejected.' });
    }
    const note = reviewNotes || rejectionReason;
    if (normalizedStatus === 'Rejected' && (!note || !note.trim())) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required when rejecting bank details.' });
    }

    const idx = memDb.bankDetails.findIndex(b => b.id === req.params.id && b.organization_id === req.user.organizationId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Bank record not found.' });
    }

    const record = memDb.bankDetails[idx];
    record.status = normalizedStatus === 'Verified' ? 'verified' : 'rejected';
    record.rejection_reason = note ? note.trim() : null;
    record.reviewed_by = req.user.id;
    record.reviewed_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();

    res.json({
      success: true,
      message: `Bank details marked as ${record.status}.`,
      data: {
        ...record,
        status: record.status,
        maskedAccountNumber: record.account_number_masked,
        accountNumberMasked: record.account_number_masked
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to review bank details.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE UPDATE REQUESTS (Self-Service with Review Lifecycle)
// ─────────────────────────────────────────────────────────────────────────────

// Employee: View my submitted profile update requests
app.get('/api/profile/update-requests/me', requireAuth, async (req, res) => {
  try {
    const list = mem.getProfileUpdatesForUser(req.user.organizationId, req.user.id);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch update requests.' });
  }
});

// Employee: Request update to personal information (phone, address)
app.post('/api/profile/update-request', requireAuth, async (req, res) => {
  try {
    let fieldName = req.body.fieldName || req.body.field;
    let newValue = req.body.newValue;
    const { currentValue } = req.body;

    if (!fieldName && req.body.requestedPhone) {
      fieldName = 'phone';
      newValue = req.body.requestedPhone;
    }

    const restrictedFields = ['role', 'designation', 'department', 'employeeId', 'employee_id_number', 'organizationId', 'is_active', 'email'];
    if (restrictedFields.includes(fieldName)) {
      return res.status(403).json({
        success: false,
        error: 'Official company employment details (Designation, Department, Employee ID, Role) cannot be edited directly by employees. Contact HR Administration.'
      });
    }

    if (!['phone', 'address'].includes(fieldName)) {
      return res.status(400).json({ success: false, error: 'Only personal contact phone or residential address update requests are supported.' });
    }

    if (!newValue || !newValue.trim()) {
      return res.status(400).json({ success: false, error: 'New value is required.' });
    }

    const reqRecord = {
      id: `pur-${Date.now()}`,
      organization_id: req.user.organizationId,
      user_id: req.user.id,
      user_name: req.user.name,
      field_name: fieldName,
      new_value: newValue.trim(),
      current_value: currentValue || null,
      status: 'Pending Review',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memDb.profileUpdateRequests.push(reqRecord);

    res.status(201).json({
      success: true,
      message: `Profile update request for ${fieldName} submitted for HR review.`,
      data: reqRecord
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to submit profile update request.' });
  }
});

// Management: List pending profile updates for org (Founder/Admin only)
app.get('/api/admin/profile-update-requests', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const list = mem.getProfileUpdatesForOrg(req.user.organizationId);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile update requests.' });
  }
});

// Management: Approve or reject profile update request
app.patch('/api/admin/profile-update-requests/:id', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const rawStatus = req.body.status || req.body.action;
    const normalizedStatus = rawStatus?.toLowerCase() === 'approved' ? 'Approved' : rawStatus?.toLowerCase() === 'rejected' ? 'Rejected' : rawStatus;
    const { rejectionReason } = req.body;
    if (!['Approved', 'Rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Status must be Approved or Rejected.' });
    }

    const idx = memDb.profileUpdateRequests.findIndex(p => p.id === req.params.id && p.organization_id === req.user.organizationId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Update request not found.' });
    }

    const request = memDb.profileUpdateRequests[idx];
    request.status = normalizedStatus;
    request.rejection_reason = normalizedStatus === 'Rejected' ? (rejectionReason || 'Declined by Administrator') : null;
    request.reviewed_by = req.user.id;
    request.reviewed_at = new Date().toISOString();
    request.updated_at = new Date().toISOString();

    // If approved, commit change to employee user profile
    if (normalizedStatus === 'Approved') {
      const userIdx = memDb.users.findIndex(u => u.id === request.user_id && u.organization_id === req.user.organizationId);
      if (userIdx !== -1) {
        if (request.field_name === 'phone') {
          memDb.users[userIdx].phone = request.new_value;
        } else if (request.field_name === 'address') {
          memDb.users[userIdx].address = request.new_value;
        }
        memDb.users[userIdx].updated_at = new Date().toISOString();
      }
    }

    res.json({
      success: true,
      message: `Profile update request ${normalizedStatus}.`,
      data: request
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to review update request.' });
  }
});

// Employee: Update profile photo directly
app.post('/api/profile/photo', requireAuth, async (req, res) => {
  try {
    const photoUrl = req.body.photoUrl || req.body.photoUri;
    if (!photoUrl) {
      return res.status(400).json({ success: false, error: 'photoUrl is required.' });
    }
    const idx = memDb.users.findIndex(u => u.id === req.user.id);
    if (idx !== -1) {
      memDb.users[idx].profile_photo_url = photoUrl;
      memDb.users[idx].updated_at = new Date().toISOString();
    }
    res.json({ success: true, message: 'Profile photo updated.', photoUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update profile photo.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SALARY ADVANCES WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ADVANCE_REASONS = [
  'Medical / Emergency Expenses',
  'Rent / Housing Expenses',
  'Education Expenses',
  'Family Emergency',
  'Personal Emergency',
  'Other'
];

// Employee: View my advance requests
app.get('/api/advances/me', requireAuth, async (req, res) => {
  try {
    const user = mem.findUserById(req.user.id);
    const advances = mem.getAdvancesForUser(req.user.organizationId, req.user.id).map(a => ({
      ...a,
      amount: a.requested_amount,
      requestedAmount: a.requested_amount,
      approvedAmount: a.approved_amount,
      paidAmount: a.amount_paid,
      transactionRef: a.transaction_reference,
      transactionReference: a.transaction_reference,
      reasonCategory: a.reason_category,
      reasonDescription: a.reason_description,
      tenure: a.tenure || `${a.repayment_months} Month${a.repayment_months > 1 ? 's' : ''}`
    }));
    res.json({
      success: true,
      data: advances,
      monthlySalary: user?.monthly_salary || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch advance requests.' });
  }
});

// Employee: Submit salary advance request
app.post('/api/advances', requireAuth, async (req, res) => {
  try {
    const rawAmount = req.body.requestedAmount !== undefined ? req.body.requestedAmount : req.body.amount;
    let { reasonCategory, reasonDescription } = req.body;
    if (!reasonCategory && req.body.reason) {
      const r = req.body.reason.toLowerCase();
      if (r.includes('medic') || r.includes('emergenc')) reasonCategory = 'Medical / Emergency Expenses';
      else if (r.includes('rent') || r.includes('hous')) reasonCategory = 'Rent / Housing Expenses';
      else if (r.includes('educat') || r.includes('school')) reasonCategory = 'Education Expenses';
      else reasonCategory = 'Other';
    }
    const tenureStr = req.body.tenure ? String(req.body.tenure).replace(/[^0-9]/g, '') : null;
    const repaymentMonths = req.body.repaymentMonths || (tenureStr ? parseInt(tenureStr, 10) : 1);

    const numAmount = Number(rawAmount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid numeric advance amount.' });
    }
    if (numAmount > 100000) {
      return res.status(400).json({ success: false, error: 'Advance amount exceeds company maximum policy limit (₹1,00,000).' });
    }

    if (!reasonCategory || !VALID_ADVANCE_REASONS.includes(reasonCategory)) {
      return res.status(400).json({
        success: false,
        error: `Please select a valid reason from: ${VALID_ADVANCE_REASONS.join(', ')}`
      });
    }

    if (reasonCategory === 'Other' && (!reasonDescription || !reasonDescription.trim())) {
      return res.status(400).json({
        success: false,
        error: 'When selecting "Other", a detailed reason description is required.'
      });
    }

    const months = parseInt(repaymentMonths, 10);
    if (isNaN(months) || months < 1 || months > 6) {
      return res.status(400).json({ success: false, error: 'Repayment period must be between 1 and 6 months.' });
    }

    const now = new Date().toISOString();
    const newAdvance = {
      id: `adv-${Date.now()}`,
      organization_id: req.user.organizationId,
      user_id: req.user.id,
      user_name: req.user.name,
      requested_amount: numAmount,
      amount: numAmount,
      repayment_months: months,
      tenure: `${months} Month${months > 1 ? 's' : ''}`,
      reason_category: reasonCategory,
      reason_description: reasonDescription ? reasonDescription.trim() : null,
      status: 'Pending Approval', // 'Pending Approval', 'Approved', 'Rejected', 'Payment Pending', 'Partially Paid', 'Paid', 'Settled'
      approved_amount: null,
      approval_remarks: null,
      reviewed_by: null,
      reviewed_at: null,
      amount_paid: 0,
      payment_method: null,
      transaction_reference: null,
      payment_proof_url: null,
      payment_remarks: null,
      payment_recorded_by: null,
      payment_recorded_at: null,
      created_at: now,
      updated_at: now
    };

    memDb.salaryAdvances.push(newAdvance);

    res.status(200).json({
      success: true,
      message: 'Salary advance request submitted successfully for management approval.',
      data: {
        ...newAdvance,
        amount: newAdvance.requested_amount,
        requestedAmount: newAdvance.requested_amount
      }
    });
  } catch (err) {
    console.error('[Advance Submission] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit advance request.' });
  }
});

// Management: List all advance requests for org (Founder/Admin only, TL forbidden)
app.get('/api/admin/advances', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const advances = mem.getAdvancesForOrg(req.user.organizationId).map(a => {
      const u = mem.findUserById(a.user_id);
      return {
        ...a,
        employeeName: u?.name || a.user_name || 'Staff Member',
        employeeId: u?.employee_id_number || 'N/A',
        department: u?.department || 'Operations'
      };
    });
    res.json({ success: true, data: advances });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch advances.' });
  }
});

// Management: Approve or reject advance request (Founder/Admin only)
app.patch('/api/admin/advances/:id/approve', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const { approvedAmount, remarks } = req.body;
    const action = (req.body.action || (req.body.status?.toLowerCase().includes('reject') ? 'reject' : 'approve')).toLowerCase();
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be approve or reject.' });
    }

    const idx = memDb.salaryAdvances.findIndex(a => a.id === req.params.id && a.organization_id === req.user.organizationId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Advance request not found.' });
    }

    const advance = memDb.salaryAdvances[idx];
    const now = new Date().toISOString();

    if (action === 'approve') {
      const finalAmount = approvedAmount ? Number(approvedAmount) : advance.requested_amount;
      if (isNaN(finalAmount) || finalAmount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid approved amount.' });
      }
      advance.status = 'Approved';
      advance.payment_status = 'Payment Pending';
      advance.approved_amount = finalAmount;
      advance.approval_remarks = remarks || 'Approved by Company Management. Payment pending disbursement.';
      advance.reviewed_by = req.user.id;
      advance.reviewed_at = now;
      advance.updated_at = now;
    } else {
      advance.status = 'Rejected';
      advance.approval_remarks = remarks || 'Declined by Company Management';
      advance.reviewed_by = req.user.id;
      advance.reviewed_at = now;
      advance.updated_at = now;
    }

    res.json({
      success: true,
      message: `Salary advance request ${advance.status}.`,
      data: {
        ...advance,
        status: advance.status,
        approvedAmount: advance.approved_amount,
        amount: advance.requested_amount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to review advance request.' });
  }
});

// Management: Record actual payment disbursement with UTR/reference proof (Founder/Admin only)
app.post('/api/admin/advances/:id/payment', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const idx = memDb.salaryAdvances.findIndex(a => a.id === req.params.id && a.organization_id === req.user.organizationId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Advance request not found.' });
    }

    const advance = memDb.salaryAdvances[idx];
    if (advance.status === 'Rejected') {
      return res.status(400).json({ success: false, error: 'Cannot disburse payment for a rejected advance request.' });
    }

    const { paymentMethod = 'Bank Transfer', paymentProofUrl, remarks } = req.body;
    const rawPaid = req.body.amountPaid !== undefined ? req.body.amountPaid : (req.body.amount !== undefined ? req.body.amount : (advance.approved_amount || advance.requested_amount));
    const transactionReference = req.body.transactionReference || req.body.transactionRef || req.body.utr;

    const numPaid = Number(rawPaid);
    if (!numPaid || isNaN(numPaid) || numPaid <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid disbursement payment amount.' });
    }
    if (!transactionReference || !transactionReference.trim()) {
      return res.status(400).json({ success: false, error: 'Transaction reference or UTR number is required for audit verification.' });
    }

    const now = new Date().toISOString();
    const approvedTarget = advance.approved_amount || advance.requested_amount;
    const previousPaid = advance.amount_paid || 0;
    const newTotalPaid = previousPaid + numPaid;

    advance.amount_paid = newTotalPaid;
    advance.payment_method = paymentMethod;
    advance.transaction_reference = transactionReference.trim();
    advance.payment_proof_url = paymentProofUrl || null;
    advance.payment_remarks = remarks || 'Disbursed via bank transfer';
    advance.payment_recorded_by = req.user.id;
    advance.payment_recorded_at = now;
    advance.updated_at = now;

    if (newTotalPaid >= approvedTarget) {
      advance.status = 'Paid';
    } else {
      advance.status = 'Partially Paid';
    }

    res.json({
      success: true,
      message: `Payment of ₹${numPaid.toLocaleString('en-IN')} recorded successfully. Status updated to ${advance.status}.`,
      data: {
        ...advance,
        status: advance.status,
        paidAmount: advance.amount_paid,
        transactionRef: advance.transaction_reference
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to record advance payment.' });
  }
});

// Management: Record monthly payroll deduction / repayment for a disbursed advance
app.post('/api/admin/advances/:id/repayment', requireAuth, requireRole(['founder', 'admin']), async (req, res) => {
  try {
    const { amountRepaid, payrollMonth, remarks } = req.body;
    const rawRepaid = amountRepaid !== undefined ? amountRepaid : req.body.amount;
    const num = Number(rawRepaid);
    if (!num || isNaN(num) || num <= 0) {
      return res.status(400).json({ success: false, error: 'Please enter a valid repayment deduction amount.' });
    }
    const idx = memDb.salaryAdvances.findIndex(a => a.id === req.params.id && a.organization_id === req.user.organizationId);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Advance request not found.' });
    }
    const advance = memDb.salaryAdvances[idx];
    if (!advance.status.includes('Paid')) {
      return res.status(400).json({ success: false, error: 'Repayment deductions can only be recorded for disbursed advances.' });
    }
    const previousRepaid = advance.amount_repaid || 0;
    const newTotalRepaid = previousRepaid + num;
    advance.amount_repaid = newTotalRepaid;
    advance.repayments = advance.repayments || [];
    advance.repayments.push({
      id: `rep-${Date.now()}`,
      amount: num,
      month: payrollMonth || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      remarks: remarks || 'Authorized monthly payroll advance deduction',
      recorded_by: req.user.id,
      recorded_at: new Date().toISOString()
    });
    if (newTotalRepaid >= (advance.amount_paid || 0)) {
      advance.status = 'Settled';
    }
    advance.updated_at = new Date().toISOString();
    res.json({
      success: true,
      message: `Repayment deduction of ₹${num.toLocaleString('en-IN')} recorded successfully. Status: ${advance.status}.`,
      data: advance
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to record repayment.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Haversine distance formula (meters)
// ─────────────────────────────────────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// 404 & ERROR HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────
let server = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`\n[EMS Server v3] Multi-Organization API running on http://localhost:${PORT}`);
    console.log(`[EMS Server v3] Database: ${supabase ? 'Supabase Connected' : 'In-Memory Fallback (no Supabase credentials)'}`);
    console.log(`[EMS Server v3] Organizations: ${memDb.organizations.length} | Users: ${memDb.users.length}`);
    console.log(`\n--- DEMO CREDENTIALS (in-memory mode) ---`);
    console.log(`Admin (Acme): admin@acmetech.com / admin123 [role: admin]`);
    console.log(`Team Leader:  priya.n@acmetech.com / admin123 [role: team_leader]`);
    console.log(`Employee:     aarav.sharma@acmetech.com / admin123 [role: employee]`);
    console.log(`Admin (Nexus): admin@nexussolutions.in / admin123 [role: admin]`);
    console.log(`------------------------------------------\n`);
  });
}

module.exports = { app, server };
