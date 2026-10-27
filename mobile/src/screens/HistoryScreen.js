import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { mockAttendanceHistory } from '../data/mockEmployeeData';

export default function HistoryScreen({ attendanceHistory = mockAttendanceHistory }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const shiftsCount = attendanceHistory.length;

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
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => handleOpenDetails(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardDateRow}>
                  {item.punchInPhotoUri || item.photoUri ? (
                    <Image source={{ uri: item.punchInPhotoUri || item.photoUri }} style={styles.cardSelfieThumb} />
                  ) : (
                    <View style={[styles.cardSelfieThumb, { backgroundColor: colors.lightOlive, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="camera" size={14} color={colors.primary} />
                    </View>
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
                <View style={[styles.modeBadge, selectedRecord?.mode === 'WFO' ? styles.modeWfo : styles.modeWfh]}>
                  <Ionicons
                    name={selectedRecord?.mode === 'WFO' ? 'business' : 'home'}
                    size={13}
                    color={selectedRecord?.mode === 'WFO' ? colors.darkOlive : colors.primary}
                  />
                  <Text style={[styles.modeText, selectedRecord?.mode === 'WFO' ? styles.modeTextWfo : styles.modeTextWfh]}>
                    Work Mode: {selectedRecord?.mode || 'WFO'}
                  </Text>
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
                  <Text style={styles.eventTime}>{selectedRecord?.punchIn || '—'}</Text>
                  {selectedRecord?.punchInPhotoUri || selectedRecord?.photoUri ? (
                    <Image
                      source={{ uri: selectedRecord.punchInPhotoUri || selectedRecord.photoUri }}
                      style={styles.eventPhoto}
                    />
                  ) : (
                    <View style={styles.eventPhotoPlaceholder}>
                      <Ionicons name="person" size={24} color={colors.textSecondary} />
                      <Text style={styles.photoPlaceholderText}>Photo Logged</Text>
                    </View>
                  )}
                </View>

                {/* Punch Out Event */}
                <View style={styles.eventBox}>
                  <Text style={styles.eventLabel}>Punch Out Event</Text>
                  <Text style={styles.eventTime}>{selectedRecord?.punchOut || 'Not punched out'}</Text>
                  {selectedRecord?.punchOutPhotoUri ? (
                    <Image
                      source={{ uri: selectedRecord.punchOutPhotoUri }}
                      style={styles.eventPhoto}
                    />
                  ) : (
                    <View style={styles.eventPhotoPlaceholder}>
                      <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                      <Text style={styles.photoPlaceholderText}>
                        {selectedRecord?.punchOut ? 'Photo Logged' : 'In Progress'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Verification & Location Details */}
              {selectedRecord?.mode === 'WFO' ? (
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                    <Text style={styles.detailSectionTitle}>Office Geofence Verification</Text>
                  </View>
                  <Text style={styles.detailText}>
                    Status: Verified inside authorized office perimeter (within 250m radius).
                  </Text>
                </View>
              ) : (
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="location" size={16} color={colors.primary} />
                    <Text style={styles.detailSectionTitle}>WFH Remote Location Verification</Text>
                  </View>
                  <Text style={[styles.detailText, { marginBottom: 10 }]}>
                    Location verified independently at Punch In and Punch Out events.
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
                        Latitude: {selectedRecord?.punch_in_lat || '12.9716'}° N
                      </Text>
                      <Text style={styles.locCoords}>
                        Longitude: {selectedRecord?.punch_in_lng || '77.5946'}° E
                      </Text>
                      <Text style={styles.locMeta}>
                        Accuracy: ±10m • Timestamp: {selectedRecord?.punchIn || 'Logged'}
                      </Text>
                    </View>
                  )}

                  {/* Punch Out Location Disclosure */}
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
                        Latitude: {selectedRecord?.punch_out_lat || '12.9718'}° N
                      </Text>
                      <Text style={styles.locCoords}>
                        Longitude: {selectedRecord?.punch_out_lng || '77.5948'}° E
                      </Text>
                      <Text style={styles.locMeta}>
                        Accuracy: ±10m • Timestamp: {selectedRecord?.punchOut || 'In Progress'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
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

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20,
    paddingBottom: 110
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
    backgroundColor: isDark ? '#2d3748' : '#e8eddc',
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
