import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { mockProfile, mockOfficeGeofence, mockDailyTaskSpreadsheet } from '../data/mockEmployeeData';

export default function HomeScreen({
  attendanceState,
  onNavigateToPunch,
  onNavigate
}) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const isPunchedIn = attendanceState.isPunchedIn;
  const isPunchedOut = attendanceState.isPunchedOut;

  // Safe navigation helper supporting both legacy onNavigateToPunch and multi-screen onNavigate
  const handleNav = (targetKey) => {
    if (onNavigate) {
      onNavigate(targetKey);
    } else if (targetKey === 'punch' && onNavigateToPunch) {
      onNavigateToPunch();
    }
  };

  // Compact task preview metrics from mock data
  const totalTasks = mockDailyTaskSpreadsheet.reports.length;
  const completedTasks = mockDailyTaskSpreadsheet.reports.filter(t => t.completed === 'Yes').length;
  const pendingTasks = totalTasks - completedTasks;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate self-rating average
  const r = mockDailyTaskSpreadsheet.ratings;
  const ratingAvg = ((r.speed + r.understanding + r.problemSolving + r.talkingBehaviour + r.workQuality + r.discipline) / 6).toFixed(1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* 1. TOP HEADER BAR: Profile, Name, Dept, Notifications & Settings */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profileMetaRow}
          onPress={() => handleNav('profile')}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrapper}>
            <Image
              source={{
                uri: (isPunchedIn && attendanceState.punchInPhotoUri)
                  ? attendanceState.punchInPhotoUri
                  : mockProfile.avatar
              }}
              style={styles.avatar}
            />
            <View style={[
              styles.onlineIndicator,
              { backgroundColor: isPunchedIn ? colors.success : (isPunchedOut ? colors.darkOlive : colors.warning) }
            ]} />
          </View>
          <View style={styles.profileTextCol}>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.nameText}>{mockProfile.name}</Text>
            <Text style={styles.deptText}>{mockProfile.designation} • {mockProfile.department}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleNav('notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>2</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => handleNav('profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. DAILY MOTIVATIONAL MESSAGE CARD */}
      <View style={styles.motivationCard}>
        <View style={styles.motivationIconWrap}>
          <Ionicons name="sparkles" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.motivationTitle}>Daily Focus</Text>
          <Text style={styles.motivationQuote}>
            "Small daily disciplines compound into remarkable achievements. Have a productive shift!"
          </Text>
        </View>
      </View>

      {/* 3. PRIMARY ATTENDANCE MONITOR (Canonical shortcut to Punch screen) */}
      <View style={[
        styles.statusCard,
        isPunchedIn ? styles.statusCardActive : (isPunchedOut ? styles.statusCardCompleted : styles.statusCardInactive)
      ]}>
        <View style={styles.statusHeader}>
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isPunchedIn ? colors.success : (isPunchedOut ? colors.primary : colors.warning) }
            ]} />
            <Text style={styles.statusBadgeText}>
              {isPunchedIn
                ? 'WORKING • ACTIVE SHIFT IN PROGRESS'
                : (isPunchedOut ? 'SHIFT COMPLETED TODAY' : 'NOT PUNCHED IN TODAY')}
            </Text>
          </View>
          <View style={styles.modePill}>
            <Ionicons
              name={attendanceState.mode === 'WFO' ? 'business' : 'home'}
              size={12}
              color={colors.primary}
            />
            <Text style={styles.modePillText}>{attendanceState.mode}</Text>
          </View>
        </View>

        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>
            {isPunchedIn
              ? 'Shift Started At'
              : (isPunchedOut ? 'Shift Completed At' : 'Scheduled Shift Timing')}
          </Text>
          <Text style={styles.timeValue}>
            {isPunchedIn
              ? attendanceState.punchInTime
              : (isPunchedOut ? (attendanceState.lastPunchOutTime || 'Earlier Today') : '09:00 AM — 06:00 PM')}
          </Text>
        </View>

        {isPunchedIn && (
          <View style={styles.locationSnippet}>
            <Ionicons name="location-sharp" size={14} color={colors.primary} />
            <Text style={styles.locationSnippetText}>
              {attendanceState.punchInGeofence?.statusLabel || (
                attendanceState.mode === 'WFO'
                  ? 'Real GPS verification complete (Office HQ)'
                  : 'WFH remote coordinates recorded'
              )}
            </Text>
          </View>
        )}

        {isPunchedOut && (
          <View style={styles.locationSnippet}>
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
            <Text style={styles.locationSnippetText}>
              Punch Out logged with selfie proof & verified shift duration.
            </Text>
          </View>
        )}

        {/* Single canonical attendance action navigating to Punch screen */}
        <TouchableOpacity
          style={[
            styles.punchActionBtn,
            { backgroundColor: isPunchedIn ? colors.danger : (isPunchedOut ? colors.darkOlive : colors.primary) }
          ]}
          onPress={() => handleNav('punch')}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isPunchedIn ? 'exit-outline' : (isPunchedOut ? 'checkmark-done-circle-outline' : 'finger-print')}
            size={20}
            color="#ffffff"
          />
          <Text style={styles.punchActionBtnText}>
            {isPunchedIn
              ? 'Punch Out / End Shift'
              : (isPunchedOut ? 'Shift Logged • Review Punch Status' : 'Punch In with Camera & GPS')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. COMPACT DAILY TASK SUMMARY PREVIEW (Direct shortcut to Task tab) */}
      <TouchableOpacity
        style={styles.taskPreviewCard}
        onPress={() => handleNav('tasks')}
        activeOpacity={0.88}
      >
        <View style={styles.taskPreviewHeaderRow}>
          <View style={styles.taskPreviewTitleGroup}>
            <View style={styles.taskIconCircle}>
              <Ionicons name="grid-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.taskPreviewHeading}>Daily Task Summary</Text>
              <Text style={styles.taskPreviewSubheading}>Today • Oct 22 (Thursday)</Text>
            </View>
          </View>
          <View style={styles.taskStatusBadge}>
            <Text style={styles.taskStatusBadgeText}>{mockDailyTaskSpreadsheet.status}</Text>
          </View>
        </View>

        {/* Task Metric Pills */}
        <View style={styles.taskMetricsRow}>
          <View style={styles.taskMetricItem}>
            <Text style={styles.taskMetricValue}>{totalTasks}</Text>
            <Text style={styles.taskMetricLabel}>Assigned</Text>
          </View>
          <View style={styles.taskMetricDivider} />
          <View style={styles.taskMetricItem}>
            <Text style={[styles.taskMetricValue, { color: colors.primary }]}>{completedTasks}</Text>
            <Text style={styles.taskMetricLabel}>Completed</Text>
          </View>
          <View style={styles.taskMetricDivider} />
          <View style={styles.taskMetricItem}>
            <Text style={[styles.taskMetricValue, { color: colors.warning }]}>{pendingTasks}</Text>
            <Text style={styles.taskMetricLabel}>Pending</Text>
          </View>
          <View style={styles.taskMetricDivider} />
          <View style={styles.taskMetricItem}>
            <View style={styles.ratingValRow}>
              <Ionicons name="star" size={12} color={colors.primary} />
              <Text style={styles.taskMetricValue}>{ratingAvg}</Text>
            </View>
            <Text style={styles.taskMetricLabel}>Avg Rating</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${completionPercent}%` }]} />
        </View>

        {/* Shortcut Action Banner navigating directly to Task screen */}
        <View style={styles.taskShortcutBtn}>
          <Text style={styles.taskShortcutBtnText}>Open Daily Task Sheet ({completionPercent}% Done)</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {/* 5. ATTENDANCE & SHIFTS SECTION (Complementary 3-Card Row) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>Attendance & Logs</Text>
        <Text style={styles.sectionSubBadge}>Core</Text>
      </View>

      <View style={styles.attendanceRow}>
        {/* Card 1: Public Holidays */}
        <TouchableOpacity
          style={styles.attendanceCard}
          onPress={() => handleNav('holidays')}
          activeOpacity={0.8}
        >
          <View style={styles.cardIconBox}>
            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Public Holidays</Text>
          <Text style={styles.cardSubtitle}>2026 Calendar</Text>
        </TouchableOpacity>

        {/* Card 2: Daily Task Spreadsheet */}
        <TouchableOpacity
          style={styles.attendanceCard}
          onPress={() => handleNav('tasks')}
          activeOpacity={0.8}
        >
          <View style={styles.cardIconBox}>
            <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Daily Tasks</Text>
          <Text style={styles.cardSubtitle}>{totalTasks} Rows Logged</Text>
        </TouchableOpacity>

        {/* Card 3: View Punch In-Out History */}
        <TouchableOpacity
          style={styles.attendanceCard}
          onPress={() => handleNav('history')}
          activeOpacity={0.8}
        >
          <View style={styles.cardIconBox}>
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Punch History</Text>
          <Text style={styles.cardSubtitle}>Verified Logs</Text>
        </TouchableOpacity>
      </View>

      {/* 6. EXTRA FEATURES SECTION (2-Column Grid for Services & Tools) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>Company Services & Tools</Text>
        <Text style={styles.sectionSubBadge}>7 Tools</Text>
      </View>

      <View style={styles.twoColumnGrid}>
        {/* Advance Payment */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('advance')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="cash-outline" size={20} color={colors.warning} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Advance Payment</Text>
            <Text style={styles.gridDesc}>Salary advance & history</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>

        {/* Co-workers */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('coworkers')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Co-workers</Text>
            <Text style={styles.gridDesc}>Staff contact directory</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>

        {/* Leave Application */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('leave')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="airplane-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Leave Application</Text>
            <Text style={styles.gridDesc}>Apply & balance tracking</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>

        {/* Add Timesheet */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('timesheet')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="timer-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Add Timesheet</Text>
            <Text style={styles.gridDesc}>Daily project hours log</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>

        {/* Announcements */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('announcements')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="megaphone-outline" size={20} color={colors.warning} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Announcements</Text>
            <Text style={styles.gridDesc}>Official company notices</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>

        {/* Notes / Rules */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('rules')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Notes / Rules</Text>
            <Text style={styles.gridDesc}>Work policies & conduct</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>

        {/* Celebrations */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('celebrations')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="gift-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle}>Celebrations</Text>
            <Text style={styles.gridDesc}>Birthdays & milestones</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} />
        </TouchableOpacity>
      </View>

      {/* 7. OFFICE GEOFENCE SNIPPET (Transparency Info) */}
      <View style={styles.geofenceCard}>
        <View style={styles.geofenceIconWrap}>
          <Ionicons name="navigate-circle" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.geofenceTitle}>Registered Work Base</Text>
          <Text style={styles.geofenceName}>{mockOfficeGeofence.name}</Text>
          <Text style={styles.geofenceMeta}>
            Radius: {mockOfficeGeofence.radiusMeters}m perimeter • Verified on server
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      padding: 16,
      paddingBottom: 40
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16
    },
    profileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1
    },
    avatarWrapper: {
      position: 'relative'
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.primary
    },
    onlineIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      position: 'absolute',
      bottom: 0,
      right: 0,
      borderWidth: 2,
      borderColor: colors.card
    },
    profileTextCol: {
      flex: 1
    },
    greetingText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    nameText: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text
    },
    deptText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    },
    unreadBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: colors.primary,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center'
    },
    unreadBadgeText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: '800'
    },
    motivationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.beige,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16
    },
    motivationIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.lightOlive,
      alignItems: 'center',
      justifyContent: 'center'
    },
    motivationTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary
    },
    motivationQuote: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
      marginTop: 2
    },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 8,
      elevation: 2
    },
    statusCardActive: {
      borderColor: colors.primary
    },
    statusCardCompleted: {
      borderColor: colors.borderStrong
    },
    statusCardInactive: {
      borderColor: colors.border
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5
    },
    modePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.lightOlive,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10
    },
    modePillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary
    },
    timeSection: {
      marginBottom: 12
    },
    timeLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    timeValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginTop: 2
    },
    locationSnippet: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.beige,
      padding: 10,
      borderRadius: 10,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    locationSnippetText: {
      fontSize: 11,
      color: colors.text,
      fontWeight: '600',
      flex: 1
    },
    punchActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3
    },
    punchActionBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800'
    },
    // Compact Daily Task Summary Preview
    taskPreviewCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 6,
      elevation: 2
    },
    taskPreviewHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    },
    taskPreviewTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    taskIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.lightOlive,
      alignItems: 'center',
      justifyContent: 'center'
    },
    taskPreviewHeading: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text
    },
    taskPreviewSubheading: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1
    },
    taskStatusBadge: {
      backgroundColor: colors.lightOlive,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8
    },
    taskStatusBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary
    },
    taskMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.beige,
      padding: 10,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border
    },
    taskMetricItem: {
      flex: 1,
      alignItems: 'center'
    },
    taskMetricValue: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text
    },
    ratingValRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3
    },
    taskMetricLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2
    },
    taskMetricDivider: {
      width: 1,
      height: 20,
      backgroundColor: colors.border
    },
    progressBarTrack: {
      height: 5,
      backgroundColor: colors.beige,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 12
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3
    },
    taskShortcutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.beige,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border
    },
    taskShortcutBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    },
    sectionHeading: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5
    },
    sectionSubBadge: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      backgroundColor: colors.beige,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8
    },
    attendanceRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20
    },
    attendanceCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.15 : 0.02,
      shadowRadius: 4,
      elevation: 1
    },
    cardIconBox: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.lightOlive,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8
    },
    cardTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center'
    },
    cardSubtitle: {
      fontSize: 9,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center'
    },
    twoColumnGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16
    },
    gridCard: {
      width: '48.5%',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.15 : 0.02,
      shadowRadius: 4,
      elevation: 1
    },
    gridIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center'
    },
    gridTextWrap: {
      flex: 1
    },
    gridTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text
    },
    gridDesc: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1
    },
    geofenceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.beige,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4
    },
    geofenceIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.lightOlive,
      alignItems: 'center',
      justifyContent: 'center'
    },
    geofenceTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase'
    },
    geofenceName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginTop: 1
    },
    geofenceMeta: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    }
  });
