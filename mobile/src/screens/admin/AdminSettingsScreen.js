import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

const ALL_DAYS = [
  { key: 'Mon', label: 'Mon', full: 'Monday' },
  { key: 'Tue', label: 'Tue', full: 'Tuesday' },
  { key: 'Wed', label: 'Wed', full: 'Wednesday' },
  { key: 'Thu', label: 'Thu', full: 'Thursday' },
  { key: 'Fri', label: 'Fri', full: 'Friday' },
  { key: 'Sat', label: 'Sat', full: 'Saturday' },
  { key: 'Sun', label: 'Sun', full: 'Sunday' }
];

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parse24to12(time24) {
  const [hStr, mStr] = (time24 || '09:30').split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) h = 9;
  const m = parseInt(mStr, 10) || 0;
  const period = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  else if (h === 0) h = 12;
  return { hour: h, minute: m, period };
}

function to24HourString(hour12, minute, period) {
  let h = hour12;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDisplayTime(time24) {
  const { hour, minute, period } = parse24to12(time24);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function AdminSettingsScreen({ onBack, onLogout, user, organization }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const canEdit = user?.role === 'founder' || user?.role === 'admin';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [companyId, setCompanyId] = useState(organization?.public_company_id || organization?.companyId || '');
  const [orgName, setOrgName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [workStartTime, setWorkStartTime] = useState('09:30');
  const [workEndTime, setWorkEndTime] = useState('18:30');
  const [lateThreshold, setLateThreshold] = useState('15');
  const [selectedDays, setSelectedDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Time Picker Modal State
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activePickerField, setActivePickerField] = useState(null); // 'start' | 'end'
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(30);
  const [tempPeriod, setTempPeriod] = useState('AM');

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const res = await api.getOrgSettings();
      if (res.success && res.data) {
        const s = res.data;
        if (s.public_company_id || s.companyId) setCompanyId(s.public_company_id || s.companyId);
        if (s.name) setOrgName(s.name);
        if (s.contact_email) setContactEmail(s.contact_email);
        if (s.contact_phone) setContactPhone(s.contact_phone);
        if (s.work_start_time) setWorkStartTime(s.work_start_time);
        if (s.work_end_time) setWorkEndTime(s.work_end_time);
        if (s.late_threshold_minutes !== undefined && s.late_threshold_minutes !== null) {
          setLateThreshold(String(s.late_threshold_minutes));
        }
        if (s.working_days) {
          const parsed = s.working_days.split(',').map((d) => d.trim()).filter(Boolean);
          if (parsed.length > 0) {
            setSelectedDays(parsed);
          }
        }
        if (s.timezone) setTimezone(s.timezone);
      }
    } catch (e) {
      console.warn('[AdminSettings] Load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Time validation check for normal same-day shifts
  const isTimingInvalid = useMemo(() => {
    if (!workStartTime || !workEndTime) return false;
    const [sH, sM] = workStartTime.split(':').map(Number);
    const [eH, eM] = workEndTime.split(':').map(Number);
    return (eH * 60 + eM) <= (sH * 60 + sM);
  }, [workStartTime, workEndTime]);

  // Working day toggle handler
  const toggleWorkingDay = (dayKey) => {
    if (selectedDays.includes(dayKey)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayKey));
    } else {
      const updated = [...selectedDays, dayKey];
      // Keep canonical Mon -> Sun order
      const ordered = ALL_DAYS.filter((d) => updated.includes(d.key)).map((d) => d.key);
      setSelectedDays(ordered);
    }
  };

  // Open Time Picker Modal
  const openTimePicker = (field) => {
    const currentVal = field === 'start' ? workStartTime : workEndTime;
    const { hour, minute, period } = parse24to12(currentVal);
    setTempHour(hour);
    setTempMinute(minute);
    setTempPeriod(period);
    setActivePickerField(field);
    setShowTimePicker(true);
  };

  // Cancel Time Picker (preserves existing saved value)
  const cancelTimePicker = () => {
    setShowTimePicker(false);
    setActivePickerField(null);
  };

  // Confirm Time Picker selection
  const confirmTimePicker = () => {
    const newTime24 = to24HourString(tempHour, tempMinute, tempPeriod);
    if (activePickerField === 'start') {
      setWorkStartTime(newTime24);
    } else if (activePickerField === 'end') {
      setWorkEndTime(newTime24);
    }
    setShowTimePicker(false);
    setActivePickerField(null);
  };

  // Validation & Save Settings
  const handleSave = async () => {
    if (!canEdit) return;

    // 1. Organization Legal Name Validation
    if (!orgName.trim()) {
      Alert.alert('Validation Error', 'Organization Legal Name is required.');
      return;
    }

    // 2. Contact Email Validation
    if (!contactEmail.trim() || !contactEmail.includes('@')) {
      Alert.alert('Validation Error', 'A valid Contact Email address is required.');
      return;
    }

    // 3. Shift Timings Validation: Work end must be later than work start time
    if (!workStartTime || !workEndTime) {
      Alert.alert('Validation Error', 'Work start and end times are required.');
      return;
    }
    const [sH, sM] = workStartTime.split(':').map(Number);
    const [eH, eM] = workEndTime.split(':').map(Number);
    if (eH * 60 + eM <= sH * 60 + sM) {
      Alert.alert(
        'Invalid Shift Timings',
        'Work end time must be later than work start time.'
      );
      return;
    }

    // 4. Late Arrival Grace Period Validation: Non-negative whole number between 0 and 180
    const graceNum = parseInt(lateThreshold, 10);
    if (
      isNaN(graceNum) ||
      graceNum < 0 ||
      graceNum > 180 ||
      !/^\d+$/.test(lateThreshold.trim())
    ) {
      Alert.alert(
        'Invalid Grace Period',
        'Late arrival grace period must be a whole number between 0 and 180 minutes.'
      );
      return;
    }

    // 5. Working Days Validation: At least one day selected
    if (!selectedDays || selectedDays.length === 0) {
      Alert.alert(
        'Working Days Required',
        'Please select at least one working day.'
      );
      return;
    }

    try {
      setIsSaving(true);
      const res = await api.updateOrgSettings({
        name: orgName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        late_threshold_minutes: graceNum,
        working_days: selectedDays.join(','),
        timezone
      });

      if (res.success) {
        Alert.alert('Settings Saved', 'Organization profile and shift timings updated successfully.');
      } else {
        Alert.alert('Error', res.error || 'Failed to save settings.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Organization Settings</Text>
          <Text style={styles.headerSubtitle}>Company Profile & Shift Policy</Text>
        </View>
        {canEdit && (
          <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave} disabled={isSaving}>
            <Text style={styles.saveHeaderBtnText}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* User Profile Summary Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Ionicons name="person" size={24} color="#ffffff" />
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <Text style={styles.profileRoleText}>
                {user?.role?.toUpperCase()} &bull; {organization?.name}
              </Text>
            </View>
          </View>

          {!canEdit && (
            <View style={styles.permissionNotice}>
              <Ionicons name="information-circle" size={18} color="#3b82f6" />
              <Text style={styles.permissionNoticeText}>
                Organization settings are view-only for Team Leaders. Founders and Admins manage company shift policies.
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>COMPANY IDENTIFIERS</Text>

          {/* Unique Company ID Display */}
          <View style={styles.idCard}>
            <View style={styles.idCardLeft}>
              <Text style={styles.idCardLabel}>UNIQUE COMPANY ID</Text>
              <Text style={styles.idCardValue}>{companyId || 'CMP-7K4M9X2Q'}</Text>
              <Text style={styles.idCardHelp}>Share with team members to join this company workspace.</Text>
            </View>
            <TouchableOpacity
              style={styles.idCopyBtn}
              onPress={() => {
                const val = companyId || 'CMP-7K4M9X2Q';
                Alert.alert('Company ID', `Company ID is: ${val}`);
              }}
            >
              <Ionicons name="copy-outline" size={16} color={colors.primary} />
              <Text style={styles.idCopyText}>Copy</Text>
            </TouchableOpacity>
          </View>

          {/* Founder ID Display */}
          {user?.role === 'founder' && (
            <View style={[styles.idCard, { marginTop: 10 }]}>
              <View style={styles.idCardLeft}>
                <Text style={styles.idCardLabel}>FOUNDER ID</Text>
                <Text style={styles.idCardValue}>{user?.employeeId || 'FND-0001'}</Text>
                <Text style={styles.idCardHelp}>Permanent organization Founder identifier.</Text>
              </View>
            </View>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>COMPANY PROFILE</Text>
          <Text style={styles.fieldLabel}>Organization Legal Name</Text>
          <TextInput
            style={styles.input}
            value={orgName}
            onChangeText={setOrgName}
            placeholder="Acme Technologies Pvt Ltd"
            placeholderTextColor={colors.textSecondary}
            editable={canEdit}
          />

          <Text style={styles.fieldLabel}>Contact Email</Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="admin@acmetech.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={canEdit}
          />

          <Text style={styles.fieldLabel}>Contact Phone</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+91 98765 00001"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            editable={canEdit}
          />

          {/* ── SHIFT & WORKING HOURS ── */}
          <Text style={styles.sectionLabel}>SHIFT & WORKING HOURS</Text>

          {/* First row: Work Starts (IST) and Work Ends (IST) with Time Picker */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Work Starts (IST)</Text>
              <TouchableOpacity
                style={styles.timePickerBtn}
                onPress={() => canEdit && openTimePicker('start')}
                activeOpacity={canEdit ? 0.7 : 1}
              >
                <View style={styles.timePickerLeft}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.timePickerValueText}>
                    {formatDisplayTime(workStartTime)}
                  </Text>
                </View>
                {canEdit && <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>

            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Work Ends (IST)</Text>
              <TouchableOpacity
                style={styles.timePickerBtn}
                onPress={() => canEdit && openTimePicker('end')}
                activeOpacity={canEdit ? 0.7 : 1}
              >
                <View style={styles.timePickerLeft}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.timePickerValueText}>
                    {formatDisplayTime(workEndTime)}
                  </Text>
                </View>
                {canEdit && <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Validation Warning if Work Ends <= Work Starts */}
          {isTimingInvalid && (
            <View style={styles.validationWarningBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={styles.validationWarningText}>
                Work end time must be later than work start time.
              </Text>
            </View>
          )}

          {/* Second row: Late Arrival Grace Period (Minutes) — Numeric Input */}
          <Text style={styles.fieldLabel}>Late Arrival Grace Period (Minutes)</Text>
          <TextInput
            style={styles.input}
            value={lateThreshold}
            onChangeText={(txt) => {
              const digitsOnly = txt.replace(/[^0-9]/g, '');
              setLateThreshold(digitsOnly);
            }}
            placeholder="15"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={3}
            editable={canEdit}
          />
          {lateThreshold !== '' && parseInt(lateThreshold, 10) > 180 && (
            <Text style={styles.graceWarningText}>
              Maximum recommended grace period is 180 minutes.
            </Text>
          )}

          {/* Third section: Working Days — Seven Selectable Day Chips */}
          <Text style={styles.fieldLabel}>Working Days</Text>
          <View style={styles.daysGrid}>
            {ALL_DAYS.map((day) => {
              const isSelected = selectedDays.includes(day.key);
              return (
                <TouchableOpacity
                  key={day.key}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => canEdit && toggleWorkingDay(day.key)}
                  activeOpacity={canEdit ? 0.7 : 1}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={isSelected ? '#ffffff' : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Working Days Summary / Validation */}
          <View style={styles.daySummaryBox}>
            {selectedDays.length === 0 ? (
              <Text style={styles.dayErrorText}>
                ⚠ Please select at least one working day.
              </Text>
            ) : (
              <Text style={styles.daySummaryText}>
                Active: {selectedDays.join(', ')} ({selectedDays.length} day{selectedDays.length > 1 ? 's' : ''} / week)
              </Text>
            )}
          </View>

          {/* Save Button */}
          {canEdit && (
            <TouchableOpacity
              style={[styles.saveBtn, (isSaving || isTimingInvalid || selectedDays.length === 0) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save All Settings</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Logout Section */}
          <View style={styles.logoutSection}>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={styles.logoutText}>Sign Out ({user?.role?.toUpperCase()})</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── Native-Style Time Picker Modal ── */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={cancelTimePicker}>
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {activePickerField === 'start' ? 'Work Starts Time' : 'Work Ends Time'} (IST)
                </Text>
                <Text style={styles.modalSubtitle}>Select shift timing</Text>
              </View>
              <TouchableOpacity onPress={cancelTimePicker} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Big Digital Clock Card */}
            <View style={styles.digitalClockCard}>
              <View style={styles.clockRow}>
                <Text style={styles.clockDigits}>
                  {String(tempHour).padStart(2, '0')} : {String(tempMinute).padStart(2, '0')}
                </Text>
                <View style={styles.periodPillsWrap}>
                  <TouchableOpacity
                    style={[styles.periodPill, tempPeriod === 'AM' && styles.periodPillActive]}
                    onPress={() => setTempPeriod('AM')}
                  >
                    <Text style={[styles.periodPillText, tempPeriod === 'AM' && styles.periodPillTextActive]}>
                      AM
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.periodPill, tempPeriod === 'PM' && styles.periodPillActive]}
                    onPress={() => setTempPeriod('PM')}
                  >
                    <Text style={[styles.periodPillText, tempPeriod === 'PM' && styles.periodPillTextActive]}>
                      PM
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.clock24hHint}>
                24-Hour Format: {to24HourString(tempHour, tempMinute, tempPeriod)} IST
              </Text>
            </View>

            {/* Hour Selector (1 - 12) */}
            <Text style={styles.pickerSectionLabel}>SELECT HOUR</Text>
            <View style={styles.hourGrid}>
              {HOURS_12.map((h) => {
                const isSelected = tempHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.gridCircleBtn, isSelected && styles.gridCircleBtnActive]}
                    onPress={() => setTempHour(h)}
                  >
                    <Text style={[styles.gridCircleText, isSelected && styles.gridCircleTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Minute Selector */}
            <View style={styles.minuteHeaderRow}>
              <Text style={styles.pickerSectionLabel}>SELECT MINUTE</Text>
              <View style={styles.minuteStepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setTempMinute((m) => Math.max(0, m - 1))}
                >
                  <Ionicons name="remove" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{String(tempMinute).padStart(2, '0')}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setTempMinute((m) => Math.min(59, m + 1))}
                >
                  <Ionicons name="add" size={16} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.minuteGrid}>
              {MINUTES_STEPS.map((m) => {
                const isSelected = tempMinute === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.minuteChip, isSelected && styles.minuteChipActive]}
                    onPress={() => setTempMinute(m)}
                  >
                    <Text style={[styles.minuteChipText, isSelected && styles.minuteChipTextActive]}>
                      :{String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelTimePicker}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmTimePicker}>
                <Text style={styles.confirmBtnText}>Set Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    saveHeaderBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8
    },
    saveHeaderBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700'
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
    content: {
      padding: 16,
      paddingBottom: 40
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12
    },
    profileAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center'
    },
    profileDetails: {
      flex: 1
    },
    profileName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    profileEmail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    profileRoleText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '700',
      marginTop: 4
    },
    permissionNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: '#93c5fd'
    },
    permissionNoticeText: {
      flex: 1,
      fontSize: 12,
      color: '#1e40af',
      lineHeight: 16
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 16
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6,
      marginTop: 8
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
      fontSize: 13,
      color: colors.textPrimary
    },
    row: {
      flexDirection: 'row',
      gap: 10
    },
    col: {
      flex: 1
    },
    timePickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44
    },
    timePickerLeft: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    timePickerValueText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary
    },
    validationWarningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 8
    },
    validationWarningText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#b91c1c',
      flex: 1
    },
    graceWarningText: {
      fontSize: 11,
      color: '#b91c1c',
      marginTop: 4,
      fontWeight: '600'
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4
    },
    dayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    dayChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    dayChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    dayChipTextSelected: {
      color: '#ffffff',
      fontWeight: '700'
    },
    daySummaryBox: {
      marginTop: 8
    },
    daySummaryText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    dayErrorText: {
      fontSize: 11,
      color: '#ef4444',
      fontWeight: '700'
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20
    },
    saveBtnDisabled: {
      opacity: 0.6
    },
    saveBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    },
    idCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1f2d1b' : '#edf5ea',
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? '#384d2b' : '#cce2c3'
    },
    idCardLeft: {
      flex: 1,
      marginRight: 10
    },
    idCardLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 2
    },
    idCardValue: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5
    },
    idCardHelp: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    idCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: isDark ? '#2e3e26' : '#e0eed6',
      gap: 4
    },
    idCopyText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    logoutSection: {
      marginTop: 24,
      marginBottom: 30,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      borderRadius: 12,
      height: 46,
      gap: 8
    },
    logoutText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ef4444'
    },
    // ── Time Picker Modal Styles ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    timeModalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 360,
      borderWidth: 1,
      borderColor: colors.border
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary
    },
    modalSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    modalCloseBtn: {
      padding: 4
    },
    digitalClockCard: {
      backgroundColor: isDark ? '#1f2d1b' : '#edf5ea',
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#384d2b' : '#cce2c3'
    },
    clockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14
    },
    clockDigits: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: 1
    },
    periodPillsWrap: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2e3e26' : '#d8ebd0',
      borderRadius: 8,
      padding: 3
    },
    periodPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6
    },
    periodPillActive: {
      backgroundColor: colors.primary
    },
    periodPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary
    },
    periodPillTextActive: {
      color: '#ffffff'
    },
    clock24hHint: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600',
      marginTop: 4
    },
    pickerSectionLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 8
    },
    hourGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
      justifyContent: 'space-between'
    },
    gridCircleBtn: {
      width: '14.5%',
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: isDark ? '#263022' : '#f0f3eb',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    gridCircleBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    gridCircleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    gridCircleTextActive: {
      color: '#ffffff'
    },
    minuteHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6
    },
    minuteStepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    stepperBtn: {
      width: 26,
      height: 26,
      borderRadius: 6,
      backgroundColor: isDark ? '#263022' : '#f0f3eb',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    stepperValue: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary
    },
    minuteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 18,
      justifyContent: 'space-between'
    },
    minuteChip: {
      width: '14.5%',
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? '#263022' : '#f0f3eb',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    minuteChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    minuteChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary
    },
    minuteChipTextActive: {
      color: '#ffffff'
    },
    modalActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 14
    },
    cancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary
    },
    confirmBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10
    },
    confirmBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ffffff'
    }
  });
