import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminAttendanceScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'WFO' | 'WFH'

  const loadAttendance = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAttendanceHistory();
      if (res.success && res.data) {
        setRecords(res.data);
      }
    } catch (e) {
      console.warn('[AdminAttendance] Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const filtered = records.filter(
    (r) => filterMode === 'ALL' || r.mode === filterMode
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Attendance Logs</Text>
          <Text style={styles.headerSubtitle}>{records.length} Recorded Shifts</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadAttendance}>
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Executive Attendance Pulse Banner */}
      <View style={styles.pulseSummaryBanner}>
        <View style={styles.pulseStatItem}>
          <Ionicons name="time" size={15} color={colors.primary} />
          <Text style={styles.pulseStatText}>
            <Text style={styles.pulseStatBold}>{records.length}</Text> Shifts
          </Text>
        </View>
        <View style={styles.pulseDivider} />
        <View style={styles.pulseStatItem}>
          <Ionicons name="business" size={15} color="#15803d" />
          <Text style={styles.pulseStatText}>
            <Text style={[styles.pulseStatBold, { color: '#15803d' }]}>
              {records.filter(r => r.mode === 'WFO').length}
            </Text> Office
          </Text>
        </View>
        <View style={styles.pulseDivider} />
        <View style={styles.pulseStatItem}>
          <Ionicons name="home" size={15} color="#b45309" />
          <Text style={styles.pulseStatText}>
            <Text style={[styles.pulseStatBold, { color: '#b45309' }]}>
              {records.filter(r => r.mode === 'WFH').length}
            </Text> Remote
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'ALL', label: 'All Shifts', count: records.length },
          { key: 'WFO', label: 'Office (WFO)', count: records.filter(r => r.mode === 'WFO').length },
          { key: 'WFH', label: 'Remote (WFH)', count: records.filter(r => r.mode === 'WFH').length }
        ].map((m) => {
          const isActive = filterMode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setFilterMode(m.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {m.label}
              </Text>
              <View style={[styles.tabCountBadge, isActive && styles.tabCountBadgeActive]}>
                <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                  {m.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching attendance logs...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Attendance Records</Text>
          <Text style={styles.emptySubtitle}>Punches submitted by employees will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const rawName = item.users?.name || item.user_id || 'Employee';
            const initials = rawName
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const isVerified = Boolean(item.punch_in_verified);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.userRow}>
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View>
                      <Text style={styles.userName}>{rawName}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.workDate}>{item.work_date}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={[styles.modePill, item.mode === 'WFH' ? styles.modePillWfh : styles.modePillWfo]}>
                          <Ionicons
                            name={item.mode === 'WFH' ? 'home' : 'business'}
                            size={10}
                            color={item.mode === 'WFH' ? '#b45309' : '#15803d'}
                          />
                          <Text style={[styles.modePillText, { color: item.mode === 'WFH' ? '#b45309' : '#15803d' }]}>
                            {item.mode}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.verifiedTag,
                      { backgroundColor: isVerified ? (isDark ? '#143320' : '#ecfdf5') : (isDark ? '#332714' : '#fffbeb') }
                    ]}
                  >
                    <Ionicons
                      name={isVerified ? 'shield-checkmark' : 'alert-circle'}
                      size={12}
                      color={isVerified ? '#15803d' : '#b45309'}
                    />
                    <Text
                      style={[
                        styles.verifiedTagText,
                        { color: isVerified ? '#15803d' : '#b45309' }
                      ]}
                    >
                      {isVerified ? 'Geofence Valid' : 'Unverified GPS'}
                    </Text>
                  </View>
                </View>

                {/* 3-Column Metrics Grid */}
                <View style={styles.punchDetailsGrid}>
                  <View style={styles.punchBox}>
                    <Text style={styles.punchBoxLabel}>PUNCH IN</Text>
                    <Text style={styles.punchBoxTime}>
                      {item.punch_in_time
                        ? new Date(item.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </Text>
                    <Text style={styles.punchBoxSub}>
                      {item.punch_in_lat ? 'GPS Logged' : 'No GPS'}
                    </Text>
                  </View>

                  <View style={styles.punchBox}>
                    <Text style={styles.punchBoxLabel}>PUNCH OUT</Text>
                    <Text style={[styles.punchBoxTime, !item.punch_out_time && { color: colors.primary }]}>
                      {item.punch_out_time
                        ? new Date(item.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active'}
                    </Text>
                    <Text style={styles.punchBoxSub}>
                      {item.punch_out_time ? 'Shift Ended' : 'In Progress'}
                    </Text>
                  </View>

                  <View style={styles.punchBox}>
                    <Text style={styles.punchBoxLabel}>DURATION</Text>
                    <Text style={[styles.punchBoxTime, { color: '#15803d' }]}>
                      {item.total_minutes ? `${Math.floor(item.total_minutes / 60)}h ${item.total_minutes % 60}m` : (item.punch_in_time ? 'Active' : '-')}
                    </Text>
                    <Text style={styles.punchBoxSub}>
                      {item.total_minutes >= 480 ? 'Full Shift' : 'Recorded'}
                    </Text>
                  </View>
                </View>

                {/* Coordinates Snippet */}
                {Boolean(item.punch_in_lat && item.punch_in_lng) && (
                  <View style={styles.coordsFooter}>
                    <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.coordsFooterText}>
                      GPS: {Number(item.punch_in_lat).toFixed(4)}, {Number(item.punch_in_lng).toFixed(4)}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backBtn: {
      padding: 6,
      marginRight: 8
    },
    headerTitleWrap: {
      flex: 1
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary
    },
    refreshBtn: {
      padding: 6
    },
    pulseSummaryBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#22281e' : '#f0f4ea',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginTop: 12,
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
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8
    },
    filterTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    filterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    filterTabText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    filterTabTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    tabCountBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 8,
      backgroundColor: isDark ? '#353e2e' : '#e2e8da'
    },
    tabCountBadgeActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)'
    },
    tabCountText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary
    },
    tabCountTextActive: {
      color: '#ffffff'
    },
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30
    },
    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.textSecondary
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center'
    },
    card: {
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
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    avatarWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#323c2c' : '#e6ede0',
      justifyContent: 'center',
      alignItems: 'center'
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary
    },
    userName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2
    },
    workDate: {
      fontSize: 11,
      color: colors.textSecondary
    },
    metaDot: {
      fontSize: 10,
      color: colors.textSecondary
    },
    modePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4
    },
    modePillWfo: {
      backgroundColor: isDark ? '#143320' : '#ecfdf5'
    },
    modePillWfh: {
      backgroundColor: isDark ? '#332714' : '#fffbeb'
    },
    modePillText: {
      fontSize: 9,
      fontWeight: '700'
    },
    verifiedTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6
    },
    verifiedTagText: {
      fontSize: 10,
      fontWeight: '700'
    },
    punchDetailsGrid: {
      flexDirection: 'row',
      gap: 8,
      backgroundColor: isDark ? '#1d221a' : '#f7faf5',
      borderRadius: 10,
      padding: 10
    },
    punchBox: {
      flex: 1,
      alignItems: 'center'
    },
    punchBoxLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    },
    punchBoxTime: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
      marginVertical: 2
    },
    punchBoxSub: {
      fontSize: 9,
      color: colors.textSecondary
    },
    coordsFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    coordsFooterText: {
      fontSize: 10,
      color: colors.textSecondary
    }
  });
