import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { mockAttendanceHistory } from '../data/mockEmployeeData';

export default function HistoryScreen({ attendanceHistory = mockAttendanceHistory }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const shiftsCount = attendanceHistory.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Verified logs with punch times and shift duration</Text>
      </View>

      {/* Summary Stat Bar */}
      <View style={styles.statBar}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{shiftsCount}</Text>
          <Text style={styles.statLabel}>Shifts Logged</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>36h 30m+</Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>100%</Text>
          <Text style={styles.statLabel}>On-Time</Text>
        </View>
      </View>

      {/* History Cards */}
      <View style={styles.historyList}>
        {attendanceHistory.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Ionicons name="time-outline" size={44} color={colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>No Attendance Records Yet</Text>
            <Text style={styles.emptyStateDesc}>
              Completed Punch In and Punch Out sessions will appear here with selfie proof and verified hours.
            </Text>
          </View>
        ) : (
          attendanceHistory.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardDateRow}>
                  {item.photoUri && (
                    <Image source={{ uri: item.photoUri }} style={styles.cardSelfieThumb} />
                  )}
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>
                <View style={[styles.modeBadge, item.mode === 'WFO' ? styles.modeWfo : styles.modeWfh]}>
                  <Ionicons
                    name={item.mode === 'WFO' ? 'business' : 'home'}
                    size={12}
                    color={item.mode === 'WFO' ? colors.darkOlive : colors.primary}
                  />
                  <Text style={[styles.modeText, item.mode === 'WFO' ? styles.modeTextWfo : styles.modeTextWfh]}>
                    {item.mode}
                  </Text>
                </View>
              </View>

              <View style={styles.punchTimesRow}>
                <View style={styles.punchCol}>
                  <Text style={styles.colLabel}>Punch In</Text>
                  <Text style={styles.colTime}>{item.punchIn}</Text>
                </View>
                <View style={styles.punchDivider}>
                  <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                </View>
                <View style={styles.punchCol}>
                  <Text style={styles.colLabel}>Punch Out</Text>
                  <Text style={styles.colTime}>{item.punchOut || '—'}</Text>
                </View>
                <View style={styles.durationCol}>
                  <Text style={styles.colLabel}>Shift Duration</Text>
                  <Text style={styles.durationTime}>{item.totalHours}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Ionicons
                  name={item.isVerified ? 'shield-checkmark' : 'information-circle'}
                  size={14}
                  color={item.isVerified ? colors.primary : '#C28424'}
                />
                <Text style={[styles.footerStatus, !item.isVerified && styles.footerStatusWarn]}>
                  {item.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2
  },
  statBar: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  statBox: {
    flex: 1,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border
  },
  historyList: {
    gap: 12
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  cardSelfieThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  modeWfo: {
    backgroundColor: colors.lightOlive
  },
  modeWfh: {
    backgroundColor: colors.beige
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  modeTextWfo: {
    color: colors.darkOlive
  },
  modeTextWfh: {
    color: colors.text
  },
  punchTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  punchCol: {
    flex: 1
  },
  punchDivider: {
    paddingHorizontal: 8
  },
  durationCol: {
    alignItems: 'flex-end',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 12
  },
  colLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2
  },
  colTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  durationTime: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  footerStatus: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600'
  },
  footerStatusWarn: {
    color: '#C28424'
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: 20
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 14,
    marginBottom: 6
  },
  emptyStateDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  }
});
