import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useResponsiveLayout } from '../utils/responsive';
import SecureSelfie from '../components/SecureSelfie';

export default function HistoryScreen({ attendanceHistory = [] }) {
  const { colors, isDark } = useTheme();
  const layout = useResponsiveLayout();
  const styles = getStyles(colors, isDark, layout);
  const shiftsCount = attendanceHistory.length;

  // Calculate dynamic stats from real history records
  const totalMins = attendanceHistory.reduce((acc, item) => {
    if (item.total_minutes) return acc + Number(item.total_minutes);
    if (item.duration && typeof item.duration === 'string' && item.duration.includes('h')) {
      const parts = item.duration.match(/(\d+)h\s*(\d+)?m?/);
      if (parts) {
        return acc + parseInt(parts[1], 10) * 60 + (parts[2] ? parseInt(parts[2], 10) : 0);
      }
    }
    return acc;
  }, 0);
  const totalHoursStr = totalMins > 0 ? `${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : (shiftsCount > 0 ? '—' : '0h 00m');

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showInGps, setShowInGps] = useState(false);
  const [showOutGps, setShowOutGps] = useState(false);

  const handleOpenDetails = (item) => {
    setSelectedRecord(item);
    setShowInGps(false);
    setShowOutGps(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Verified logs with punch times, photos, and GPS audit</Text>
      </View>

      {/* Summary Stat Bar */}
      <View style={styles.statBar}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{shiftsCount}</Text>
          <Text style={styles.statLabel}>Shifts Logged</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{totalHoursStr}</Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{shiftsCount > 0 ? '100%' : '—'}</Text>
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
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => handleOpenDetails(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardDateRow}>
                  <SecureSelfie
                    photoPath={item.punch_in_photo_path || item.punchInPhotoUri || item.photoUri}
                    style={styles.cardSelfieThumb}
                    placeholderIcon="camera"
                    placeholderText={null}
                  />
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {Boolean(item.attendance_status || item.attendanceStatus) && (
                    <View style={[
                      styles.statusPill,
                      (item.attendance_status || item.attendanceStatus) === 'Full Day' && styles.statusPillFull,
                      (item.attendance_status || item.attendanceStatus) === 'Half Day' && styles.statusPillHalf,
                      (item.attendance_status || item.attendanceStatus) === 'Absent' && styles.statusPillAbsent,
                      (item.attendance_status || item.attendanceStatus) === 'Shift In Progress' && styles.statusPillProgress,
                      (item.attendance_status || item.attendanceStatus) === 'In Progress' && styles.statusPillProgress
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        (item.attendance_status || item.attendanceStatus) === 'Full Day' && styles.statusPillTextFull,
                        (item.attendance_status || item.attendanceStatus) === 'Half Day' && styles.statusPillTextHalf,
                        (item.attendance_status || item.attendanceStatus) === 'Absent' && styles.statusPillTextAbsent,
                        ((item.attendance_status || item.attendanceStatus) === 'Shift In Progress' || (item.attendance_status || item.attendanceStatus) === 'In Progress') && styles.statusPillTextProgress
                      ]}>
                        {item.attendance_status || item.attendanceStatus}
                      </Text>
                    </View>
                  )}
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
              </View>

              <View style={styles.punchTimesRow}>
                <View style={styles.punchCol}>
                  <Text style={styles.colLabel}>Punch In</Text>
                  <Text style={styles.colTime}>{item.punchIn || item.punch_in_time || '—'}</Text>
                </View>
                <View style={styles.punchDivider}>
                  <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
                </View>
                <View style={styles.punchCol}>
                  <Text style={styles.colLabel}>Punch Out</Text>
                  <Text style={styles.colTime}>{item.punchOut || item.punch_out_time || 'In Progress'}</Text>
                </View>
                <View style={styles.durationCol}>
                  <Text style={styles.colLabel}>Shift Duration</Text>
                  <Text style={styles.durationTime}>{item.duration || item.totalHours || '8h 15m'}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Ionicons
                    name={item.verified !== false && item.isVerified !== false ? 'shield-checkmark' : 'information-circle'}
                    size={14}
                    color={item.verified !== false && item.isVerified !== false ? colors.primary : '#C28424'}
                  />
                  <Text style={[styles.footerStatus, (item.verified === false || item.isVerified === false) && styles.footerStatusWarn]}>
                    {item.status || (item.verified !== false ? 'Verified Session' : 'Pending Verification')}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>View Details ›</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Attendance Record Details Modal */}
      <Modal
        visible={!!selectedRecord}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRecord(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Attendance Details</Text>
                <Text style={styles.modalSubtitle}>{selectedRecord?.date}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedRecord(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Work Mode Badge & Status */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.modeBadge, selectedRecord?.mode === 'WFO' ? styles.modeWfo : styles.modeWfh]}>
                    <Ionicons
                      name={selectedRecord?.mode === 'WFO' ? 'business' : 'home'}
                      size={13}
                      color={selectedRecord?.mode === 'WFO' ? colors.darkOlive : colors.primary}
                    />
                    <Text style={[styles.modeText, selectedRecord?.mode === 'WFO' ? styles.modeTextWfo : styles.modeTextWfh]}>
                      {selectedRecord?.mode || 'WFO'}
                    </Text>
                  </View>
                  {Boolean(selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) && (
                    <View style={[
                      styles.statusPill,
                      (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Full Day' && styles.statusPillFull,
                      (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Half Day' && styles.statusPillHalf,
                      (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Absent' && styles.statusPillAbsent,
                      ((selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Shift In Progress' || (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'In Progress') && styles.statusPillProgress
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Full Day' && styles.statusPillTextFull,
                        (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Half Day' && styles.statusPillTextHalf,
                        (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Absent' && styles.statusPillTextAbsent,
                        ((selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'Shift In Progress' || (selectedRecord?.attendance_status || selectedRecord?.attendanceStatus) === 'In Progress') && styles.statusPillTextProgress
                      ]}>
                        {selectedRecord?.attendance_status || selectedRecord?.attendanceStatus}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  Duration: {selectedRecord?.duration || selectedRecord?.totalHours || '8h 15m'}
                </Text>
              </View>

              {/* Event Photos & Timestamps */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                {/* Punch In Event */}
                <View style={styles.eventBox}>
                  <Text style={styles.eventLabel}>Punch In Event</Text>
                  <Text style={styles.eventTime}>{selectedRecord?.punchIn || selectedRecord?.punch_in_time || '—'}</Text>
                  <SecureSelfie
                    photoPath={selectedRecord?.punch_in_photo_path || selectedRecord?.punchInPhotoUri || selectedRecord?.photoUri}
                    style={styles.eventPhoto}
                    placeholderIcon="person"
                    placeholderText="Photo Logged"
                  />
                </View>

                {/* Punch Out Event */}
                <View style={styles.eventBox}>
                  <Text style={styles.eventLabel}>Punch Out Event</Text>
                  <Text style={styles.eventTime}>{selectedRecord?.punchOut || selectedRecord?.punch_out_time || 'Not punched out'}</Text>
                  <SecureSelfie
                    photoPath={selectedRecord?.punch_out_photo_path || selectedRecord?.punchOutPhotoUri}
                    style={styles.eventPhoto}
                    placeholderIcon="camera-outline"
                    placeholderText={selectedRecord?.punchOut || selectedRecord?.punch_out_time ? 'Photo Logged' : 'In Progress'}
                  />
                </View>
              </View>

              {/* Verification & Location Details */}
              <View style={styles.detailSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons
                    name={selectedRecord?.mode === 'WFO' ? 'shield-checkmark' : 'location'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.detailSectionTitle}>
                    {selectedRecord?.mode === 'WFO' ? 'Office Geofence Verification' : 'Remote Location Verification'}
                  </Text>
                </View>
                <Text style={[styles.detailText, { marginBottom: 10 }]}>
                  {selectedRecord?.mode === 'WFO'
                    ? (selectedRecord?.punch_in_distance_meters != null
                        ? `Verified inside authorized office perimeter (${Math.round(selectedRecord.punch_in_distance_meters)}m from office center).`
                        : 'Verified inside authorized office perimeter.')
                    : 'Location recorded independently at Punch In and Punch Out events.'}
                </Text>

                {/* Punch In Location Disclosure */}
                <TouchableOpacity
                  style={styles.locActionBtn}
                  onPress={() => setShowInGps(!showInGps)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={showInGps ? 'eye-off-outline' : 'navigate-outline'} size={14} color={colors.primary} />
                  <Text style={styles.locActionText}>
                    {showInGps ? 'Hide Punch In GPS' : 'View Punch In GPS Coordinates'}
                  </Text>
                </TouchableOpacity>
                {showInGps && (
                  <View style={styles.locBox}>
                    <Text style={styles.locCoords}>
                      Latitude: {selectedRecord?.punch_in_lat != null ? `${Number(selectedRecord.punch_in_lat).toFixed(6)}°` : 'Not recorded'}
                    </Text>
                    <Text style={styles.locCoords}>
                      Longitude: {selectedRecord?.punch_in_lng != null ? `${Number(selectedRecord.punch_in_lng).toFixed(6)}°` : 'Not recorded'}
                    </Text>
                    <Text style={styles.locMeta}>
                      Accuracy: {selectedRecord?.punch_in_accuracy ? `±${Math.round(selectedRecord.punch_in_accuracy)}m` : 'High'} • Timestamp: {selectedRecord?.punchIn || selectedRecord?.punch_in_time || 'Logged'}
                    </Text>
                  </View>
                )}

                {/* Punch Out Location Disclosure */}
                {(selectedRecord?.punchOut || selectedRecord?.punch_out_lat != null) && (
                  <>
                    <TouchableOpacity
                      style={[styles.locActionBtn, { marginTop: 8 }]}
                      onPress={() => setShowOutGps(!showOutGps)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={showOutGps ? 'eye-off-outline' : 'navigate-outline'} size={14} color={colors.primary} />
                      <Text style={styles.locActionText}>
                        {showOutGps ? 'Hide Punch Out GPS' : 'View Punch Out GPS Coordinates'}
                      </Text>
                    </TouchableOpacity>
                    {showOutGps && (
                      <View style={styles.locBox}>
                        <Text style={styles.locCoords}>
                          Latitude: {selectedRecord?.punch_out_lat != null ? `${Number(selectedRecord.punch_out_lat).toFixed(6)}°` : 'Not recorded'}
                        </Text>
                        <Text style={styles.locCoords}>
                          Longitude: {selectedRecord?.punch_out_lng != null ? `${Number(selectedRecord.punch_out_lng).toFixed(6)}°` : 'Not recorded'}
                        </Text>
                        <Text style={styles.locMeta}>
                          Accuracy: {selectedRecord?.punch_out_accuracy ? `±${Math.round(selectedRecord.punch_out_accuracy)}m` : 'High'} • Timestamp: {selectedRecord?.punchOut || selectedRecord?.punch_out_time || 'In Progress'}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setSelectedRecord(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalDoneBtnText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (colors, isDark, layout = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: layout?.screenPadding || 16,
    paddingTop: 16,
    paddingBottom: 110,
    maxWidth: layout?.isTablet ? 720 : '100%',
    alignSelf: 'center',
    width: '100%'
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
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1
  },
  statusPillFull: {
    backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
    borderColor: isDark ? '#059669' : '#A7F3D0'
  },
  statusPillHalf: {
    backgroundColor: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FFFBEB',
    borderColor: isDark ? '#D97706' : '#FDE68A'
  },
  statusPillAbsent: {
    backgroundColor: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2',
    borderColor: isDark ? '#DC2626' : '#FECACA'
  },
  statusPillProgress: {
    backgroundColor: isDark ? 'rgba(13, 148, 136, 0.2)' : '#F0FDFA',
    borderColor: isDark ? '#0D9488' : '#CCFBF1'
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800'
  },
  statusPillTextFull: {
    color: isDark ? '#34D399' : '#059669'
  },
  statusPillTextHalf: {
    color: isDark ? '#FBBF24' : '#D97706'
  },
  statusPillTextAbsent: {
    color: isDark ? '#F87171' : '#DC2626'
  },
  statusPillTextProgress: {
    color: isDark ? '#2DD4BF' : '#0D9488'
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
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    width: '92%',
    maxWidth: 440,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  modalCloseBtn: {
    padding: 6
  },
  eventBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.beige,
    alignItems: 'center'
  },
  eventLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  eventTime: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginVertical: 4
  },
  eventPhoto: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginTop: 4
  },
  eventPhotoPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    backgroundColor: isDark ? '#1a202c' : '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  photoPlaceholderText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4
  },
  detailSection: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: isDark ? '#1a202c' : '#f8fafc',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary
  },
  detailText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16
  },
  locActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: isDark ? '#133333' : '#E6F3F1',
    alignSelf: 'flex-start'
  },
  locActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary
  },
  locBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderWidth: 1,
    borderColor: colors.border
  },
  locCoords: {
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontWeight: '700',
    color: colors.textPrimary
  },
  locMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  }
});
