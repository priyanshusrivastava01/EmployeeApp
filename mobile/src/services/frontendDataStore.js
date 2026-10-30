/**
 * EMS Frontend Data Store & Single Source of Truth
 * 
 * Provides unified, shared in-memory and locally-persisted records
 * connecting Employee and Management screens.
 * 
 * Complies with:
 * - Part 1: Primary Objective (Single business record in frontend)
 * - Part 3 & 4: Shared Frontend Data Layer
 * - Part 5: Organization and Employee Data Isolation
 * - Part 6: Leave Application Workflow (Approve/Reject/Sync/Notifications)
 * - Part 7: Salary Advance Workflow (Approve/Reject/Separate Payment Recording)
 * - Part 8: Daily Task Reports & Carry-Forward
 * - Part 9: Attendance & Punch Lifecycle
 * - Part 13: Event-Driven Notifications
 * - Part 17: Dynamic Management Summary Cards
 * - Part 20: Frontend Persistence & Future Backend Readiness
 * - Part 21: Multi-Organization Data Isolation
 */

if (typeof window === 'undefined' && typeof global !== 'undefined' && !global.window) {
  const memoryStore = new Map();
  global.window = {
    localStorage: {
      getItem: (k) => memoryStore.get(k) || null,
      setItem: (k, v) => memoryStore.set(k, String(v)),
      removeItem: (k) => memoryStore.delete(k),
      clear: () => memoryStore.clear()
    }
  };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
const storage = AsyncStorage?.getItem ? AsyncStorage : (AsyncStorage?.default || AsyncStorage);

const STORAGE_KEY = '@ems_frontend_store_v1';

export const normalizeOrgId = (id) => {
  if (!id) return 'org-acme-1';
  if (id === 'org-demo-001' || id === 'org-acme-1') return 'org-acme-1';
  return id;
};

// Seed Organizations
export const SEED_ORGANIZATIONS = [
  {
    id: 'org-acme-1',
    name: 'Acme Technologies Pvt. Ltd.',
    company_code: 'CMP-7K4M9X2Q',
    industry: 'Information Technology & Software Services',
    office_address: 'Bangalore Technology Park — HQ Campus',
    latitude: 12.9716,
    longitude: 77.5946,
    geofence_radius: 100,
    work_start: '09:30',
    work_end: '18:30',
    grace_period_mins: 15,
    working_days: 'Mon,Tue,Wed,Thu,Fri'
  },
  {
    id: 'org-stellar-2',
    name: 'Stellar Dynamics Inc.',
    company_code: 'CMP-STELLAR-88',
    industry: 'Engineering & Automation',
    office_address: 'Whitefield Tech Zone, Bangalore',
    latitude: 12.9800,
    longitude: 77.7500,
    geofence_radius: 150,
    work_start: '09:00',
    work_end: '18:00',
    grace_period_mins: 10,
    working_days: 'Mon,Tue,Wed,Thu,Fri,Sat'
  }
];

// Seed Users
export const SEED_USERS = [
  // Org 1: Acme Technologies
  {
    id: 'user-rohan-1',
    name: 'Rohan Deshmukh',
    email: 'rohan.deshmukh@acmetech.com',
    role: 'founder',
    organization_id: 'org-acme-1',
    department: 'Management',
    designation: 'Founder & CEO',
    employee_code: 'FOUNDER-001',
    phone: '+91 98765 00001',
    monthly_salary: 250000
  },
  {
    id: 'user-ananya-2',
    name: 'Ananya Roy',
    email: 'ananya.roy@acmetech.com',
    role: 'admin',
    organization_id: 'org-acme-1',
    department: 'Operations',
    designation: 'Operations Director',
    employee_code: 'ADMIN-002',
    phone: '+91 98765 00002',
    monthly_salary: 180000
  },
  {
    id: 'user-priya-3',
    name: 'Priya Nambiar',
    email: 'priya.nambiar@acmetech.com',
    role: 'team_leader',
    organization_id: 'org-acme-1',
    department: 'Engineering',
    designation: 'Frontend Lead',
    employee_code: 'TL-003',
    phone: '+91 98234 56789',
    monthly_salary: 120000
  },
  {
    id: 'emp-101',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@company.com',
    role: 'employee',
    organization_id: 'org-acme-1',
    department: 'Engineering',
    designation: 'Senior Frontend Engineer',
    employee_code: 'EMP-0142',
    phone: '+91 98765 43210',
    team_leader_id: 'user-priya-3',
    monthly_salary: 75000
  },
  {
    id: 'emp-103',
    name: 'Karan Verma',
    email: 'karan.v@company.com',
    role: 'employee',
    organization_id: 'org-acme-1',
    department: 'Operations',
    designation: 'Logistics Coordinator',
    employee_code: 'EMP-0143',
    phone: '+91 91234 87654',
    monthly_salary: 45000
  },
  {
    id: 'emp-105',
    name: 'Siddharth Sen',
    email: 'siddharth.s@company.com',
    role: 'employee',
    organization_id: 'org-acme-1',
    department: 'Design',
    designation: 'Product UI/UX Designer',
    employee_code: 'EMP-0144',
    phone: '+91 99887 66554',
    monthly_salary: 60000
  },

  // Org 2: Stellar Dynamics
  {
    id: 'user-vikram-1',
    name: 'Vikram Seth',
    email: 'vikram@stellardynamics.com',
    role: 'founder',
    organization_id: 'org-stellar-2',
    department: 'Executive',
    designation: 'CEO',
    employee_code: 'FOUNDER-STL-1',
    phone: '+91 97777 00001',
    monthly_salary: 300000
  },
  {
    id: 'emp-201',
    name: 'Rhea Kapoor',
    email: 'rhea@stellardynamics.com',
    role: 'employee',
    organization_id: 'org-stellar-2',
    department: 'R&D',
    designation: 'Research Engineer',
    employee_code: 'STL-0021',
    phone: '+91 97777 00002',
    monthly_salary: 85000
  }
];

// Seed Leaves
export const SEED_LEAVES = [
  {
    id: 'lv-1',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    user_email: 'aarav.sharma@company.com',
    user_department: 'Engineering',
    user_designation: 'Senior Frontend Engineer',
    leave_type: 'Casual Leave',
    start_date: '28/10/2026',
    end_date: '29/10/2026',
    duration_days: 2,
    reason: 'Family function in hometown',
    status: 'pending',
    review_remarks: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-10-22T09:00:00.000Z'
  },
  {
    id: 'lv-2',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    user_email: 'aarav.sharma@company.com',
    user_department: 'Engineering',
    user_designation: 'Senior Frontend Engineer',
    leave_type: 'Sick Leave',
    start_date: '14/09/2026',
    end_date: '14/09/2026',
    duration_days: 1,
    reason: 'Viral fever and recovery',
    status: 'approved',
    review_remarks: 'Take care and rest well.',
    reviewed_by: 'Priya Nambiar (TL)',
    reviewed_at: '2026-09-14T10:30:00.000Z',
    created_at: '2026-09-14T08:15:00.000Z'
  },
  {
    id: 'lv-3',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    user_email: 'aarav.sharma@company.com',
    user_department: 'Engineering',
    user_designation: 'Senior Frontend Engineer',
    leave_type: 'Earned Leave',
    start_date: '10/08/2026',
    end_date: '14/08/2026',
    duration_days: 5,
    reason: 'Annual scheduled vacation',
    status: 'approved',
    review_remarks: 'Approved. Enjoy your vacation.',
    reviewed_by: 'Ananya Roy (ADMIN)',
    reviewed_at: '2026-07-28T16:00:00.000Z',
    created_at: '2026-07-28T09:00:00.000Z'
  },
  // Isolated Org 2 leave
  {
    id: 'lv-stellar-1',
    organization_id: 'org-stellar-2',
    user_id: 'emp-201',
    user_name: 'Rhea Kapoor',
    user_email: 'rhea@stellardynamics.com',
    user_department: 'R&D',
    user_designation: 'Research Engineer',
    leave_type: 'Casual Leave',
    start_date: '05/11/2026',
    end_date: '06/11/2026',
    duration_days: 2,
    reason: 'Personal workshop',
    status: 'pending',
    review_remarks: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-10-25T11:00:00.000Z'
  }
];

// Seed Advances
export const SEED_ADVANCES = [
  {
    id: 'adv-1',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    user_department: 'Engineering',
    amount: 15000,
    tenure: '2 Months',
    reasonCategory: 'Medical / Emergency Expenses',
    reasonDescription: 'Emergency medical expenses for parents',
    reason: 'Emergency medical expenses for parents',
    status: 'Approved', // Approved by management, but not yet disbursed/paid
    approvedAmount: 15000,
    remarks: 'Approved per medical advance policy.',
    reviewedBy: 'Rohan Deshmukh (FOUNDER)',
    reviewedAt: '2026-10-10T14:00:00.000Z',
    paymentDetails: null,
    created_at: '2026-10-10T10:00:00.000Z'
  },
  {
    id: 'adv-2',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    user_department: 'Engineering',
    amount: 8000,
    tenure: '1 Month',
    reasonCategory: 'Personal Emergency',
    reasonDescription: 'Home laptop repair and accessories',
    reason: 'Home laptop repair and accessories',
    status: 'Paid', // Explicitly paid with payment details
    approvedAmount: 8000,
    remarks: 'Approved for urgent hardware repair.',
    reviewedBy: 'Rohan Deshmukh (FOUNDER)',
    reviewedAt: '2026-08-04T12:00:00.000Z',
    paymentDetails: {
      amountPaid: 8000,
      paymentMethod: 'Bank Transfer (NEFT/IMPS)',
      transactionRef: 'NEFT-88392110',
      paymentRemarks: 'Disbursed directly to verified employee account',
      paidAt: '2026-08-05T12:00:00.000Z'
    },
    created_at: '2026-08-04T09:00:00.000Z'
  },
  // Isolated Org 2 advance
  {
    id: 'adv-stellar-1',
    organization_id: 'org-stellar-2',
    user_id: 'emp-201',
    user_name: 'Rhea Kapoor',
    user_department: 'R&D',
    amount: 20000,
    tenure: '2 Months',
    reasonCategory: 'Personal Emergency',
    reason: 'Equipment repair',
    status: 'Pending',
    approvedAmount: null,
    paymentDetails: null,
    created_at: '2026-10-20T10:00:00.000Z'
  }
];

// Seed Attendance
export const SEED_ATTENDANCE = [
  {
    id: 'att-today-1',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    work_date: new Date().toISOString().slice(0, 10),
    punch_in_time: '09:04 AM',
    punch_out_time: null,
    mode: 'WFO',
    punch_in_photo_path: 'file://local-aarav-in.jpg',
    punch_out_photo_path: null,
    punch_in_lat: 12.9716,
    punch_in_lng: 77.5946,
    punch_in_accuracy: 8,
    punch_in_verified: true,
    duration: 'In Progress',
    is_complete: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'att-hist-1',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    work_date: '2026-10-27',
    punch_in_time: '09:02 AM',
    punch_out_time: '06:15 PM',
    mode: 'WFO',
    punch_in_photo_path: 'file://local-att-1.jpg',
    punch_out_photo_path: 'file://local-att-1-out.jpg',
    punch_in_lat: 12.9716,
    punch_in_lng: 77.5946,
    punch_in_accuracy: 10,
    punch_in_verified: true,
    punch_out_verified: true,
    duration: '9h 13m',
    is_complete: true,
    created_at: '2026-10-27T03:32:00.000Z'
  },
  {
    id: 'att-hist-2',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    work_date: '2026-10-26',
    punch_in_time: '08:58 AM',
    punch_out_time: '06:05 PM',
    mode: 'WFO',
    punch_in_photo_path: 'file://local-att-2.jpg',
    punch_out_photo_path: 'file://local-att-2-out.jpg',
    punch_in_lat: 12.9716,
    punch_in_lng: 77.5946,
    punch_in_accuracy: 12,
    punch_in_verified: true,
    punch_out_verified: true,
    duration: '9h 07m',
    is_complete: true,
    created_at: '2026-10-26T03:28:00.000Z'
  }
];

// Seed Daily Reports
export const SEED_DAILY_REPORTS = [
  {
    id: 'rep-hist-1',
    organization_id: 'org-acme-1',
    user_id: 'emp-101',
    user_name: 'Aarav Sharma',
    work_date: '2026-10-27',
    day_name: 'Tuesday',
    project_name: 'Android Mobile App',
    work_summary: 'Completed camera integration and Haversine geofence verification tests.',
    tasks: [
      {
        id: 'task-entry-1',
        projectName: 'Android Mobile App',
        tasksAssigned: 'Implement CameraView selfie capture, real GPS coordinates, and Haversine geofence verification.',
        completed: 'Yes',
        pending: 'No'
      },
      {
        id: 'task-entry-2',
        projectName: 'Android Mobile App',
        tasksAssigned: 'Upgrade Daily Task Summary screen to match company Excel spreadsheet structure.',
        completed: 'Yes',
        pending: 'No'
      },
      {
        id: 'task-entry-3',
        projectName: 'EMS Web Dashboard',
        tasksAssigned: 'Review Founder spreadsheet data grid and CSV download formatting.',
        completed: 'No',
        pending: 'Yes'
      }
    ],
    ratings: {
      speed: 9,
      understanding: 9,
      problemSolving: 9,
      talkingBehaviour: 8,
      workQuality: 9,
      discipline: 10
    },
    rating_speed: 9,
    rating_understanding: 9,
    rating_problem_solving: 9,
    rating_talking_behaviour: 8,
    rating_work_quality: 9,
    rating_discipline: 10,
    rating_average_overall: '9.00',
    tasks_completed: '2 of 3',
    tasks_pending: '1 of 3',
    status: 'Submitted',
    is_submitted: true,
    is_draft: false,
    submitted_at: '2026-10-27T18:45:00.000Z',
    created_at: '2026-10-27T10:00:00.000Z'
  }
];

// Seed Announcements
export const SEED_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    organization_id: 'org-acme-1',
    title: 'Diwali Festive Bonus & Early Office Closing',
    content: 'Office will close at 03:00 PM on Friday, Oct 30, for Diwali celebrations. Festive bonuses will be credited with October payroll.',
    author: 'HR & Management',
    priority: 'High',
    published: true,
    date: 'Oct 22, 2026',
    createdAt: '2026-10-22T08:00:00.000Z'
  },
  {
    id: 'ann-2',
    organization_id: 'org-acme-1',
    title: 'New Biometric & GPS Attendance Guidelines',
    content: 'All staff are requested to ensure live selfie camera permissions and high-accuracy GPS permissions are enabled on the new EMS Android app.',
    author: 'Operations Team',
    priority: 'Normal',
    published: true,
    date: 'Oct 18, 2026',
    createdAt: '2026-10-18T09:00:00.000Z'
  }
];

// Seed Notifications
export const SEED_NOTIFICATIONS = [
  {
    id: 'notif-1',
    organization_id: 'org-acme-1',
    recipient_user_id: 'emp-101',
    title: 'Salary Advance Approved',
    text: 'Your salary advance request for ₹15,000 has been approved by Founder.',
    message: 'Your salary advance request for ₹15,000 has been approved by Founder.',
    time: '2 hours ago',
    unread: true,
    type: 'advance_approved',
    related_entity_type: 'advance',
    related_entity_id: 'adv-1',
    created_at: '2026-10-28T07:00:00.000Z'
  },
  {
    id: 'notif-2',
    organization_id: 'org-acme-1',
    recipient_user_id: 'emp-101',
    title: 'Leave Request Pending Review',
    text: 'Your Casual Leave application for Oct 28 - Oct 29 is pending Team Leader approval.',
    message: 'Your Casual Leave application for Oct 28 - Oct 29 is pending Team Leader approval.',
    time: 'Yesterday',
    unread: false,
    type: 'leave_submission',
    related_entity_type: 'leave',
    related_entity_id: 'lv-1',
    created_at: '2026-10-27T10:00:00.000Z'
  }
];

// Seed Holidays
export const SEED_HOLIDAYS = [
  { id: 'hol-1', name: 'Diwali (Deepavali)', date: 'Nov 01, 2026', holiday_date: '2026-11-01', day: 'Sunday', type: 'Public Holiday' },
  { id: 'hol-2', name: 'Guru Nanak Jayanti', date: 'Nov 15, 2026', holiday_date: '2026-11-15', day: 'Sunday', type: 'Gazetted Holiday' },
  { id: 'hol-3', name: 'Christmas Day', date: 'Dec 25, 2026', holiday_date: '2026-12-25', day: 'Friday', type: 'Public Holiday' },
  { id: 'hol-4', name: 'New Year’s Day', date: 'Jan 01, 2027', holiday_date: '2027-01-01', day: 'Friday', type: 'Public Holiday' },
  { id: 'hol-5', name: 'Republic Day', date: 'Jan 26, 2027', holiday_date: '2027-01-26', day: 'Tuesday', type: 'National Holiday' },
  { id: 'hol-6', name: 'Holi (Festival of Colours)', date: 'Mar 17, 2027', holiday_date: '2027-03-17', day: 'Wednesday', type: 'Public Holiday' }
];

// Seed Company Rules
export const SEED_RULES = [
  { id: 'rul-1', title: 'Work Hours & Punctuality', content: 'Office shift runs 09:30 AM to 06:30 PM IST with 15-minute grace period.', category: 'Attendance', published: true },
  { id: 'rul-2', title: 'Live Camera Attendance', content: 'Fresh front-camera selfie is strictly required on both Punch In and Punch Out.', category: 'Compliance', published: true },
  { id: 'rul-3', title: 'Daily Task Submission', content: 'Daily task reports must be submitted before 07:00 PM IST on working days.', category: 'Reporting', published: true }
];

class FrontendDataStore {
  constructor() {
    this.isInitialized = false;
    this.listeners = new Set();
    this.state = {
      organizations: [...SEED_ORGANIZATIONS],
      users: [...SEED_USERS],
      leaves: [...SEED_LEAVES],
      advances: [...SEED_ADVANCES],
      attendance: [...SEED_ATTENDANCE],
      dailyReports: [...SEED_DAILY_REPORTS],
      announcements: [...SEED_ANNOUNCEMENTS],
      notifications: [...SEED_NOTIFICATIONS],
      holidays: [...SEED_HOLIDAYS],
      rules: [...SEED_RULES],
      invitations: []
    };
  }

  /**
   * Initialize store: loads from AsyncStorage or seeds initial state
   */
  async init() {
    if (this.isInitialized) return this.state;
    try {
      let raw = null;
      if (typeof storage !== 'undefined' && storage.getItem) {
        raw = await storage.getItem(STORAGE_KEY).catch(() => null);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.state = {
            organizations: parsed.organizations || [...SEED_ORGANIZATIONS],
            users: parsed.users || [...SEED_USERS],
            leaves: parsed.leaves || [...SEED_LEAVES],
            advances: parsed.advances || [...SEED_ADVANCES],
            attendance: parsed.attendance || [...SEED_ATTENDANCE],
            dailyReports: parsed.dailyReports || [...SEED_DAILY_REPORTS],
            announcements: parsed.announcements || [...SEED_ANNOUNCEMENTS],
            notifications: parsed.notifications || [...SEED_NOTIFICATIONS],
            holidays: parsed.holidays || [...SEED_HOLIDAYS],
            rules: parsed.rules || [...SEED_RULES],
            invitations: parsed.invitations || []
          };
        }
      } else {
        await this.persist();
      }
    } catch (e) {
      console.warn('[FrontendDataStore] Init fallback to memory:', e?.message || e);
    }
    this.isInitialized = true;
    return this.state;
  }

  /**
   * Persist current state to AsyncStorage
   */
  async persist() {
    try {
      if (typeof storage !== 'undefined' && storage.setItem) {
        await storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn('[FrontendDataStore] Persist error:', e?.message || e);
    }
  }

  /**
   * Reset store to initial seed state (useful for test suites)
   */
  async resetToDefault() {
    this.state = {
      organizations: [...SEED_ORGANIZATIONS],
      users: [...SEED_USERS],
      leaves: [...SEED_LEAVES],
      advances: [...SEED_ADVANCES],
      attendance: [...SEED_ATTENDANCE],
      dailyReports: [...SEED_DAILY_REPORTS],
      announcements: [...SEED_ANNOUNCEMENTS],
      notifications: [...SEED_NOTIFICATIONS],
      holidays: [...SEED_HOLIDAYS],
      rules: [...SEED_RULES],
      invitations: []
    };
    await this.persist();
    this.emit('store_reset', null);
  }

  /**
   * Event subscribe/emit for reactive UI updates
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event, payload) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, payload);
      } catch (err) {
        console.warn('[FrontendDataStore] Listener error:', err);
      }
    });
  }

  notify() {
    this.emit('store_updated', this.state);
  }

  // =========================================================================
  // LEAVE APPLICATION WORKFLOW (Part 6)
  // =========================================================================

  /**
   * Get leave applications with organization and role scoping
   */
  getLeaves({ organizationId, userId, status } = {}) {
    let list = this.state.leaves;

    if (organizationId) {
      list = list.filter((l) => l.organization_id === organizationId);
    }
    if (userId) {
      list = list.filter((l) => l.user_id === userId);
    }
    if (status && status !== 'all') {
      const s = status.toLowerCase();
      list = list.filter((l) => l.status?.toLowerCase() === s);
    }

    // Sort newest first
    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  /**
   * Get leave by ID with organization verification
   */
  getLeaveById(id, organizationId = null) {
    return this.state.leaves.find(
      (l) => l.id === id && (!organizationId || l.organization_id === organizationId)
    ) || null;
  }

  /**
   * Submit new leave application
   */
  async submitLeave(payload, user, org) {
    await this.init();

    if (!payload.startDate) {
      throw new Error('Start date is required.');
    }
    if (!payload.reason || !payload.reason.trim()) {
      throw new Error('Reason for leave is required.');
    }

    const orgId = org?.id || user?.organization_id || 'org-acme-1';
    const userId = user?.id || 'emp-101';
    const userName = user?.name || 'Aarav Sharma';

    const newLeave = {
      id: `lv-${Date.now()}`,
      organization_id: orgId,
      user_id: userId,
      user_name: userName,
      user_email: user?.email || 'aarav.sharma@company.com',
      user_department: user?.department || 'Engineering',
      user_designation: user?.designation || 'Senior Frontend Engineer',
      leave_type: payload.leaveType || payload.leave_type || 'Casual Leave',
      start_date: payload.startDate || payload.start_date,
      end_date: payload.endDate || payload.end_date || payload.startDate,
      duration_days: Number(payload.durationDays || payload.duration_days) || 1,
      reason: payload.reason.trim(),
      status: 'pending',
      review_remarks: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString()
    };

    // Prepend to leaves
    this.state.leaves = [newLeave, ...this.state.leaves];

    // Create in-app notification for management
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: orgId,
      recipient_user_id: 'management',
      title: 'New Leave Application',
      text: `${userName} applied for ${newLeave.leave_type} (${newLeave.duration_days} day${newLeave.duration_days > 1 ? 's' : ''}).`,
      message: `${userName} applied for ${newLeave.leave_type} (${newLeave.duration_days} day${newLeave.duration_days > 1 ? 's' : ''}). Reason: ${newLeave.reason}`,
      time: 'Just now',
      unread: true,
      type: 'leave_submission',
      related_entity_type: 'leave',
      related_entity_id: newLeave.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('leave_created', newLeave);

    return { success: true, data: newLeave };
  }

  /**
   * Update leave status (Approve / Reject) with intentional decision safeguards
   */
  async updateLeaveStatus(leaveId, status, decisionComment, reviewerUser, org) {
    await this.init();

    const normalizedStatus = (status || '').toLowerCase();
    if (!['approved', 'rejected', 'cancelled', 'pending'].includes(normalizedStatus)) {
      throw new Error(`Invalid leave status: ${status}`);
    }

    const leaveIndex = this.state.leaves.findIndex((l) => l.id === leaveId);
    if (leaveIndex === -1) {
      throw new Error(`Leave application ${leaveId} not found.`);
    }

    const leave = this.state.leaves[leaveIndex];

    // Enforce organization isolation if org is provided
    if (org && org.id && leave.organization_id !== org.id) {
      throw new Error('Access denied: Cannot alter record belonging to another organization.');
    }

    // Role safety check: employees cannot approve their own leaves
    if (reviewerUser && reviewerUser.role === 'employee') {
      throw new Error('Permission denied: Employees cannot approve or reject leave applications.');
    }

    // Rejection reason requirement
    if (normalizedStatus === 'rejected' && (!decisionComment || !decisionComment.trim())) {
      throw new Error('Rejection reason is mandatory when rejecting a leave application.');
    }

    const reviewerName = reviewerUser?.name || 'Management';
    const reviewerRole = reviewerUser?.role ? reviewerUser.role.toUpperCase() : 'ADMIN';

    const updatedLeave = {
      ...leave,
      status: normalizedStatus,
      review_remarks: decisionComment?.trim() || (normalizedStatus === 'approved' ? 'Leave approved.' : 'Rejected.'),
      reviewed_by: `${reviewerName} (${reviewerRole})`,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.state.leaves[leaveIndex] = updatedLeave;

    // Create notification for employee
    const statusLabel = normalizedStatus === 'approved' ? 'Approved' : 'Rejected';
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: updatedLeave.organization_id,
      recipient_user_id: updatedLeave.user_id,
      title: `Leave Application ${statusLabel}`,
      text: `Your ${updatedLeave.leave_type} request for ${updatedLeave.start_date} was ${statusLabel.toLowerCase()} by ${reviewerName}.`,
      message: `Your ${updatedLeave.leave_type} request was ${statusLabel.toLowerCase()}. Remarks: ${updatedLeave.review_remarks}`,
      time: 'Just now',
      unread: true,
      type: normalizedStatus === 'approved' ? 'leave_approved' : 'leave_rejected',
      related_entity_type: 'leave',
      related_entity_id: updatedLeave.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('leave_updated', updatedLeave);

    return { success: true, data: updatedLeave };
  }

  // =========================================================================
  // SALARY ADVANCE WORKFLOW (Part 7)
  // =========================================================================

  /**
   * Get salary advances with organization and role scoping
   */
  getSalaryAdvances({ organizationId, userId, status } = {}) {
    let list = this.state.advances;

    if (organizationId) {
      list = list.filter((a) => a.organization_id === organizationId);
    }
    if (userId) {
      list = list.filter((a) => a.user_id === userId);
    }
    if (status && status !== 'all') {
      const s = status.toLowerCase();
      list = list.filter((a) => a.status?.toLowerCase().includes(s));
    }

    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  /**
   * Submit advance payment request
   */
  async submitSalaryAdvance(payload, user, org) {
    await this.init();

    const cleanAmount = Number(payload.amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Please enter a valid numeric advance amount greater than zero.');
    }
    if (cleanAmount > 100000) {
      throw new Error('Maximum single advance request limit is ₹1,00,000.');
    }

    const orgId = org?.id || user?.organization_id || 'org-acme-1';
    const userId = user?.id || 'emp-101';
    const userName = user?.name || 'Aarav Sharma';

    const reasonCategory = payload.reasonCategory || 'Medical / Emergency Expenses';
    const reasonDesc = (payload.reasonDescription || payload.reason || '').trim();

    if (reasonCategory === 'Other' && !reasonDesc) {
      throw new Error('Please provide a detailed explanation when selecting "Other" as the reason.');
    }

    const newAdvance = {
      id: `adv-${Date.now()}`,
      organization_id: orgId,
      user_id: userId,
      user_name: userName,
      user_department: user?.department || 'Engineering',
      amount: cleanAmount,
      tenure: payload.tenure || '1 Month',
      reasonCategory,
      reasonDescription: reasonDesc || reasonCategory,
      reason: reasonDesc || reasonCategory,
      status: 'Pending',
      approvedAmount: null,
      remarks: null,
      reviewedBy: null,
      reviewedAt: null,
      paymentDetails: null,
      created_at: new Date().toISOString()
    };

    this.state.advances = [newAdvance, ...this.state.advances];

    // Management notification
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: orgId,
      recipient_user_id: 'management',
      title: 'New Advance Request',
      text: `${userName} requested a salary advance of ₹${cleanAmount.toLocaleString('en-IN')}.`,
      message: `${userName} requested ₹${cleanAmount.toLocaleString('en-IN')} (${newAdvance.tenure}). Category: ${reasonCategory}`,
      time: 'Just now',
      unread: true,
      type: 'advance_submission',
      related_entity_type: 'advance',
      related_entity_id: newAdvance.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('advance_created', newAdvance);

    return { success: true, data: newAdvance };
  }

  /**
   * Approve or reject advance request (Does NOT mark as Paid)
   */
  async approveSalaryAdvance(advanceId, { status, approvedAmount, remarks }, reviewerUser, org) {
    await this.init();

    const advanceIndex = this.state.advances.findIndex((a) => a.id === advanceId);
    if (advanceIndex === -1) {
      throw new Error(`Salary advance ${advanceId} not found.`);
    }

    const advance = this.state.advances[advanceIndex];

    if (org && org.id && advance.organization_id !== org.id) {
      throw new Error('Access denied: Cannot alter record belonging to another organization.');
    }

    if (reviewerUser && reviewerUser.role === 'employee') {
      throw new Error('Permission denied: Employees cannot approve or reject advance requests.');
    }

    const normalizedStatus = status === 'Approved' || status === 'approved' ? 'Approved' : 'Rejected';
    const finalAmount = normalizedStatus === 'Approved'
      ? (Number(approvedAmount) > 0 ? Number(approvedAmount) : advance.amount)
      : null;

    const reviewerName = reviewerUser?.name || 'Management';
    const reviewerRole = reviewerUser?.role ? reviewerUser.role.toUpperCase() : 'ADMIN';

    const updatedAdvance = {
      ...advance,
      status: normalizedStatus,
      approvedAmount: finalAmount,
      remarks: remarks || (normalizedStatus === 'Approved' ? 'Approved as requested.' : 'Rejected.'),
      reviewedBy: `${reviewerName} (${reviewerRole})`,
      reviewedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.state.advances[advanceIndex] = updatedAdvance;

    // Employee notification
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: updatedAdvance.organization_id,
      recipient_user_id: updatedAdvance.user_id,
      title: `Salary Advance ${normalizedStatus}`,
      text: `Your salary advance request of ₹${advance.amount.toLocaleString('en-IN')} was ${normalizedStatus.toLowerCase()} by ${reviewerName}.`,
      message: `Advance status: ${normalizedStatus}. ${updatedAdvance.remarks || ''}`,
      time: 'Just now',
      unread: true,
      type: normalizedStatus === 'Approved' ? 'advance_approved' : 'advance_rejected',
      related_entity_type: 'advance',
      related_entity_id: updatedAdvance.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('advance_updated', updatedAdvance);

    return { success: true, data: updatedAdvance };
  }

  /**
   * Record explicit payment for an approved advance (Approved != Paid)
   */
  async recordAdvancePayment(advanceId, { amountPaid, paymentMethod, transactionRef, paymentRemarks }, reviewerUser, org) {
    await this.init();

    const advanceIndex = this.state.advances.findIndex((a) => a.id === advanceId);
    if (advanceIndex === -1) {
      throw new Error(`Salary advance ${advanceId} not found.`);
    }

    const advance = this.state.advances[advanceIndex];

    if (org && org.id && advance.organization_id !== org.id) {
      throw new Error('Access denied: Cannot alter record belonging to another organization.');
    }

    const cleanPaid = Number(amountPaid);
    if (isNaN(cleanPaid) || cleanPaid <= 0) {
      throw new Error('Please enter a valid payment amount greater than zero.');
    }

    const reviewerName = reviewerUser?.name || 'Management';

    const paymentDetails = {
      amountPaid: cleanPaid,
      paymentMethod: paymentMethod || 'Bank Transfer (NEFT/IMPS)',
      transactionRef: transactionRef || `REF-${Date.now().toString().slice(-6)}`,
      paymentRemarks: paymentRemarks || 'Payment recorded by management.',
      paidAt: new Date().toISOString(),
      recordedBy: reviewerName
    };

    const updatedAdvance = {
      ...advance,
      status: 'Paid',
      paymentDetails,
      updated_at: new Date().toISOString()
    };

    this.state.advances[advanceIndex] = updatedAdvance;

    // Employee disbursement notification
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: updatedAdvance.organization_id,
      recipient_user_id: updatedAdvance.user_id,
      title: 'Salary Advance Disbursed',
      text: `₹${cleanPaid.toLocaleString('en-IN')} has been disbursed via ${paymentDetails.paymentMethod}. Ref: ${paymentDetails.transactionRef}`,
      message: `Your advance has been paid. Payment Reference: ${paymentDetails.transactionRef}.`,
      time: 'Just now',
      unread: true,
      type: 'advance_paid',
      related_entity_type: 'advance',
      related_entity_id: updatedAdvance.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('advance_paid', updatedAdvance);

    return { success: true, data: updatedAdvance };
  }

  // =========================================================================
  // DAILY TASK REPORT WORKFLOW (Part 8)
  // =========================================================================

  /**
   * Get daily reports matching filters
   */
  getDailyReports({ organizationId, userId, date, month } = {}) {
    let list = this.state.dailyReports;

    if (organizationId) {
      list = list.filter((r) => r.organization_id === organizationId);
    }
    if (userId) {
      list = list.filter((r) => r.user_id === userId);
    }
    if (date) {
      list = list.filter((r) => r.work_date === date);
    }

    return [...list].sort((a, b) => new Date(b.work_date || 0) - new Date(a.work_date || 0));
  }

  /**
   * Get today's report with automatic carry-forward of previous pending tasks
   */
  getTodayDailyReport(user, org) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const userId = user?.id || 'emp-101';
    const orgId = org?.id || user?.organization_id || 'org-acme-1';

    // Find if report exists for today
    const existing = this.state.dailyReports.find(
      (r) => r.organization_id === orgId && r.user_id === userId && r.work_date === todayStr
    );

    if (existing) {
      return {
        success: true,
        today: todayStr,
        dayName,
        isSubmitted: existing.status === 'Submitted',
        isDraft: existing.status === 'Draft',
        report: existing,
        tasks: existing.tasks || []
      };
    }

    // Check yesterday/previous report for pending tasks to carry forward
    const userReports = this.state.dailyReports
      .filter((r) => r.organization_id === orgId && r.user_id === userId && r.work_date < todayStr)
      .sort((a, b) => new Date(b.work_date) - new Date(a.work_date));

    let carriedTasks = [];
    if (userReports.length > 0) {
      const lastReport = userReports[0];
      const pendingList = (lastReport.tasks || []).filter((t) => t.pending === 'Yes' || t.completed === 'No');
      carriedTasks = pendingList.map((t, idx) => ({
        id: `carried-${Date.now()}-${idx}`,
        projectName: t.projectName,
        tasksAssigned: t.tasksAssigned || t.taskDescription,
        completed: 'No',
        pending: 'Yes',
        isCarriedForward: true,
        carriedFromDate: lastReport.work_date,
        originalTaskId: t.id
      }));
    }

    return {
      success: true,
      today: todayStr,
      dayName,
      isSubmitted: false,
      isDraft: false,
      report: null,
      tasks: carriedTasks
    };
  }

  /**
   * Submit daily task report (Enforces same-day editing rule)
   */
  async submitDailyReport(payload, user, org) {
    await this.init();

    const todayStr = new Date().toISOString().slice(0, 10);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const targetDate = payload.date || payload.work_date || todayStr;

    // Enforce business rule: historical previous days cannot be edited by employee
    if (targetDate !== todayStr && (!user || user.role === 'employee')) {
      throw new Error(`Report for ${targetDate} is in the past and locked for editing.`);
    }

    const orgId = org?.id || user?.organization_id || 'org-acme-1';
    const userId = user?.id || 'emp-101';
    const userName = user?.name || 'Aarav Sharma';

    const ratings = payload.ratings || {
      speed: 8,
      understanding: 8,
      problemSolving: 8,
      talkingBehaviour: 8,
      workQuality: 8,
      discipline: 8
    };

    const avgOverall = (
      ((ratings.speed || 8) +
        (ratings.understanding || 8) +
        (ratings.problemSolving || 8) +
        (ratings.talkingBehaviour || 8) +
        (ratings.workQuality || 8) +
        (ratings.discipline || 8)) /
      6
    ).toFixed(2);

    const tasks = payload.tasks || [];
    const completedCount = tasks.filter((t) => t.completed === 'Yes').length;
    const pendingCount = tasks.filter((t) => t.pending === 'Yes').length;

    const reportId = payload.id || `rep-${targetDate}-${userId}`;
    const existingIndex = this.state.dailyReports.findIndex((r) => r.id === reportId || (r.work_date === targetDate && r.user_id === userId));

    const newReport = {
      id: reportId,
      organization_id: orgId,
      user_id: userId,
      user_name: userName,
      work_date: targetDate,
      day_name: payload.day || dayName,
      project_name: payload.projectName || tasks[0]?.projectName || 'General Operations',
      work_summary: payload.workSummary || `Submitted ${tasks.length} tasks (${completedCount} completed, ${pendingCount} pending).`,
      tasks,
      ratings,
      rating_speed: ratings.speed || 8,
      rating_understanding: ratings.understanding || 8,
      rating_problem_solving: ratings.problemSolving || 8,
      rating_talking_behaviour: ratings.talkingBehaviour || 8,
      rating_work_quality: ratings.workQuality || 8,
      rating_discipline: ratings.discipline || 8,
      rating_average_overall: avgOverall,
      tasks_completed: `${completedCount} of ${tasks.length}`,
      tasks_pending: `${pendingCount} of ${tasks.length}`,
      status: 'Submitted',
      is_submitted: true,
      is_draft: false,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.state.dailyReports[existingIndex] = newReport;
    } else {
      this.state.dailyReports = [newReport, ...this.state.dailyReports];
    }

    // Management notification
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: orgId,
      recipient_user_id: 'management',
      title: 'Daily Task Report Submitted',
      text: `${userName} filed daily task summary for ${targetDate} (${completedCount} completed, ${pendingCount} pending).`,
      message: `${userName} filed daily report for ${targetDate}. Score: ${avgOverall}/10.`,
      time: 'Just now',
      unread: true,
      type: 'report_submission',
      related_entity_type: 'report',
      related_entity_id: newReport.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('report_submitted', newReport);

    return { success: true, data: newReport };
  }

  /**
   * Get employee list enriched with today's task report summary for management
   */
  getEmployeesWithDailyReports({ organizationId, date } = {}) {
    const orgId = normalizeOrgId(organizationId);
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const orgUsers = (this.state.users || []).filter((u) => normalizeOrgId(u.organization_id) === orgId);

    return orgUsers.map((emp) => {
      // Find report for target date
      const rep = (this.state.dailyReports || []).find(
        (r) => normalizeOrgId(r.organization_id) === orgId && r.user_id === emp.id && r.work_date === targetDate
      );

      let totalTasks = 0;
      let completedTasks = 0;
      let pendingTasks = 0;
      let status = 'Not Submitted';
      let lastSubmissionTime = null;

      if (rep) {
        status = rep.status || (rep.is_submitted ? 'Submitted' : 'Draft');
        const tasks = rep.tasks || [];
        totalTasks = tasks.length;
        completedTasks = tasks.filter((t) => t.completed === 'Yes').length;
        pendingTasks = tasks.filter((t) => t.pending === 'Yes').length;
        lastSubmissionTime = rep.submitted_at || rep.updated_at || rep.created_at;
      } else {
        // Check if there are active carried-forward tasks for today
        const todayRes = this.getTodayDailyReport(emp, { id: orgId });
        if (todayRes && todayRes.tasks && todayRes.tasks.length > 0) {
          totalTasks = todayRes.tasks.length;
          completedTasks = todayRes.tasks.filter((t) => t.completed === 'Yes').length;
          pendingTasks = todayRes.tasks.filter((t) => t.pending === 'Yes').length;
        }
      }

      return {
        id: emp.id,
        name: emp.name,
        employee_code: emp.employee_code || emp.employeeCode || `EMP-${emp.id}`,
        email: emp.email,
        role: emp.role,
        department: emp.department || 'Operations',
        designation: emp.designation || 'Staff Member',
        phone: emp.phone,
        todayReportStatus: status,
        todayTotalTasks: totalTasks,
        todayCompletedTasks: completedTasks,
        todayPendingTasks: pendingTasks,
        lastSubmissionTime,
        todayReport: rep || null
      };
    });
  }

  /**
   * Get detailed date-wise report profile for a specific employee
   */
  getEmployeeReportProfile(employeeId, orgId = 'org-acme-1') {
    const targetOrgId = normalizeOrgId(orgId);
    const employee = (this.state.users || []).find(
      (u) => (u.id === employeeId || u.employee_code === employeeId || u.employeeCode === employeeId) &&
             normalizeOrgId(u.organization_id) === targetOrgId
    );
    if (!employee) {
      throw new Error('Employee not found in this organization.');
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // All reports for this employee, sorted descending (latest first)
    const reports = (this.state.dailyReports || [])
      .filter((r) => normalizeOrgId(r.organization_id) === targetOrgId && r.user_id === employeeId)
      .sort((a, b) => new Date(b.work_date || 0) - new Date(a.work_date || 0));

    // Calculate aggregate metrics
    const totalReportsSubmitted = reports.filter((r) => r.status === 'Submitted' || r.is_submitted).length;
    let totalTasksRecorded = 0;
    let totalCompleted = 0;
    let totalPending = 0;

    reports.forEach((r) => {
      const tList = r.tasks || [];
      totalTasksRecorded += tList.length;
      totalCompleted += tList.filter((t) => t.completed === 'Yes').length;
      totalPending += tList.filter((t) => t.pending === 'Yes').length;
    });

    // Today's live state
    const todayReport = reports.find((r) => r.work_date === todayStr);
    let todayTasks = [];
    if (todayReport) {
      todayTasks = todayReport.tasks || [];
    } else {
      const carried = this.getTodayDailyReport(employee, { id: orgId });
      todayTasks = carried.tasks || [];
    }

    return {
      employee,
      reports,
      todayStr,
      todayDayName: dayName,
      todayReport: todayReport || null,
      todayTasks,
      summary: {
        totalReportsSubmitted,
        totalTasksRecorded,
        totalCompleted,
        totalPending
      }
    };
  }

  /**
   * Management assigns a new task to an employee for today's workflow
   */
  async assignTaskFromManagement(payload, reviewerUser, org) {
    await this.init();
    const orgId = normalizeOrgId(org?.id || reviewerUser?.organization_id);
    const employeeId = payload.employeeId || payload.employee_id;
    const employee = (this.state.users || []).find(
      (u) => u.id === employeeId && normalizeOrgId(u.organization_id) === orgId
    );

    if (!employee) {
      throw new Error('Employee not found in organization.');
    }

    if (
      !reviewerUser ||
      !['founder', 'admin', 'team_leader', 'manager'].includes(
        (reviewerUser.role || '').toLowerCase()
      )
    ) {
      throw new Error('Permission denied: Only authorized management can assign tasks.');
    }

    const projectName = (payload.projectName || payload.project_name || '').trim();
    const taskDescription = (
      payload.taskDescription ||
      payload.taskTitle ||
      payload.description ||
      ''
    ).trim();
    const taskTitle = (payload.taskTitle || projectName || 'New Task').trim();

    if (!projectName) {
      throw new Error('Project name is required.');
    }
    if (!taskDescription) {
      throw new Error('Task description is required.');
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Check if report exists for today
    let reportIndex = this.state.dailyReports.findIndex(
      (r) => r.organization_id === orgId && r.user_id === employeeId && r.work_date === todayStr
    );

    let report = reportIndex >= 0 ? this.state.dailyReports[reportIndex] : null;

    if (!report) {
      // Initialize today's report
      const carried = this.getTodayDailyReport(employee, { id: orgId });
      report = {
        id: `rep-${todayStr}-${employeeId}`,
        organization_id: orgId,
        user_id: employeeId,
        user_name: employee.name,
        work_date: todayStr,
        day_name: dayName,
        project_name: projectName,
        work_summary: `Work in progress for ${todayStr}.`,
        tasks: carried.tasks || [],
        ratings: null,
        status: 'Draft',
        is_submitted: false,
        is_draft: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.state.dailyReports = [report, ...this.state.dailyReports];
      reportIndex = 0;
    }

    // Check for accidental duplicate submission
    const isDuplicate = (report.tasks || []).some(
      (t) =>
        (t.taskDescription || '').trim().toLowerCase() === taskDescription.toLowerCase() ||
        (t.tasksAssigned || '').trim().toLowerCase() === taskDescription.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error("A task with this description has already been added to today's report.");
    }

    const newTask = {
      id: `task-mgmt-${Date.now()}`,
      projectName,
      taskTitle,
      taskDescription,
      tasksAssigned: taskDescription,
      completed: 'No',
      pending: 'Yes',
      priority: payload.priority || 'Medium',
      dueTime: payload.dueTime || 'EOD',
      isManagementAssigned: true,
      assignedBy: reviewerUser.name || 'Management',
      assignedById: reviewerUser.id,
      assignedAt: new Date().toISOString(),
      date: todayStr
    };

    const updatedTasks = [...(report.tasks || []), newTask];
    const completedCount = updatedTasks.filter((t) => t.completed === 'Yes').length;
    const pendingCount = updatedTasks.filter((t) => t.pending === 'Yes').length;

    report.tasks = updatedTasks;
    report.tasks_completed = `${completedCount} of ${updatedTasks.length}`;
    report.tasks_pending = `${pendingCount} of ${updatedTasks.length}`;
    report.updated_at = new Date().toISOString();

    this.state.dailyReports[reportIndex] = { ...report };

    // In-app notification for the employee
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: orgId,
      recipient_user_id: employeeId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      text: `${reviewerUser.name || 'Management'} assigned you a new task in ${projectName}: ${taskDescription}`,
      message: `${reviewerUser.name || 'Management'} assigned you a new task in ${projectName}: ${taskDescription}`,
      projectName,
      taskTitle,
      taskId: newTask.id,
      assignedBy: reviewerUser.name || 'Management',
      time: 'Just now',
      unread: true,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('task_assigned', { task: newTask, employeeId, reportId: report.id });
    this.emit('report_updated', report);
    this.notify();

    return {
      success: true,
      task: newTask,
      report,
      message: 'Task assigned successfully to employee.'
    };
  }

  /**
   * Update individual task status (Completed / Pending) with read-only protection for past dates
   */
  async updateTaskStatus(payload, user, org) {
    await this.init();
    const { reportId, taskId, completed, pending } = payload;
    const todayStr = new Date().toISOString().slice(0, 10);

    const reportIndex = this.state.dailyReports.findIndex(
      (r) => r.id === reportId || (r.tasks || []).some((t) => t.id === taskId)
    );

    if (reportIndex < 0) {
      throw new Error('Task report not found.');
    }

    const report = this.state.dailyReports[reportIndex];

    // Read-only check for past reports
    if (report.work_date < todayStr && user?.role === 'employee') {
      throw new Error('Historical reports are read-only and cannot be updated.');
    }

    const taskIndex = (report.tasks || []).findIndex((t) => t.id === taskId);
    if (taskIndex < 0) {
      throw new Error('Task not found in report.');
    }

    const currentTask = report.tasks[taskIndex];
    const newCompleted = completed !== undefined ? completed : pending === 'Yes' ? 'No' : 'Yes';
    const newPending = pending !== undefined ? pending : completed === 'Yes' ? 'No' : 'Yes';

    const updatedTask = {
      ...currentTask,
      completed: newCompleted,
      pending: newPending,
      updated_at: new Date().toISOString()
    };

    const newTasks = [...report.tasks];
    newTasks[taskIndex] = updatedTask;

    const completedCount = newTasks.filter((t) => t.completed === 'Yes').length;
    const pendingCount = newTasks.filter((t) => t.pending === 'Yes').length;

    report.tasks = newTasks;
    report.tasks_completed = `${completedCount} of ${newTasks.length}`;
    report.tasks_pending = `${pendingCount} of ${newTasks.length}`;
    report.updated_at = new Date().toISOString();

    this.state.dailyReports[reportIndex] = { ...report };

    await this.persist();
    this.emit('task_status_updated', { task: updatedTask, reportId: report.id });
    this.emit('report_updated', report);
    this.notify();

    return {
      success: true,
      task: updatedTask,
      report
    };
  }

  /**
   * Query task reports for an authorized date range, generating rows and summaries
   */
  getTaskReportsForDateRange({ organizationId, employeeId, department, startDate, endDate } = {}) {
    const orgId = normalizeOrgId(organizationId);

    if (!startDate || !endDate) {
      throw new Error('Both start date and end date are required.');
    }

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date.');
    }

    // Filter reports in range
    let reports = (this.state.dailyReports || []).filter(
      (r) =>
        normalizeOrgId(r.organization_id) === orgId &&
        r.work_date >= startDate &&
        r.work_date <= endDate
    );

    if (employeeId && employeeId !== 'all') {
      reports = reports.filter((r) => r.user_id === employeeId);
    }

    // User lookup map
    const userMap = new Map();
    (this.state.users || []).forEach((u) => {
      userMap.set(u.id, u);
    });

    const org = (this.state.organizations || []).find((o) => o.id === orgId) || {
      name: 'Acme Technologies Pvt. Ltd.',
      company_code: 'CMP-7K4M9X2Q'
    };

    if (department && department !== 'all') {
      const deptNorm = department.trim().toLowerCase();
      reports = reports.filter((r) => {
        const u = userMap.get(r.user_id);
        const empDept = (u?.department || '').trim().toLowerCase();
        return empDept === deptNorm;
      });
    }

    // Sort newest date first
    reports.sort((a, b) => new Date(b.work_date || 0) - new Date(a.work_date || 0));

    const rows = [];
    const empAggregates = new Map();

    reports.forEach((rep) => {
      const u = userMap.get(rep.user_id) || {};
      const empName = rep.user_name || u.name || 'Staff Member';
      const empCode = u.employee_code || u.employeeCode || `EMP-${rep.user_id}`;
      const dept = u.department || 'Operations';
      const desig = u.designation || 'Staff Member';

      if (!empAggregates.has(rep.user_id)) {
        empAggregates.set(rep.user_id, {
          employeeId: rep.user_id,
          employeeCode: empCode,
          employeeName: empName,
          department: dept,
          designation: desig,
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          reportsSubmitted: 0
        });
      }
      const agg = empAggregates.get(rep.user_id);
      agg.reportsSubmitted += 1;

      const tasks =
        Array.isArray(rep.tasks) && rep.tasks.length > 0
          ? rep.tasks
          : [
              {
                id: `task-auto-${rep.id}`,
                projectName: rep.project_name || 'General Operations',
                taskTitle: rep.project_name || 'General Operations',
                taskDescription: rep.work_summary || 'Daily summary reported.',
                tasksAssigned: rep.work_summary || 'Daily summary reported.',
                completed: rep.tasks_completed?.includes('0 of') ? 'No' : 'Yes',
                pending: rep.tasks_pending?.includes('0 of') ? 'No' : 'Yes',
                isManagementAssigned: false
              }
            ];

      tasks.forEach((t, tIdx) => {
        agg.totalTasks += 1;
        if (t.completed === 'Yes') agg.completedTasks += 1;
        if (t.pending === 'Yes') agg.pendingTasks += 1;

        rows.push({
          rowId: `${rep.id}-${t.id || tIdx}`,
          companyId: org.company_code,
          companyName: org.name,
          employeeId: rep.user_id,
          employeeCode: empCode,
          employeeName: empName,
          department: dept,
          designation: desig,
          workDate: rep.work_date,
          dayName: rep.day_name || '',
          projectName: t.projectName || rep.project_name || 'General Operations',
          taskTitle: t.taskTitle || t.projectName || 'Task Entry',
          taskDescription: t.taskDescription || t.tasksAssigned || rep.work_summary || '—',
          taskOrigin: t.isManagementAssigned ? 'Management Assigned' : 'Employee Reported',
          assignedBy: t.assignedBy || 'Self',
          assignedAt: t.assignedAt || rep.created_at || '—',
          taskStatus: t.completed === 'Yes' ? 'Completed' : 'Pending',
          completed: t.completed || 'No',
          pending: t.pending || 'Yes',
          reportStatus: rep.status || 'Submitted',
          submissionTimestamp: rep.submitted_at || rep.created_at || '—',
          ratingOverall:
            rep.rating_average_overall ||
            (rep.ratings
              ? (
                  ((rep.ratings.speed || 8) +
                    (rep.ratings.understanding || 8) +
                    (rep.ratings.problemSolving || 8) +
                    (rep.ratings.talkingBehaviour || 8) +
                    (rep.ratings.workQuality || 8) +
                    (rep.ratings.discipline || 8)) /
                  6
                ).toFixed(2)
              : '—'),
          ratingSpeed: rep.rating_speed || rep.ratings?.speed || '—',
          ratingUnderstanding: rep.rating_understanding || rep.ratings?.understanding || '—',
          ratingProblemSolving: rep.rating_problem_solving || rep.ratings?.problemSolving || '—',
          ratingTalkingBehaviour: rep.rating_talking_behaviour || rep.ratings?.talkingBehaviour || '—',
          ratingWorkQuality: rep.rating_work_quality || rep.ratings?.workQuality || '—',
          ratingDiscipline: rep.rating_discipline || rep.ratings?.discipline || '—'
        });
      });
    });

    const employeeSummaries = Array.from(empAggregates.values()).map((s) => ({
      ...s,
      completionRate:
        s.totalTasks > 0 ? `${Math.round((s.completedTasks / s.totalTasks) * 100)}%` : '0%'
    }));

    return {
      success: true,
      company: org,
      startDate,
      endDate,
      totalReports: reports.length,
      totalTaskRows: rows.length,
      rows,
      employeeSummaries
    };
  }

  /**
   * Query task reports specifically isolated to an individual employee for spreadsheet viewing
   */
  getEmployeeSpreadsheetData({ organizationId, employeeId, startDate, endDate } = {}) {
    if (!employeeId) {
      throw new Error('Employee ID is required for employee spreadsheet data.');
    }
    const user = (this.state.users || []).find((u) => u.id === employeeId);
    const rangeData = this.getTaskReportsForDateRange({
      organizationId,
      employeeId,
      startDate,
      endDate
    });
    return {
      ...rangeData,
      employee: user || null
    };
  }

  // =========================================================================
  // ATTENDANCE WORKFLOW (Part 9)
  // =========================================================================

  /**
   * Get attendance records for user and organization
   */
  getAttendanceHistory({ organizationId, userId } = {}) {
    let list = this.state.attendance;

    if (organizationId) {
      list = list.filter((a) => a.organization_id === organizationId);
    }
    if (userId) {
      list = list.filter((a) => a.user_id === userId);
    }

    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  /**
   * Get today's attendance record
   */
  getTodayAttendance(user, org) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const userId = user?.id || 'emp-101';
    const orgId = org?.id || user?.organization_id || 'org-acme-1';

    const record = this.state.attendance.find(
      (a) => a.organization_id === orgId && a.user_id === userId && a.work_date === todayStr
    );

    return { success: true, data: record || null };
  }

  /**
   * Punch In
   */
  async punchIn(payload, user, org) {
    await this.init();

    const todayStr = new Date().toISOString().slice(0, 10);
    const userId = user?.id || 'emp-101';
    const orgId = org?.id || user?.organization_id || 'org-acme-1';
    const userName = user?.name || 'Aarav Sharma';

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newAttendance = {
      id: `att-${Date.now()}`,
      organization_id: orgId,
      user_id: userId,
      user_name: userName,
      work_date: todayStr,
      punch_in_time: payload.punchInTime || nowTime,
      punch_out_time: null,
      mode: payload.mode || 'WFO',
      punch_in_photo_path: payload.photoPath || 'file://punch-in.jpg',
      punch_out_photo_path: null,
      punch_in_lat: payload.latitude || 12.9716,
      punch_in_lng: payload.longitude || 77.5946,
      punch_in_accuracy: payload.accuracy || 10,
      punch_in_verified: true,
      duration: 'In Progress',
      is_complete: false,
      created_at: new Date().toISOString()
    };

    // Remove any existing incomplete today punch for this user
    this.state.attendance = [
      newAttendance,
      ...this.state.attendance.filter(
        (a) => !(a.organization_id === orgId && a.user_id === userId && a.work_date === todayStr && !a.is_complete)
      )
    ];

    await this.persist();
    this.emit('attendance_punched_in', newAttendance);

    return { success: true, data: newAttendance };
  }

  /**
   * Punch Out
   */
  async punchOut(payload, user, org) {
    await this.init();

    const todayStr = new Date().toISOString().slice(0, 10);
    const userId = user?.id || 'emp-101';
    const orgId = org?.id || user?.organization_id || 'org-acme-1';

    const outTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const index = this.state.attendance.findIndex(
      (a) => a.organization_id === orgId && a.user_id === userId && a.work_date === todayStr && !a.punch_out_time
    );

    if (index >= 0) {
      const rec = this.state.attendance[index];
      const updated = {
        ...rec,
        punch_out_time: outTime,
        punch_out_photo_path: payload.photoPath || 'file://punch-out.jpg',
        punch_out_lat: payload.latitude || 12.9716,
        punch_out_lng: payload.longitude || 77.5946,
        punch_out_accuracy: payload.accuracy || 10,
        punch_out_verified: true,
        duration: payload.duration || '8h 30m',
        is_complete: true,
        updated_at: new Date().toISOString()
      };
      this.state.attendance[index] = updated;
      await this.persist();
      this.emit('attendance_punched_out', updated);
      return { success: true, data: updated };
    }

    return { success: false, error: 'No open shift found to punch out.' };
  }

  // =========================================================================
  // DYNAMIC DASHBOARD SUMMARY METRICS (Part 17)
  // =========================================================================

  /**
   * Calculate live workforce metrics dynamically from shared records
   */
  getAttendanceStats(orgId = 'org-acme-1') {
    const todayStr = new Date().toISOString().slice(0, 10);

    const orgUsers = this.state.users.filter((u) => u.organization_id === orgId && u.role === 'employee');
    const totalStaff = orgUsers.length || 3;

    // Today's punches in this org
    const todayPunches = this.state.attendance.filter(
      (a) => a.organization_id === orgId && a.work_date === todayStr && a.punch_in_time
    );

    const presentToday = todayPunches.length;
    const absentToday = Math.max(0, totalStaff - presentToday);
    const wfoCount = todayPunches.filter((a) => a.mode === 'WFO').length;
    const wfhCount = todayPunches.filter((a) => a.mode === 'WFH').length;

    // Pending leaves for this org
    const pendingLeaves = this.state.leaves.filter(
      (l) => l.organization_id === orgId && l.status?.toLowerCase() === 'pending'
    ).length;

    // Pending advances for this org
    const pendingAdvances = this.state.advances.filter(
      (a) => a.organization_id === orgId && a.status?.toLowerCase() === 'pending'
    ).length;

    // Reports awaiting review
    const pendingReports = this.state.dailyReports.filter(
      (r) => r.organization_id === orgId && r.work_date === todayStr && r.status === 'Submitted'
    ).length;

    return {
      success: true,
      data: {
        totalEmployees: totalStaff,
        activeEmployees: totalStaff,
        presentToday,
        absentToday,
        lateArrivals: 0,
        wfoCount,
        wfhCount,
        pendingLeaves,
        pendingAdvances,
        pendingReports
      }
    };
  }

  // =========================================================================
  // NOTIFICATIONS (Part 13)
  // =========================================================================

  getNotifications({ organizationId, userId, role } = {}) {
    let list = this.state.notifications;

    if (organizationId) {
      list = list.filter((n) => n.organization_id === organizationId);
    }

    if (userId) {
      list = list.filter((n) => {
        if (n.recipient_user_id === userId) return true;
        if (n.recipient_user_id === 'all') return true;
        if (role && ['founder', 'admin', 'team_leader'].includes(role.toLowerCase()) && n.recipient_user_id === 'management') {
          return true;
        }
        return false;
      });
    }

    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  async markNotificationRead(notifId) {
    const idx = this.state.notifications.findIndex((n) => n.id === notifId);
    if (idx >= 0) {
      this.state.notifications[idx].unread = false;
      await this.persist();
      this.emit('notifications_updated', this.state.notifications);
    }
  }

  async markAllNotificationsRead(userId) {
    this.state.notifications = this.state.notifications.map((n) => {
      if (!userId || n.recipient_user_id === userId || n.recipient_user_id === 'management') {
        return { ...n, unread: false };
      }
      return n;
    });
    await this.persist();
    this.emit('notifications_updated', this.state.notifications);
  }

  // =========================================================================
  // OTHER MODULES (Part 10, 11, 12, 16)
  // =========================================================================

  getUsers({ organizationId } = {}) {
    let list = this.state.users;
    if (organizationId) {
      const orgId = normalizeOrgId(organizationId);
      list = list.filter((u) => normalizeOrgId(u.organization_id) === orgId);
    }
    return list;
  }

  getAnnouncements(organizationId = 'org-acme-1', publishedOnly = false) {
    return this.state.announcements.filter((a) => {
      if (a.organization_id !== organizationId) return false;
      if (publishedOnly && !a.published) return false;
      return true;
    });
  }

  async createAnnouncement(payload, user, org) {
    await this.init();
    const newAnn = {
      id: `ann-${Date.now()}`,
      organization_id: org?.id || 'org-acme-1',
      title: payload.title,
      content: payload.content,
      author: user?.name || 'Management',
      priority: payload.priority || 'Normal',
      published: true,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAt: new Date().toISOString()
    };
    this.state.announcements = [newAnn, ...this.state.announcements];

    // Notification for all employees
    const notif = {
      id: `notif-${Date.now()}`,
      organization_id: newAnn.organization_id,
      recipient_user_id: 'all',
      title: `Notice: ${newAnn.title}`,
      text: newAnn.content.slice(0, 80) + '...',
      message: newAnn.content,
      time: 'Just now',
      unread: true,
      type: 'announcement',
      related_entity_type: 'announcement',
      related_entity_id: newAnn.id,
      created_at: new Date().toISOString()
    };
    this.state.notifications = [notif, ...this.state.notifications];

    await this.persist();
    this.emit('announcement_created', newAnn);
    return { success: true, data: newAnn };
  }

  getRules(organizationId = 'org-acme-1') {
    return this.state.rules;
  }

  getHolidays() {
    return this.state.holidays;
  }

  getOrgSettings(organizationId = 'org-acme-1') {
    return this.state.organizations.find((o) => o.id === organizationId) || this.state.organizations[0];
  }

  async updateOrgSettings(organizationId, payload) {
    await this.init();
    const idx = this.state.organizations.findIndex((o) => o.id === organizationId);
    if (idx >= 0) {
      this.state.organizations[idx] = {
        ...this.state.organizations[idx],
        ...payload
      };
      await this.persist();
      return { success: true, data: this.state.organizations[idx] };
    }
    return { success: false, error: 'Organization not found' };
  }
}

export const frontendDataStore = new FrontendDataStore();
export default frontendDataStore;
