/**
 * Sample Presentation Data for Employee Android App
 * Purely for UI demonstration prior to API/Database linkage.
 */

export const mockProfile = {
  id: 'emp-101',
  name: 'Aarav Sharma',
  role: 'employee',
  designation: 'Senior Frontend Engineer',
  department: 'Engineering',
  email: 'aarav.sharma@company.com',
  phone: '+91 98765 43210',
  teamLeader: 'Priya Nambiar (TL)',
  employeeId: 'EMP-0142',
  joinedDate: 'March 2024',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
};

export const mockAttendanceHistory = [
  {
    id: 'h-1',
    date: 'Wednesday, Oct 21, 2026',
    mode: 'WFO',
    punchIn: '09:02 AM',
    punchOut: '06:15 PM',
    totalHours: '9h 13m',
    status: 'Verified (Within 28m)',
    isVerified: true
  },
  {
    id: 'h-2',
    date: 'Tuesday, Oct 20, 2026',
    mode: 'WFO',
    punchIn: '08:58 AM',
    punchOut: '06:05 PM',
    totalHours: '9h 07m',
    status: 'Verified (Within 15m)',
    isVerified: true
  },
  {
    id: 'h-3',
    date: 'Monday, Oct 19, 2026',
    mode: 'WFH',
    punchIn: '09:15 AM',
    punchOut: '06:30 PM',
    totalHours: '9h 15m',
    status: 'Remote Session (8 pings)',
    isVerified: true
  },
  {
    id: 'h-4',
    date: 'Friday, Oct 16, 2026',
    mode: 'WFO',
    punchIn: '09:00 AM',
    punchOut: '05:55 PM',
    totalHours: '8h 55m',
    status: 'Verified (Within 42m)',
    isVerified: true
  }
];

export const mockDailyTaskSpreadsheet = {
  employeeName: 'Aarav Sharma',
  selectedMonth: 'October 2026',
  totalWorkingDays: 22,
  reports: [
    {
      id: 'task-entry-1',
      date: '2026-10-22',
      day: 'Thursday',
      projectName: 'Android Mobile App',
      tasksAssigned: 'Implement CameraView selfie capture, real GPS coordinates, and Haversine geofence verification.',
      completed: 'Yes',
      pending: 'No'
    },
    {
      id: 'task-entry-2',
      date: '2026-10-22',
      day: 'Thursday',
      projectName: 'Android Mobile App',
      tasksAssigned: 'Upgrade Daily Task Summary screen to match company Excel spreadsheet structure.',
      completed: 'Yes',
      pending: 'No'
    },
    {
      id: 'task-entry-3',
      date: '2026-10-22',
      day: 'Thursday',
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
  tlAudit: {
    auditScore: 9.5,
    remarks: 'Punctual WFO arrival (09:04 AM). Real camera capture & GPS geofence tests passed on Android.',
    auditor: 'Priya Nambiar (TL)',
    auditedAt: 'Oct 22, 2026, 06:45 PM'
  },
  status: 'Draft'
};

export const mockTasks = [
  {
    id: 't-1',
    title: 'Review PR #42 — Android Bottom Navigation',
    priority: 'High',
    status: 'In Progress',
    due: 'Today'
  },
  {
    id: 't-2',
    title: 'Optimize offline caching for attendance photos',
    priority: 'Medium',
    status: 'To Do',
    due: 'Tomorrow'
  },
  {
    id: 't-3',
    title: 'Daily Standup Sync with Priya (TL)',
    priority: 'Normal',
    status: 'Completed',
    due: '10:00 AM'
  }
];

export const mockOfficeGeofence = {
  name: 'Bangalore Technology Park — HQ Campus',
  latitude: 12.9716,
  longitude: 77.5946,
  radiusMeters: 100
};

export const mockHolidays = [
  { id: 'hol-1', name: 'Diwali (Deepavali)', date: 'Nov 01, 2026', day: 'Sunday', type: 'Public Holiday' },
  { id: 'hol-2', name: 'Guru Nanak Jayanti', date: 'Nov 15, 2026', day: 'Sunday', type: 'Gazetted Holiday' },
  { id: 'hol-3', name: 'Christmas Day', date: 'Dec 25, 2026', day: 'Friday', type: 'Public Holiday' },
  { id: 'hol-4', name: 'New Year’s Day', date: 'Jan 01, 2027', day: 'Friday', type: 'Public Holiday' },
  { id: 'hol-5', name: 'Republic Day', date: 'Jan 26, 2027', day: 'Tuesday', type: 'National Holiday' },
  { id: 'hol-6', name: 'Holi (Festival of Colours)', date: 'Mar 17, 2027', day: 'Wednesday', type: 'Public Holiday' }
];

export const mockCoworkers = [
  {
    id: 'emp-102',
    name: 'Priya Nambiar',
    email: 'priya.n@company.com',
    role: 'team_leader',
    department: 'Engineering',
    designation: 'Frontend Lead',
    phone: '+91 98234 56789',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    status: 'In Office (WFO)'
  },
  {
    id: 'emp-103',
    name: 'Karan Verma',
    email: 'karan.v@company.com',
    role: 'employee',
    department: 'Operations',
    designation: 'Logistics Coordinator',
    phone: '+91 91234 87654',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'Remote (WFH)'
  },
  {
    id: 'emp-104',
    name: 'Neha Kapoor',
    email: 'neha.k@company.com',
    role: 'team_leader',
    department: 'Operations',
    designation: 'Operations Manager',
    phone: '+91 94567 12345',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    status: 'In Office (WFO)'
  },
  {
    id: 'emp-105',
    name: 'Siddharth Sen',
    email: 'siddharth.s@company.com',
    role: 'employee',
    department: 'Design',
    designation: 'Product UI/UX Designer',
    phone: '+91 99887 66554',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'In Office (WFO)'
  },
  {
    id: 'emp-106',
    name: 'Ananya Roy',
    email: 'ananya.r@company.com',
    role: 'employee',
    department: 'Marketing',
    designation: 'Growth Associate',
    phone: '+91 97766 55443',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    status: 'On Leave'
  }
];

export const mockLeaveRequests = [
  { id: 'lv-1', type: 'Casual Leave', dates: 'Oct 28 - Oct 29, 2026', days: 2, reason: 'Family function in hometown', status: 'Pending Approval', appliedOn: 'Oct 22, 2026' },
  { id: 'lv-2', type: 'Sick Leave', dates: 'Sep 14, 2026', days: 1, reason: 'Viral fever and recovery', status: 'Approved', appliedOn: 'Sep 14, 2026' },
  { id: 'lv-3', type: 'Earned Leave', dates: 'Aug 10 - Aug 14, 2026', days: 5, reason: 'Annual scheduled vacation', status: 'Approved', appliedOn: 'Jul 28, 2026' }
];

export const mockAdvanceRequests = [
  { id: 'adv-1', amount: '₹15,000', reason: 'Emergency medical expenses for parents', requestedDate: 'Oct 10, 2026', tenure: '2 Months', status: 'Approved' },
  { id: 'adv-2', amount: '₹8,000', reason: 'Home laptop repair and accessories', requestedDate: 'Aug 04, 2026', tenure: '1 Month', status: 'Settled' }
];

export const mockTimesheets = [
  { id: 'ts-1', date: '2026-10-22', project: 'Android Mobile App', hours: '8.0', activity: 'Integrated native CameraView and high accuracy GPS geofence calculations' },
  { id: 'ts-2', date: '2026-10-21', project: 'Android Mobile App', hours: '7.5', activity: 'Fixed runtime layout bugs and strong tag ViewConfig violations' },
  { id: 'ts-3', date: '2026-10-20', project: 'EMS Web Dashboard', hours: '8.0', activity: 'Engineered 17-column spreadsheet reports with client-side CSV export' }
];

export const mockAnnouncements = [
  {
    id: 'ann-1',
    title: 'Diwali Festive Bonus & Early Office Closing',
    date: 'Oct 22, 2026',
    author: 'HR & Management',
    priority: 'High',
    content: 'Office will close at 03:00 PM on Friday, Oct 30, for Diwali celebrations. Festive bonuses will be credited with October payroll.'
  },
  {
    id: 'ann-2',
    title: 'New Biometric & GPS Attendance Guidelines',
    date: 'Oct 18, 2026',
    author: 'Operations Team',
    priority: 'Normal',
    content: 'All staff are requested to ensure live selfie camera permissions and high-accuracy GPS permissions are enabled on the new EMS Android app.'
  },
  {
    id: 'ann-3',
    title: 'Quarterly Town Hall & Product Roadmap Review',
    date: 'Oct 12, 2026',
    author: 'Rohan Deshmukh (Founder)',
    priority: 'Normal',
    content: 'Join us this Thursday at 04:30 PM in the Main Conference Room or via Google Meet for our quarterly roadmap update.'
  }
];

export const mockCompanyRules = [
  {
    id: 'rule-1',
    category: 'Work Hours & Punctuality',
    icon: 'time-outline',
    summary: 'Core working hours are 09:00 AM to 06:00 PM (Mon - Fri). A 15-minute grace period is provided for arrival before 09:15 AM.'
  },
  {
    id: 'rule-2',
    category: 'Attendance & Geofencing',
    icon: 'location-outline',
    summary: 'WFO shifts require Punch In inside the 100m office perimeter. WFH shifts must maintain active GPS location check-ins.'
  },
  {
    id: 'rule-3',
    category: 'Leave Policy',
    icon: 'calendar-outline',
    summary: 'Planned casual/earned leave must be submitted at least 48 hours in advance. Emergency sick leaves require notification by 10:00 AM.'
  },
  {
    id: 'rule-4',
    category: 'Daily Task Summaries',
    icon: 'clipboard-outline',
    summary: 'Every employee must submit their 17-column Daily Task Summary and self-evaluation before punching out at the end of their shift.'
  },
  {
    id: 'rule-5',
    category: 'Code of Conduct & Data Safety',
    icon: 'shield-checkmark-outline',
    summary: 'Company source code and client files must remain confidential. Device passwords and secure screen locks are mandatory on all work devices.'
  }
];

export const mockCelebrations = [
  { id: 'cel-1', name: 'Siddharth Sen', type: 'Birthday', date: 'Tomorrow, Oct 24', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', note: 'Turns 27!' },
  { id: 'cel-2', name: 'Priya Nambiar', type: 'Work Anniversary', date: 'Oct 29', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80', note: '2 Years with Company' },
  { id: 'cel-3', name: 'Karan Verma', type: 'Birthday', date: 'Nov 04', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', note: 'Upcoming birthday' }
];

export const mockNotifications = [
  { id: 'notif-1', title: 'Shift Verified', text: 'Your WFO arrival at 09:04 AM was verified within 35m of office geofence.', time: 'Today, 09:05 AM', unread: true },
  { id: 'notif-2', title: 'Task Review Complete', text: 'Priya Nambiar (TL) reviewed your Daily Task Summary with audit score 9.5/10.', time: 'Yesterday, 06:45 PM', unread: true },
  { id: 'notif-3', title: 'New Announcement', text: 'Diwali Festive Bonus & Early Office Closing notice has been posted.', time: 'Oct 22, 11:30 AM', unread: false }
];

