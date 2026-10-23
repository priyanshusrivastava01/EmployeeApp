import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import {
  mockHolidays,
  mockCoworkers,
  mockLeaveRequests,
  mockAdvanceRequests,
  mockTimesheets,
  mockAnnouncements,
  mockCompanyRules,
  mockCelebrations,
  mockNotifications
} from '../data/mockEmployeeData';

function useScreenStyles() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  return { colors, isDark, styles };
}

// Common Sub-Screen Header with Back Navigation
export function SubScreenHeader({ title, subtitle, onBack }) {
  const { colors, isDark } = useTheme();
  const headerStyles = getHeaderStyles(colors, isDark);
  return (
    <View style={headerStyles.header}>
      <TouchableOpacity style={headerStyles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={headerStyles.title}>{title}</Text>
        {subtitle && <Text style={headerStyles.subtitle}>{subtitle}</Text>}
      </View>
      <View style={headerStyles.demoBadge}>
        <Text style={headerStyles.demoBadgeText}>DEMO</Text>
      </View>
    </View>
  );
}

// Common Demo Notice Banner
export function DemoBanner({ text = 'Local session view. Data is stored in device memory and will not be sent to server.' }) {
  const { colors, isDark } = useTheme();
  const bannerStyles = getBannerStyles(colors, isDark);
  return (
    <View style={bannerStyles.banner}>
      <Ionicons name="information-circle-outline" size={16} color={colors.darkOlive} style={{ marginTop: 1 }} />
      <Text style={bannerStyles.text}>{text}</Text>
    </View>
  );
}

// 1. PUBLIC HOLIDAYS SCREEN
export function HolidaysScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  return (
    <View style={styles.container}>
      <SubScreenHeader title="Public Holidays" subtitle="Official 2026 - 2027 calendar" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Company observed holidays. Shifts are not scheduled on gazetted dates." />

        <View style={styles.highlightCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={24} color={colors.darkOlive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.highlightTitle}>Next Holiday: Diwali</Text>
            <Text style={styles.highlightSubtitle}>Sunday, Nov 01, 2026 • Festival of Lights</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Upcoming Holidays ({mockHolidays.length})</Text>
        {mockHolidays.map((hol) => (
          <View key={hol.id} style={styles.itemCard}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeDay}>{hol.date.split(' ')[1]}</Text>
              <Text style={styles.dateBadgeMonth}>{hol.date.split(' ')[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMainText}>{hol.name}</Text>
              <Text style={styles.cardSubText}>{hol.day} • {hol.type}</Text>
            </View>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 2. ADVANCE PAYMENT SCREEN
export function AdvancePaymentScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [tenure, setTenure] = useState('1 Month');
  const [requests, setRequests] = useState(mockAdvanceRequests);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = () => {
    if (!amount.trim() || isNaN(Number(amount.replace(/[^0-9]/g, '')))) {
      Alert.alert('Invalid Amount', 'Please enter a valid numeric amount.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please enter the reason for your advance request.');
      return;
    }
    const newReq = {
      id: 'adv-' + Date.now(),
      amount: `₹${Number(amount.replace(/[^0-9]/g, '')).toLocaleString('en-IN')}`,
      reason: reason.trim(),
      requestedDate: 'Today (Oct 23)',
      tenure: tenure,
      status: 'Pending HR Review'
    };
    setRequests(prev => [newReq, ...prev]);
    setAmount('');
    setReason('');
    setSuccessMsg('Advance request recorded locally. Pending backend API.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Advance Payment" subtitle="Salary advance & repayments" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Requests are saved to local state only. No real payment processing or bank transfers occur." />

        {successMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.feedbackText}>{successMsg}</Text>
          </View>
        )}

        {/* Eligibility Snapshot */}
        <View style={styles.balanceGrid}>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Max Eligible</Text>
            <Text style={styles.balanceValue}>₹25,000</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Active Balance</Text>
            <Text style={[styles.balanceValue, { color: colors.primary }]}>₹0</Text>
          </View>
        </View>

        {/* Request Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Request Salary Advance</Text>

          <Text style={styles.inputLabel}>Requested Amount (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.inputLabel}>Repayment Period</Text>
          <View style={styles.pillRow}>
            {['1 Month', '2 Months', '3 Months'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.choicePill, tenure === t && styles.choicePillActive]}
                onPress={() => setTenure(t)}
              >
                <Text style={[styles.choicePillText, tenure === t && styles.choicePillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Reason / Justification</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
            placeholder="State your reason (medical, rent, education...)"
            placeholderTextColor={colors.textSecondary}
            multiline
            value={reason}
            onChangeText={setReason}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} activeOpacity={0.8}>
            <Ionicons name="send" size={16} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Submit Advance Request</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeading}>Request History</Text>
        {requests.map(req => (
          <View key={req.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Text style={styles.cardMainText}>{req.amount}</Text>
                <Text style={[styles.statusTag, req.status === 'Approved' ? styles.tagSuccess : styles.tagPending]}>
                  {req.status}
                </Text>
              </View>
              <Text style={styles.cardSubText}>{req.reason}</Text>
              <Text style={styles.metaText}>Tenure: {req.tenure} • Requested on {req.requestedDate}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 3. CO-WORKERS DIRECTORY SCREEN
export function CoworkersScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  const filtered = mockCoworkers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.designation.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'All' || c.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Co-workers" subtitle="Company staff directory" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Colleagues currently registered in Bangalore HQ and remote hubs." />

        {/* Search & Filter */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or role..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {['All', 'Engineering', 'Operations', 'Design', 'Marketing'].map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, deptFilter === d && styles.filterChipActive]}
              onPress={() => setDeptFilter(d)}
            >
              <Text style={[styles.filterChipText, deptFilter === d && styles.filterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionHeading}>Team Members ({filtered.length})</Text>
        {filtered.map(emp => (
          <View key={emp.id} style={styles.coworkerCard}>
            <Image source={{ uri: emp.avatar }} style={styles.coworkerAvatar} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardMainText}>{emp.name}</Text>
                <Text style={[styles.statusTag, emp.status.includes('WFO') ? styles.tagSuccess : emp.status.includes('WFH') ? styles.tagPurple : styles.tagWarn]}>
                  {emp.status}
                </Text>
              </View>
              <Text style={styles.cardSubText}>{emp.designation}</Text>
              <Text style={styles.metaText}>{emp.department} • {emp.email}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 4. LEAVE APPLICATION SCREEN
export function LeaveApplicationScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [requests, setRequests] = useState(mockLeaveRequests);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = () => {
    if (!startDate.trim()) {
      Alert.alert('Start Date Required', 'Please provide a start date (e.g. Oct 28).');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for your leave application.');
      return;
    }
    const newLeave = {
      id: 'lv-' + Date.now(),
      type: leaveType,
      dates: endDate.trim() ? `${startDate.trim()} - ${endDate.trim()}` : startDate.trim(),
      days: endDate.trim() ? 2 : 1,
      reason: reason.trim(),
      status: 'Pending Approval',
      appliedOn: 'Today (Oct 23)'
    };
    setRequests(prev => [newLeave, ...prev]);
    setStartDate('');
    setEndDate('');
    setReason('');
    setSuccessMsg('Leave request submitted locally. Awaiting TL & HR sync.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Leave Application" subtitle="Apply & balance tracking" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Leave requests are held in local state for review. Backend sync in Stage 2." />

        {successMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.feedbackText}>{successMsg}</Text>
          </View>
        )}

        {/* Leave Balances */}
        <View style={styles.balanceGrid}>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Casual Leave</Text>
            <Text style={styles.balanceValue}>4 Left</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Sick Leave</Text>
            <Text style={styles.balanceValue}>5 Left</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Earned Leave</Text>
            <Text style={styles.balanceValue}>12 Left</Text>
          </View>
        </View>

        {/* Leave Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Apply for Leave</Text>

          <Text style={styles.inputLabel}>Leave Type</Text>
          <View style={styles.pillRow}>
            {['Casual Leave', 'Sick Leave', 'Earned Leave'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.choicePill, leaveType === t && styles.choicePillActive]}
                onPress={() => setLeaveType(t)}
              >
                <Text style={[styles.choicePillText, leaveType === t && styles.choicePillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Oct 28"
                placeholderTextColor={colors.textSecondary}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>End Date (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Oct 29"
                placeholderTextColor={colors.textSecondary}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Reason for Leave</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Brief reason for your absence..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={reason}
            onChangeText={setReason}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} activeOpacity={0.8}>
            <Ionicons name="calendar" size={16} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Submit Leave Application</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeading}>Recent Applications</Text>
        {requests.map(lv => (
          <View key={lv.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.cardMainText}>{lv.type}</Text>
                <Text style={[styles.statusTag, lv.status === 'Approved' ? styles.tagSuccess : styles.tagPending]}>
                  {lv.status}
                </Text>
              </View>
              <Text style={styles.cardSubText}>{lv.dates} ({lv.days} day{lv.days > 1 ? 's' : ''})</Text>
              <Text style={styles.metaText}>{lv.reason} • Applied: {lv.appliedOn}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 5. ADD TIMESHEET SCREEN
export function TimesheetScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [project, setProject] = useState('Android Mobile App');
  const [hours, setHours] = useState('8.0');
  const [activity, setActivity] = useState('');
  const [timesheets, setTimesheets] = useState(mockTimesheets);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleAdd = () => {
    if (!activity.trim()) {
      Alert.alert('Activity Required', 'Please enter a description of the work completed.');
      return;
    }
    const newEntry = {
      id: 'ts-' + Date.now(),
      date: '2026-10-23',
      project: project,
      hours: hours.trim() || '8.0',
      activity: activity.trim()
    };
    setTimesheets(prev => [newEntry, ...prev]);
    setActivity('');
    setSuccessMsg('Timesheet logged for today.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Add Timesheet" subtitle="Daily project hours & activities" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Daily work logs complement your spreadsheet task report." />

        {successMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.feedbackText}>{successMsg}</Text>
          </View>
        )}

        {/* Weekly Meter */}
        <View style={styles.highlightCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="time" size={24} color={colors.darkOlive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.highlightTitle}>This Week: 31.5 / 40.0 hrs</Text>
            <Text style={styles.highlightSubtitle}>Standard target: 8.0 hrs/day (Mon - Fri)</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Log Daily Hours</Text>

          <Text style={styles.inputLabel}>Select Project</Text>
          <View style={styles.pillRow}>
            {['Android Mobile App', 'EMS Web Dashboard', 'API Backend'].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.choicePill, project === p && styles.choicePillActive]}
                onPress={() => setProject(p)}
              >
                <Text style={[styles.choicePillText, project === p && styles.choicePillTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Hours Logged</Text>
          <TextInput
            style={styles.input}
            placeholder="8.0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={hours}
            onChangeText={setHours}
          />

          <Text style={styles.inputLabel}>Activity Summary</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Details of code commits, meetings, bug fixes..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={activity}
            onChangeText={setActivity}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={16} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Log Timesheet Entry</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeading}>Logged Entries</Text>
        {timesheets.map(t => (
          <View key={t.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.cardMainText}>{t.project}</Text>
                <Text style={[styles.statusTag, styles.tagSuccess]}>{t.hours} hrs</Text>
              </View>
              <Text style={styles.cardSubText}>{t.activity}</Text>
              <Text style={styles.metaText}>Date: {t.date}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 6. ANNOUNCEMENTS SCREEN
export function AnnouncementsScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  return (
    <View style={styles.container}>
      <SubScreenHeader title="Announcements" subtitle="Company notices & updates" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Official broadcasts issued by Founder & Operations." />
        {mockAnnouncements.map(ann => (
          <View key={ann.id} style={styles.announcementCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.priorityTag, ann.priority === 'High' ? styles.tagDanger : styles.tagInfo]}>
                {ann.priority.toUpperCase()} PRIORITY
              </Text>
              <Text style={styles.metaText}>{ann.date}</Text>
            </View>
            <Text style={styles.announcementTitle}>{ann.title}</Text>
            <Text style={styles.announcementBody}>{ann.content}</Text>
            <Text style={styles.announcementAuthor}>Posted by: {ann.author}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 7. NOTES & RULES SCREEN
export function CompanyRulesScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  return (
    <View style={styles.container}>
      <SubScreenHeader title="Notes & Rules" subtitle="Company policies & guidelines" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="EMS standards for punctuality, geofencing, and remote work integrity." />
        {mockCompanyRules.map(rule => (
          <View key={rule.id} style={styles.ruleCard}>
            <View style={styles.iconCircle}>
              <Ionicons name={rule.icon} size={22} color={colors.darkOlive} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleCategory}>{rule.category}</Text>
              <Text style={styles.ruleSummary}>{rule.summary}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 8. CELEBRATIONS SCREEN
export function CelebrationsScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [wished, setWished] = useState({});

  const handleSendWish = (id, name) => {
    setWished(prev => ({ ...prev, [id]: true }));
    Alert.alert('Wish Sent!', `Your celebration wishes have been shared with ${name}.`);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Celebrations" subtitle="Birthdays & work anniversaries" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Monthly milestones for team members in October and November." />
        {mockCelebrations.map(cel => (
          <View key={cel.id} style={styles.coworkerCard}>
            <Image source={{ uri: cel.avatar }} style={styles.coworkerAvatar} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardMainText}>{cel.name}</Text>
                <Text style={[styles.statusTag, cel.type === 'Birthday' ? styles.tagPink : styles.tagPurple]}>
                  {cel.type}
                </Text>
              </View>
              <Text style={styles.cardSubText}>{cel.note} • {cel.date}</Text>
            </View>
            <TouchableOpacity
              style={[styles.wishBtn, wished[cel.id] && styles.wishBtnDone]}
              onPress={() => handleSendWish(cel.id, cel.name)}
              disabled={wished[cel.id]}
            >
              <Ionicons name={wished[cel.id] ? 'checkmark' : 'gift-outline'} size={15} color="#ffffff" />
              <Text style={styles.wishBtnText}>{wished[cel.id] ? 'Wished' : 'Wish'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 9. NOTIFICATIONS SCREEN
export function NotificationsScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [notifications, setNotifications] = useState(mockNotifications);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Notifications" subtitle="System alerts & updates" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionHeading}>Recent Updates</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        {notifications.map(notif => (
          <View key={notif.id} style={[styles.itemCard, notif.unread && { borderColor: colors.primary }]}>
            <Ionicons
              name={notif.unread ? 'ellipse' : 'checkmark-done'}
              size={14}
              color={notif.unread ? colors.primary : colors.textSecondary}
              style={{ marginTop: 4 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMainText}>{notif.title}</Text>
              <Text style={styles.cardSubText}>{notif.text}</Text>
              <Text style={styles.metaText}>{notif.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getHeaderStyles = (colors, isDark) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary
  },
  demoBadge: {
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.darkOlive
  }
});

const getBannerStyles = (colors, isDark) => StyleSheet.create({
  banner: {
    backgroundColor: colors.lightOlive,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: colors.darkOlive,
    lineHeight: 16
  }
});

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36
  },
  highlightCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.lightOlive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  highlightSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  dateBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dateBadgeDay: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.darkOlive
  },
  dateBadgeMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  cardMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  cardSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  tagSuccess: {
    backgroundColor: colors.lightOlive,
    color: colors.darkOlive
  },
  tagPending: {
    backgroundColor: '#FAF4E8',
    color: '#C28424'
  },
  tagPurple: {
    backgroundColor: colors.lightOlive,
    color: colors.darkOlive
  },
  tagPink: {
    backgroundColor: colors.lightOlive,
    color: colors.primary
  },
  tagWarn: {
    backgroundColor: '#FBEBEB',
    color: '#C0392B'
  },
  priorityTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  tagDanger: {
    backgroundColor: '#FBEBEB',
    color: '#C0392B'
  },
  tagInfo: {
    backgroundColor: colors.lightOlive,
    color: colors.darkOlive
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  balanceBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.textSecondary
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: 8
  },
  input: {
    backgroundColor: colors.beige,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  choicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  choicePillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  choicePillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  },
  feedbackBanner: {
    backgroundColor: colors.lightOlive,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14
  },
  feedbackText: {
    color: colors.darkOlive,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: 8,
    fontSize: 13
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  coworkerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  coworkerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.beige
  },
  wishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  wishBtnDone: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  wishBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  announcementCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6
  },
  announcementBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: 8
  },
  announcementAuthor: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600'
  },
  ruleCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  ruleCategory: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  ruleSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17
  }
});
