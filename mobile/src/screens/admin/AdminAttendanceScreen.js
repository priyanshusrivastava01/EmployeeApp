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

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['ALL', 'WFO', 'WFH'].map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.filterTab, filterMode === m && styles.filterTabActive]}
            onPress={() => setFilterMode(m)}
          >
            <Text style={[styles.filterTabText, filterMode === m && styles.filterTabTextActive]}>
              {m === 'ALL' ? 'All Shifts' : m === 'WFO' ? 'Office (WFO)' : 'Remote (WFH)'}
            </Text>
          </TouchableOpacity>
        ))}
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
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.userRow}>
                  <View style={styles.modeIcon}>
                    <Ionicons
                      name={item.mode === 'WFH' ? 'home' : 'business'}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <View>
                    <Text style={styles.userName}>
                      {item.users?.name || item.user_id || 'Employee'}
                    </Text>
                    <Text style={styles.workDate}>{item.work_date}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.verifiedTag,
                    { backgroundColor: item.punch_in_verified ? '#d1fae5' : '#fef3c7' }
                  ]}
                >
                  <Ionicons
                    name={item.punch_in_verified ? 'shield-checkmark' : 'alert-circle'}
                    size={12}
                    color={item.punch_in_verified ? '#065f46' : '#92400e'}
                  />
                  <Text
                    style={[
                      styles.verifiedTagText,
                      { color: item.punch_in_verified ? '#065f46' : '#92400e' }
                    ]}
                  >
                    {item.punch_in_verified ? 'Geofence Valid' : 'Unverified GPS'}
                  </Text>
                </View>
              </View>

              <View style={styles.punchDetailsGrid}>
                <View style={styles.punchBox}>
                  <Text style={styles.punchBoxLabel}>PUNCH IN</Text>
                  <Text style={styles.punchBoxTime}>
                    {item.punch_in_time
                      ? new Date(item.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '-'}
                  </Text>
                  <Text style={styles.punchBoxCoords}>
                    {item.punch_in_lat ? `${item.punch_in_lat.toFixed(4)}, ${item.punch_in_lng.toFixed(4)}` : 'No GPS'}
                  </Text>
                </View>

                <View style={styles.punchBox}>
                  <Text style={styles.punchBoxLabel}>PUNCH OUT</Text>
                  <Text style={styles.punchBoxTime}>
                    {item.punch_out_time
                      ? new Date(item.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Active'}
                  </Text>
                  <Text style={styles.punchBoxCoords}>
                    {item.total_minutes ? `${Math.floor(item.total_minutes / 60)}h ${item.total_minutes % 60}m` : 'In Progress'}
                  </Text>
                </View>
              </View>
            </View>
          )}
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
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    filterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    filterTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    filterTabTextActive: {
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
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
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
    modeIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee',
      justifyContent: 'center',
      alignItems: 'center'
    },
    userName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    workDate: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
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
      gap: 10
    },
    punchBox: {
      flex: 1,
      backgroundColor: isDark ? '#1a2218' : '#f7faf5',
      padding: 10,
      borderRadius: 10
    },
    punchBoxLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5
    },
    punchBoxTime: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      marginVertical: 2
    },
    punchBoxCoords: {
      fontSize: 10,
      color: colors.textSecondary
    }
  });
