import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

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
  const [workingDays, setWorkingDays] = useState('Mon,Tue,Wed,Thu,Fri');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

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
        if (s.late_threshold_minutes) setLateThreshold(String(s.late_threshold_minutes));
        if (s.working_days) setWorkingDays(s.working_days);
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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await api.updateOrgSettings({
        name: orgName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        late_threshold_minutes: parseInt(lateThreshold, 10) || 15,
        working_days: workingDays,
        timezone
      });

      if (res.success) {
        Alert.alert('Settings Saved', 'Organization profile and shift timings updated.');
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
          />

          <Text style={styles.fieldLabel}>Contact Email</Text>
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="admin@acmetech.com"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
          />

          <Text style={styles.fieldLabel}>Contact Phone</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="+91 98765 00001"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={styles.sectionLabel}>SHIFT & WORKING HOURS</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Work Starts (IST)</Text>
              <TextInput
                style={styles.input}
                value={workStartTime}
                onChangeText={setWorkStartTime}
                placeholder="09:30"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.fieldLabel}>Work Ends (IST)</Text>
              <TextInput
                style={styles.input}
                value={workEndTime}
                onChangeText={setWorkEndTime}
                placeholder="18:30"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Late Arrival Grace Period (Minutes)</Text>
          <TextInput
            style={styles.input}
            value={lateThreshold}
            onChangeText={setLateThreshold}
            placeholder="15"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />

          <Text style={styles.fieldLabel}>Working Days</Text>
          <TextInput
            style={styles.input}
            value={workingDays}
            onChangeText={setWorkingDays}
            placeholder="Mon,Tue,Wed,Thu,Fri"
            placeholderTextColor={colors.textSecondary}
          />

          {canEdit && (
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
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
    }
  });
