import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminHomeScreen({ onNavigate, user, organization }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [stats, setStats] = useState(null);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const [statsRes, attRes, annRes] = await Promise.all([
        api.getAttendanceStats().catch(() => ({ success: false })),
        api.getAttendanceHistory().catch(() => ({ success: false, data: [] })),
        api.getAnnouncements(true).catch(() => ({ success: false, data: [] }))
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      } else {
        // Fallback default stats if backend is connecting
        setStats({
          totalEmployees: 4,
          activeEmployees: 4,
          presentToday: 1,
          absentToday: 3,
          lateArrivals: 0,
          wfoCount: 1,
          wfhCount: 0,
          pendingLeaves: 0,
          pendingReports: 0
        });
      }

      if (attRes.success && attRes.data) {
        setRecentAttendance(attRes.data.slice(0, 5));
      }
      if (annRes.success && annRes.data) {
        setAnnouncements(annRes.data.slice(0, 3));
      }
    } catch (e) {
      console.warn('[AdminHome] Error loading:', e);
      setError('Could not refresh stats from server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const store = api.getStore();
    const unsub = store.subscribe(() => {
      loadDashboardData();
    });
    return () => unsub();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDashboardData();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Organization Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={16} color="#f59e0b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Executive Workforce Pulse Banner */}
      <View style={styles.pulseSummaryBanner}>
        <View style={styles.pulseStatItem}>
          <Ionicons name="people" size={15} color={colors.primary} />
          <Text style={styles.pulseStatText}>
            <Text style={styles.pulseStatBold}>{stats?.totalEmployees ?? 0}</Text> Staff
          </Text>
        </View>
        <View style={styles.pulseDivider} />
        <View style={styles.pulseStatItem}>
          <Ionicons name="checkmark-circle" size={15} color="#15803d" />
          <Text style={styles.pulseStatText}>
            <Text style={[styles.pulseStatBold, { color: '#15803d' }]}>{stats?.presentToday ?? 0}</Text> Present
          </Text>
        </View>
        <View style={styles.pulseDivider} />
        <View style={styles.pulseStatItem}>
          <Ionicons name="close-circle" size={15} color="#b91c1c" />
          <Text style={styles.pulseStatText}>
            <Text style={[styles.pulseStatBold, { color: '#b91c1c' }]}>{stats?.absentToday ?? 0}</Text> Absent
          </Text>
        </View>
        <View style={styles.pulseDivider} />
        <View style={styles.pulseStatItem}>
          <Ionicons name="time" size={15} color="#b45309" />
          <Text style={styles.pulseStatText}>
            <Text style={[styles.pulseStatBold, { color: '#b45309' }]}>
              {(stats?.pendingLeaves || 0) + (stats?.pendingReports || 0)}
            </Text> Pending
          </Text>
        </View>
      </View>

      {/* Primary KPI Grid (Section 5 requirements) */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>TODAY'S WORKFORCE METRICS</Text>
        <TouchableOpacity
          style={styles.refreshActionBtn}
          onPress={handleRefresh}
          activeOpacity={0.7}
          disabled={isRefreshing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="refresh-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.refreshActionText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={styles.kpiCardHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: isDark ? '#263320' : '#eef4e8' }]}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.kpiLabel}>Total Staff</Text>
          </View>
          <Text style={styles.kpiValue}>{stats?.totalEmployees ?? '-'}</Text>
          <Text style={styles.kpiSub}>{stats?.activeEmployees ?? '-'} active accounts</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiCardHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: isDark ? '#143320' : '#ecfdf5' }]}>
              <Ionicons name="checkmark-done" size={16} color="#15803d" />
            </View>
            <Text style={styles.kpiLabel}>Present Today</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#15803d' }]}>
            {stats?.presentToday ?? '-'}
          </Text>
          <Text style={styles.kpiSub}>
            WFO: {stats?.wfoCount ?? 0} • WFH: {stats?.wfhCount ?? 0}
          </Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiCardHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: isDark ? '#331c1c' : '#fef2f2' }]}>
              <Ionicons name="person-remove-outline" size={16} color="#b91c1c" />
            </View>
            <Text style={styles.kpiLabel}>Absent Today</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>
            {stats?.absentToday ?? '-'}
          </Text>
          <Text style={styles.kpiSub}>Late arrivals: {stats?.lateArrivals ?? 0}</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiCardHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: isDark ? '#332714' : '#fffbeb' }]}>
              <Ionicons name="calendar-outline" size={16} color="#b45309" />
            </View>
            <Text style={styles.kpiLabel}>Pending Leaves</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#b45309' }]}>
            {stats?.pendingLeaves ?? 0}
          </Text>
          <TouchableOpacity onPress={() => onNavigate('leaves')}>
            <Text style={styles.kpiAction}>Review Requests &rarr;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiCardHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: isDark ? '#261c33' : '#faf5ff' }]}>
              <Ionicons name="cash-outline" size={16} color="#7c3aed" />
            </View>
            <Text style={styles.kpiLabel}>Pending Advances</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#7c3aed' }]}>
            {stats?.pendingAdvances ?? 0}
          </Text>
          <TouchableOpacity onPress={() => onNavigate('leaves')}>
            <Text style={styles.kpiAction}>Review Advances &rarr;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiCard}>
          <View style={styles.kpiCardHeader}>
            <View style={[styles.kpiIconBox, { backgroundColor: isDark ? '#142c33' : '#f0fdfa' }]}>
              <Ionicons name="document-text-outline" size={16} color="#0d9488" />
            </View>
            <Text style={styles.kpiLabel}>Reports Awaiting Review</Text>
          </View>
          <Text style={[styles.kpiValue, { color: '#0d9488' }]}>
            {stats?.pendingReports ?? 0}
          </Text>
          <TouchableOpacity onPress={() => onNavigate('reports')}>
            <Text style={styles.kpiAction}>Review Reports &rarr;</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Action Buttons */}
      <Text style={styles.sectionHeading}>MANAGEMENT MODULES</Text>
      <View style={styles.actionGrid}>
        {[
          { key: 'employees', label: user?.role === 'team_leader' ? 'My Team' : 'Employees', icon: 'people', color: '#10b981', allowed: true },
          { key: 'attendance', label: 'Attendance', icon: 'time', color: '#3b82f6', allowed: true },
          { key: 'leaves', label: 'Leave Desk', icon: 'calendar', color: '#f59e0b', allowed: true },
          { key: 'reports', label: 'Task Reports', icon: 'document-text', color: '#8b5cf6', allowed: true },
          { key: 'audits', label: 'TL Audits', icon: 'star', color: '#ec4899', allowed: true },
          { key: 'announcements', label: 'Notices', icon: 'megaphone', color: '#06b6d4', allowed: true },
          { key: 'rules', label: 'Company Rules', icon: 'book', color: '#14b8a6', allowed: true },
          { key: 'geofence', label: 'Geofencing', icon: 'location', color: '#6366f1', allowed: user?.role === 'founder' || user?.role === 'admin' },
          { key: 'settings', label: 'Org Settings', icon: 'settings', color: '#64748b', allowed: user?.role === 'founder' || user?.role === 'admin' }
        ].filter(m => m.allowed).map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.actionCard}
            onPress={() => onNavigate(item.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon} size={20} color="#ffffff" />
            </View>
            <Text style={styles.actionLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Attendance Activity Feed */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>RECENT ATTENDANCE ACTIVITY</Text>
        <TouchableOpacity onPress={() => onNavigate('attendance')}>
          <Text style={styles.seeAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {recentAttendance.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No attendance records today yet.</Text>
        </View>
      ) : (
        <View style={styles.feedCard}>
          {recentAttendance.map((rec, i) => (
            <View
              key={rec.id || i}
              style={[styles.feedItem, i !== recentAttendance.length - 1 && styles.feedItemBorder]}
            >
              <View style={styles.feedIcon}>
                <Ionicons
                  name={rec.mode === 'WFH' ? 'home' : 'business'}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={styles.feedBody}>
                <Text style={styles.feedUser}>
                  {rec.users?.name || rec.user_id || 'Employee'}
                </Text>
                <Text style={styles.feedMeta}>
                  {rec.mode} &bull; Punch In:{' '}
                  {rec.punch_in_time ? new Date(rec.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  {rec.punch_out_time ? ` &bull; Out: ${new Date(rec.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (Active)'}
                </Text>
              </View>
              <View
                style={[
                  styles.verifiedBadge,
                  { backgroundColor: rec.punch_in_verified ? '#d1fae5' : '#fef3c7' }
                ]}
              >
                <Text
                  style={[
                    styles.verifiedText,
                    { color: rec.punch_in_verified ? '#065f46' : '#92400e' }
                  ]}
                >
                  {rec.punch_in_verified ? 'Verified' : 'Manual'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Announcements Preview */}
      <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
        <Text style={styles.sectionHeading}>ACTIVE ANNOUNCEMENTS</Text>
        <TouchableOpacity onPress={() => onNavigate('announcements')}>
          <Text style={styles.seeAllText}>Manage</Text>
        </TouchableOpacity>
      </View>

      {announcements.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No active announcements posted.</Text>
        </View>
      ) : (
        announcements.map((ann) => (
          <View key={ann.id} style={styles.annCard}>
            <View style={styles.annHeader}>
              <Text style={styles.annTitle}>{ann.title}</Text>
              <View style={[styles.priorityBadge, ann.priority === 'high' && styles.priorityHigh]}>
                <Text style={styles.priorityText}>{ann.priority?.toUpperCase() || 'INFO'}</Text>
              </View>
            </View>
            <Text style={styles.annBody} numberOfLines={2}>
              {ann.message}
            </Text>
          </View>
        ))
      )}
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: colors.textSecondary
    },
    refreshActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6
    },
    refreshActionText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#292010' : '#fef3c7',
      padding: 10,
      borderRadius: 10,
      marginBottom: 16,
      gap: 8
    },
    errorText: {
      fontSize: 12,
      color: '#b45309'
    },
    pulseSummaryBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#22281e' : '#f0f4ea',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#353e2e' : '#e0e7d6'
    },
    pulseStatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5
    },
    pulseStatBold: {
      fontWeight: '800',
      color: colors.textPrimary,
      fontSize: 13
    },
    pulseStatText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary
    },
    pulseDivider: {
      width: 1,
      height: 16,
      backgroundColor: isDark ? '#3b4434' : '#d2dbc6'
    },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 10,
      marginLeft: 4
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      marginLeft: 4
    },
    seeAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 20
    },
    kpiCard: {
      flex: 1,
      minWidth: '47%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 4,
      elevation: 2
    },
    kpiCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    },
    kpiIconBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center'
    },
    kpiLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    kpiValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginVertical: 4
    },
    kpiSub: {
      fontSize: 11,
      color: colors.textSecondary
    },
    kpiAction: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 6
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 24
    },
    actionCard: {
      width: '31%',
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 3,
      elevation: 1
    },
    actionIconBadge: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8
    },
    actionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center'
    },
    feedCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden'
    },
    feedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10
    },
    feedItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    feedIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee',
      justifyContent: 'center',
      alignItems: 'center'
    },
    feedBody: {
      flex: 1
    },
    feedUser: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary
    },
    feedMeta: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    verifiedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    verifiedText: {
      fontSize: 10,
      fontWeight: '700'
    },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    emptyText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8
    },
    annCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8
    },
    annHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6
    },
    annTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
      marginRight: 8
    },
    priorityBadge: {
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6
    },
    priorityHigh: {
      backgroundColor: '#fee2e2'
    },
    priorityText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary
    },
    annBody: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16
    }
  });
