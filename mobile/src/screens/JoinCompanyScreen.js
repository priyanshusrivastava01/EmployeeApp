import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import api from '../services/api';

export default function JoinCompanyScreen({ onBack, onJoinSuccess }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [companyId, setCompanyId] = useState('');
  const [employeeIdOrEmail, setEmployeeIdOrEmail] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async () => {
    if (!companyId.trim()) {
      setErrorMessage('Please enter the Company ID provided by your employer (e.g., CMP-7K4M9X2Q).');
      return;
    }
    if (!employeeIdOrEmail.trim()) {
      setErrorMessage('Please enter your Employee ID (e.g., EMP-0001) or registered work email.');
      return;
    }
    if (!invitationCode.trim()) {
      setErrorMessage('Please enter your invitation code (e.g., INV-XXXXXX).');
      return;
    }
    if (!password) {
      setErrorMessage('Please create a password for your account.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const payload = {
        companyId: companyId.trim().toUpperCase(),
        employeeIdOrEmail: employeeIdOrEmail.trim(),
        invitationCode: invitationCode.trim().toUpperCase(),
        password,
        confirmPassword
      };

      const res = await api.joinCompany(payload);
      if (res.success && res.user) {
        if (onJoinSuccess) {
          onJoinSuccess(res.user, res.organization, res.token);
        }
      } else {
        setErrorMessage(res.error || 'Failed to activate account. Please check the supplied credentials.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to connect to server. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to Welcome screen"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Join Existing Company</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.introIconBadge}>
            <Ionicons name="mail-open" size={28} color="#ffffff" />
          </View>
          <View style={styles.introTextWrap}>
            <Text style={styles.introTitle}>Activate Your Employee Account</Text>
            <Text style={styles.introSubtitle}>
              Enter the Company ID and invitation code provided by your Founder or Administrator to activate your account and choose your password.
            </Text>
          </View>
        </View>

        {/* Error Alert Banner */}
        {Boolean(errorMessage) && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color="#e53e3e" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Company ID <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., CMP-7K4M9X2Q"
              placeholderTextColor={colors.textSecondary}
              value={companyId}
              onChangeText={(t) => setCompanyId(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.fieldHelp}>Ask your company admin for your organization's unique Company ID.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Employee ID or Registered Email <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., EMP-0001 or name@company.com"
              placeholderTextColor={colors.textSecondary}
              value={employeeIdOrEmail}
              onChangeText={setEmployeeIdOrEmail}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Invitation Code <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., INV-8X2K9Q"
              placeholderTextColor={colors.textSecondary}
              value={invitationCode}
              onChangeText={(t) => setInvitationCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.fieldHelp}>Single-use code issued by your company administrator.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Create Password <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Minimum 8 characters"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Confirm Password <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Activate Account & Enter App</Text>
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.safeNote}>
          <Ionicons name="shield-checkmark" size={14} color={colors.textSecondary} />
          <Text style={styles.safeNoteText}>
            Activation tokens are single-use and expire in 7 days from issuance.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#263321' : '#eef4ea',
    justifyContent: 'center',
    alignItems: 'center'
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text
  },
  introCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    backgroundColor: isDark ? '#1f2d1b' : '#edf5ea',
    borderWidth: 1.5,
    borderColor: isDark ? '#354b2a' : '#cee2c4',
    alignItems: 'center',
    marginBottom: 20
  },
  introIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  introTextWrap: {
    flex: 1
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  introSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#feb2b2',
    marginBottom: 16
  },
  errorText: {
    fontSize: 13,
    color: '#c53030',
    fontWeight: '600',
    flex: 1
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6
  },
  required: {
    color: '#e53e3e'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text
  },
  eyeBtn: {
    padding: 6
  },
  fieldHelp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 4
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  submitBtnDisabled: {
    opacity: 0.7
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff'
  },
  safeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14
  },
  safeNoteText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 6
  }
});
