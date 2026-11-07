import React, { useState, useEffect } from 'react';
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
import { mockProfile, mockOfficeGeofence } from '../data/mockEmployeeData';
import { getProfilePhoto } from '../services/profilePhotoService';
import { useResponsiveLayout, getGridCardWidth, getFeatureCardColumns } from '../utils/responsive';

export default function HomeScreen({
  attendanceState,
  onNavigateToPunch,
  onNavigate,
  currentUser,
  currentOrg
}) {
  const { colors, isDark } = useTheme();
  const layout = useResponsiveLayout();
  const columns = getFeatureCardColumns(layout.width);
  const cardWidth = getGridCardWidth(layout.contentWidth, columns, 10);
  const styles = getStyles(colors, isDark, { ...layout, columns, cardWidth });
  const [profileAvatarUri, setProfileAvatarUri] = useState(null);
  const [assignedBranch, setAssignedBranch] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.getMyBranch().then(res => {
      if (isMounted && res && res.success) {
        setAssignedBranch(res);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    (async () => {
      try {
        const photo = await getProfilePhoto();
        if (photo && photo.uri) {
          setProfileAvatarUri(photo.uri);
        }
      } catch (e) {
        // non-fatal
      }
    })();
  }, []);

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

  const displayName = currentUser?.name || mockProfile.name;
  const displayDesignation = currentUser?.designation || mockProfile.designation;
  const displayDepartment = currentUser?.department || mockProfile.department;

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
                uri: profileAvatarUri || mockProfile.avatar
              }}
              style={styles.avatar}
            />
            <View style={[
              styles.onlineIndicator,
              { backgroundColor: isPunchedIn ? colors.success : (isPunchedOut ? colors.darkOlive : colors.warning) }
            ]} />
          </View>
          <View style={styles.profileTextCol}>
            <Text style={styles.greetingText} numberOfLines={1}>Welcome back,</Text>
            <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">{displayName}</Text>
            <Text style={styles.deptText} numberOfLines={1} ellipsizeMode="tail">{displayDesignation} • {displayDepartment}</Text>
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

        {/* Compact helper instruction */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>
            {isPunchedIn ? 'Tap Punch below to end your shift & punch out.' : 'Tap Punch to record attendance.'}
          </Text>
        </View>

        {/* Small secondary action navigating to Punch screen */}
        <TouchableOpacity
          style={styles.secondaryPunchActionBtn}
          onPress={() => handleNav('punch')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open Attendance Screen"
        >
          <View style={styles.secondaryPunchActionLeft}>
            <View style={styles.secondaryPunchIconWrap}>
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.secondaryPunchTitle}>
                {isPunchedIn ? 'Go to Punch (Punch Out)' : 'Go to Punch (Punch In)'}
              </Text>
              <Text style={styles.secondaryPunchSubtitle}>Camera selfie & verified location capture</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

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
          <Text style={styles.cardTitle} numberOfLines={2}>Public Holidays</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">2026 Calendar</Text>
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
          <Text style={styles.cardTitle} numberOfLines={2}>Daily Tasks</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">Task Reports</Text>
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
          <Text style={styles.cardTitle} numberOfLines={2}>Punch History</Text>
          <Text style={styles.cardSubtitle} numberOfLines={1} ellipsizeMode="tail">Verified Logs</Text>
        </TouchableOpacity>
      </View>

      {/* 6. EXTRA FEATURES SECTION (Content-Aware Adaptive Grid) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>Company Services & Tools</Text>
        <Text style={styles.sectionSubBadge}>6 Tools</Text>
      </View>

      <View style={styles.twoColumnGrid}>
        {/* 1. Advance Payment */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('advance')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="cash-outline" size={20} color={colors.warning} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle} numberOfLines={1} ellipsizeMode="tail">Advance Payment</Text>
            <Text style={styles.gridDesc} numberOfLines={1} ellipsizeMode="tail">Salary advance & history</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={{ flexShrink: 0 }} />
        </TouchableOpacity>

        {/* 2. Leave Application */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('leave')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="airplane-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle} numberOfLines={1} ellipsizeMode="tail">Leave Application</Text>
            <Text style={styles.gridDesc} numberOfLines={1} ellipsizeMode="tail">Apply & balance tracking</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={{ flexShrink: 0 }} />
        </TouchableOpacity>

        {/* 3. Announcements */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('announcements')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.warningLight }]}>
            <Ionicons name="megaphone-outline" size={20} color={colors.warning} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle} numberOfLines={1} ellipsizeMode="tail">Announcements</Text>
            <Text style={styles.gridDesc} numberOfLines={1} ellipsizeMode="tail">Official company notices</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={{ flexShrink: 0 }} />
        </TouchableOpacity>

        {/* 4. Notes / Rules */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('rules')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle} numberOfLines={1} ellipsizeMode="tail">Notes / Rules</Text>
            <Text style={styles.gridDesc} numberOfLines={1} ellipsizeMode="tail">Work policies & conduct</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={{ flexShrink: 0 }} />
        </TouchableOpacity>

        {/* 5. Celebrations */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('celebrations')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="gift-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle} numberOfLines={1} ellipsizeMode="tail">Celebrations</Text>
            <Text style={styles.gridDesc} numberOfLines={1} ellipsizeMode="tail">Birthdays & milestones</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={{ flexShrink: 0 }} />
        </TouchableOpacity>

        {/* 6. Co-workers */}
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => handleNav('coworkers')}
          activeOpacity={0.8}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: colors.lightOlive }]}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.gridTextWrap}>
            <Text style={styles.gridTitle} numberOfLines={1} ellipsizeMode="tail">Co-workers</Text>
            <Text style={styles.gridDesc} numberOfLines={1} ellipsizeMode="tail">Staff contact directory</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.borderStrong} style={{ flexShrink: 0 }} />
        </TouchableOpacity>
      </View>

      {/* 7. OFFICE GEOFENCE SNIPPET (Transparency Info) */}
      <View style={styles.geofenceCard}>
        <View style={styles.geofenceIconWrap}>
          <Ionicons
            name={assignedBranch?.workMode === 'WFH' ? 'home' : 'navigate-circle'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.geofenceTitle}>Registered Work Base</Text>
          <Text style={styles.geofenceName}>
            {assignedBranch?.workMode === 'WFH'
              ? 'Remote / Work From Home'
              : (assignedBranch?.branch?.name || currentUser?.branch_name || currentUser?.branchName || currentOrg?.name || 'Headquarters')}
          </Text>
          <Text style={styles.geofenceMeta}>
            {assignedBranch?.workMode === 'WFH'
              ? 'Authorized for remote shift check-in • No office perimeter enforced'
              : `${assignedBranch?.branch?.address || currentOrg?.address || (currentOrg?.city ? `${currentOrg.city}, India` : 'Headquarters')} • Radius: ${assignedBranch?.branch?.radius_meters || currentOrg?.office_radius_meters || 150}m perimeter`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors, isDark, layout = {}) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      paddingHorizontal: layout?.screenPadding || 16,
      paddingTop: 8,
      paddingBottom: 110,
      maxWidth: layout?.isTablet ? 840 : '100%',
      alignSelf: 'center',
      width: '100%'
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      minHeight: 52,
    },
    profileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
      marginRight: 10,
    },
    avatarWrapper: {
      position: 'relative',
      flexShrink: 0,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.beige,
    },
    onlineIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      position: 'absolute',
      bottom: 0,
      right: 0,
      borderWidth: 2,
      borderColor: colors.card,
    },
    profileTextCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    greetingText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 1,
    },
    nameText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    deptText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    },
    iconBtn: {
      width: 38,
      height: 38,
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
    secondaryPunchActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(163, 184, 121, 0.08)' : colors.lightOlive,
      borderWidth: 1,
      borderColor: isDark ? colors.borderStrong : colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 2
    },
    secondaryPunchActionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      marginRight: 8
    },
    secondaryPunchIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    secondaryPunchTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    secondaryPunchSubtitle: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1
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
      gap: layout?.isVerySmallMobile ? 6 : layout?.isNarrowMobile ? 8 : 10,
      marginBottom: 20
    },
    attendanceCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: layout?.isVerySmallMobile ? 8 : 10,
      paddingHorizontal: layout?.isVerySmallMobile ? 4 : 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.15 : 0.02,
      shadowRadius: 4,
      elevation: 1,
      minWidth: 0
    },
    cardIconBox: {
      width: layout?.isVerySmallMobile ? 32 : layout?.isNarrowMobile ? 36 : 40,
      height: layout?.isVerySmallMobile ? 32 : layout?.isNarrowMobile ? 36 : 40,
      borderRadius: 10,
      backgroundColor: colors.lightOlive,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6
    },
    cardTitle: {
      fontSize: layout?.isVerySmallMobile ? 9.5 : layout?.isNarrowMobile ? 10.5 : 11,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      lineHeight: layout?.isVerySmallMobile ? 13 : layout?.isNarrowMobile ? 14 : 15
    },
    cardSubtitle: {
      fontSize: layout?.isVerySmallMobile ? 8 : layout?.isNarrowMobile ? 8.5 : 9,
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
      width: layout?.cardWidth || (layout?.isNarrowMobile ? '100%' : '48.5%'),
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: layout?.columns === 1 ? 12 : 10,
      paddingHorizontal: layout?.columns === 1 ? 14 : 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      gap: layout?.columns === 1 ? 12 : 8,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.15 : 0.02,
      shadowRadius: 4,
      elevation: 1,
      minHeight: layout?.columns === 1 ? 58 : 54
    },
    gridIconCircle: {
      width: layout?.columns === 1 ? 38 : 34,
      height: layout?.columns === 1 ? 38 : 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    },
    gridTextWrap: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center'
    },
    gridTitle: {
      fontSize: layout?.columns === 1 ? 13 : 12,
      fontWeight: '700',
      color: colors.textPrimary || colors.text,
      letterSpacing: -0.1
    },
    gridDesc: {
      fontSize: layout?.columns === 1 ? 11 : 10,
      color: colors.textSecondary,
      marginTop: 2
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
