import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export default function CompanySetupSuccessScreen({ setupData, onContinueToLogin, onContinueToDashboard }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [copiedField, setCopiedField] = useState(null);

  const companyName = setupData?.companyName || setupData?.organization?.name || 'Your Company';
  const companyId = setupData?.companyId || setupData?.organization?.public_company_id || 'CMP-XXXXXXXX';
  const founderId = setupData?.founderId || setupData?.user?.employeeId || 'FND-0001';
  const founderName = setupData?.user?.name || 'Founder';

  const handleCopy = async (text, fieldName) => {
    try {
      setCopiedField(fieldName);
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        await Share.share({
          message: text,
          title: `Copy ${fieldName === 'companyId' ? 'Company ID' : 'Founder ID'}`
        });
      }
      setTimeout(() => setCopiedField(null), 2500);
    } catch (e) {
      Alert.alert('Identifier', text);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Celebration Header */}
        <View style={styles.header}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-circle" size={54} color="#ffffff" />
          </View>
          <Text style={styles.successTitle}>Company Workspace Ready!</Text>
          <Text style={styles.successSubtitle}>
            Your company and Founder account have been created securely.
          </Text>
        </View>

        {/* Company Identity Card */}
        <View style={styles.identityCard}>
          <Text style={styles.companyNameTitle}>{companyName}</Text>
          <Text style={styles.founderSubtitle}>Founder: {founderName}</Text>

          <View style={styles.divider} />

          {/* Unique Company ID */}
          <View style={styles.idBox}>
            <View style={styles.idBoxLeft}>
              <Text style={styles.idLabel}>UNIQUE COMPANY ID</Text>
              <Text style={styles.idValue}>{companyId}</Text>
              <Text style={styles.idHelp}>Share this with employees when inviting them to join.</Text>
            </View>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => handleCopy(companyId, 'companyId')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedField === 'companyId' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.copyBtnText}>
                {copiedField === 'companyId' ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Unique Founder ID */}
          <View style={[styles.idBox, { marginTop: 12 }]}>
            <View style={styles.idBoxLeft}>
              <Text style={styles.idLabel}>FOUNDER ID</Text>
              <Text style={styles.idValue}>{founderId}</Text>
              <Text style={styles.idHelp}>Your permanent organization employee identifier.</Text>
            </View>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => handleCopy(founderId, 'founderId')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedField === 'founderId' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.copyBtnText}>
                {copiedField === 'founderId' ? 'Copied' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Next Steps Guidance */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Recommended Next Steps:</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepHeading}>Open Management Dashboard</Text>
              <Text style={styles.stepDesc}>Review company operational policies and geofence settings.</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepHeading}>Invite Your Team</Text>
              <Text style={styles.stepDesc}>Go to Staff & Employees to generate secure invitation codes for your team members.</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepHeading}>Retrieve Company ID Anytime</Text>
              <Text style={styles.stepDesc}>Your Company ID is always accessible from Company Settings in the management menu.</Text>
            </View>
          </View>
        </View>

        {/* Safety Note on Storing Company ID */}
        <View style={styles.safetyBox}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.safetyTitle}>Store Your Company ID Safely</Text>
            <Text style={styles.safetyDesc}>
              Keep this Company ID in a secure location. You will need it for subsequent management sign-ins and when onboarding your employees.
            </Text>
          </View>
        </View>

        {/* Primary Action: Continue to Management Login */}
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => {
            if (onContinueToLogin) {
              onContinueToLogin(companyId, setupData?.user?.email);
            } else if (onContinueToDashboard) {
              onContinueToDashboard(setupData);
            }
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue to Management Login"
        >
          <Text style={styles.continueBtnText}>Continue to Management Login</Text>
          <Ionicons name="arrow-forward" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* Secondary Direct Entry: Open Management Dashboard */}
        {Boolean(setupData?.token) && (
          <TouchableOpacity
            style={styles.directDashboardBtn}
            onPress={() => onContinueToDashboard && onContinueToDashboard(setupData)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Management Dashboard Directly"
          >
            <Text style={styles.directDashboardBtnText}>Or Enter Dashboard Directly &rarr;</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40
  },
  header: {
    alignItems: 'center',
    marginBottom: 20
  },
  successIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center'
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16
  },
  identityCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: isDark ? '#1f2d1b' : '#f0f6ec',
    borderWidth: 1.5,
    borderColor: isDark ? '#354b2a' : '#cce0c2',
    marginBottom: 20,
    elevation: 2
  },
  companyNameTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2
  },
  founderSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: isDark ? '#304227' : '#d2e4c8',
    marginVertical: 14
  },
  idBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  idBoxLeft: {
    flex: 1,
    marginRight: 10
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 2
  },
  idValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1
  },
  idHelp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: isDark ? '#2e3e26' : '#e2edd9',
    borderWidth: 1,
    borderColor: isDark ? '#425737' : '#c7ddbc'
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 4
  },
  stepsCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 22
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2
  },
  stepNumText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  stepTextWrap: {
    flex: 1
  },
  stepHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2
  },
  stepDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16
  },
  continueBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff'
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.12)' : 'rgba(104, 119, 71, 0.08)',
    borderWidth: 1,
    borderColor: isDark ? '#3d4a34' : '#ccd9c4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4
  },
  safetyDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16
  },
  directDashboardBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 10
  },
  directDashboardBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  }
});
