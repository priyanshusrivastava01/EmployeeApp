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
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import api from '../services/api';

export default function LoginScreen({ onLoginSuccess, onBack, initialPortal = 'management' }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  // Two primary login choices: 'management' vs 'employee'
  const [portal, setPortal] = useState(initialPortal);
  const [identifier, setIdentifier] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(api.baseUrl);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = request, 2 = reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [devResetCodeHint, setDevResetCodeHint] = useState('');

  const isEmployeeIdInput = identifier.trim() && !identifier.includes('@');

  const handlePortalSwitch = (newPortal) => {
    setPortal(newPortal);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorMessage(
        portal === 'management'
          ? 'Please enter your work email (or Founder ID) and password.'
          : 'Please enter your email or Employee ID, and password.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const result = await api.login(
        identifier.trim(),
        password,
        portal,
        companyId.trim() || undefined
      );

      if (result.success && result.user) {
        if (onLoginSuccess) {
          onLoginSuccess(result.user, result.organization, result.token);
        }
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setErrorMessage(
        err.message || `Unable to reach EMS backend at ${api.baseUrl}. Ensure server is running.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid account email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await api.forgotPassword(forgotEmail.trim().toLowerCase());
      if (res.success) {
        if (res.devResetCode) {
          setDevResetCodeHint(res.devResetCode);
          setResetCode(res.devResetCode);
        }
        setForgotStep(2);
      } else {
        setForgotError(res.error || 'Failed to initiate password reset.');
      }
    } catch (err) {
      setForgotError(err.message || 'Network request failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleExecuteReset = async () => {
    if (!resetCode.trim()) {
      setForgotError('Please enter the reset code.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setForgotError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await api.resetPassword({
        email: forgotEmail.trim().toLowerCase(),
        resetCode: resetCode.trim().toUpperCase(),
        newPassword,
        confirmPassword: confirmNewPassword
      });

      if (res.success) {
        setShowForgotModal(false);
        setForgotStep(1);
        setForgotEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setDevResetCodeHint('');
        setSuccessMessage('Password reset successfully! You can now log in.');
      } else {
        setForgotError(res.error || 'Password reset failed.');
      }
    } catch (err) {
      setForgotError(err.message || 'Network request failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSaveServerUrl = () => {
    if (customServerUrl.trim()) {
      api.setBaseUrl(customServerUrl.trim());
      setShowServerConfig(false);
      Alert.alert('Server Configured', `Connected to: ${api.baseUrl}`);
    }
  };

  const isSwitchSuggestion = errorMessage.toLowerCase().includes('switch to');

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
        {/* Top Back Navigation Bar */}
        {Boolean(onBack) && (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={onBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to options"
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>
              {portal === 'management' ? 'Management Portal' : 'Employee Portal'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
        )}

        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={36} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>EMS Enterprise</Text>
          <Text style={styles.brandSubtitle}>Secure Multi-Organization Platform</Text>
        </View>

        {/* ── Segmented Portal Switcher: 2 Choices Only ── */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, portal === 'management' && styles.segmentBtnActive]}
            onPress={() => handlePortalSwitch('management')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={portal === 'management' ? 'shield-checkmark' : 'shield-checkmark-outline'}
              size={18}
              color={portal === 'management' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                portal === 'management' && styles.segmentTextActive
              ]}
            >
              Management Login
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, portal === 'employee' && styles.segmentBtnActive]}
            onPress={() => handlePortalSwitch('employee')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={portal === 'employee' ? 'person' : 'person-outline'}
              size={18}
              color={portal === 'employee' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                portal === 'employee' && styles.segmentTextActive
              ]}
            >
              Employee Login
            </Text>
          </TouchableOpacity>
        </View>

        {/* Portal Explanatory Pill */}
        <View style={styles.portalPill}>
          <Ionicons
            name={portal === 'management' ? 'briefcase-outline' : 'people-outline'}
            size={14}
            color={colors.primary}
          />
          <Text style={styles.portalPillText}>
            {portal === 'management'
              ? 'Founders, Admins & Team Leaders'
              : 'Enrolled Team Members & Employees'}
          </Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>
            {portal === 'management' ? 'Management Sign In' : 'Employee Sign In'}
          </Text>
          <Text style={styles.cardSubtext}>
            {portal === 'management'
              ? 'Enter your registered email and password to access the management dashboard.'
              : 'Sign in with your registered email or Employee ID (e.g. EMP-0001).'}
          </Text>

          {/* Success Banner */}
          {Boolean(successMessage) && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#2f855a" style={{ marginRight: 8 }} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* Error Message with Quick Portal Switcher */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" style={styles.errorIcon} />
              <View style={styles.errorBody}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {isSwitchSuggestion && (
                  <TouchableOpacity
                    style={styles.switchPromptBtn}
                    onPress={() => handlePortalSwitch(portal === 'management' ? 'employee' : 'management')}
                  >
                    <Text style={styles.switchPromptText}>
                      Switch to {portal === 'management' ? 'Employee Login' : 'Management Login'} &rarr;
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 1. Company ID */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company ID</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="business-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={companyId}
                onChangeText={(val) => {
                  setCompanyId(val.toUpperCase());
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="e.g. CMP-7K4M9X2Q"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* 2. Email or Employee ID Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {portal === 'management' ? 'Registered Work Email or Management ID' : 'Work Email or Employee ID'}
            </Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name={isEmployeeIdInput ? 'id-card-outline' : 'mail-outline'}
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={(val) => {
                  setIdentifier(val);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder={portal === 'management' ? 'founder@company.com or FND-0001' : 'you@company.com or EMP-0001'}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowForgotModal(true);
                  setForgotError('');
                  setForgotStep(1);
                  setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotBtnText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Enter password"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>
                  {portal === 'management' ? 'Sign In to Management' : 'Sign In as Employee'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Server & Network Status Footer */}
        <TouchableOpacity
          style={styles.serverToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
          activeOpacity={0.7}
        >
          <Ionicons name="wifi-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.serverToggleText} numberOfLines={1}>
            Server: {api.baseUrl}
          </Text>
          <Ionicons
            name={showServerConfig ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigCard}>
            <Text style={styles.serverConfigLabel}>Backend Server URL</Text>
            <Text style={styles.serverConfigHint}>
              Use your host PC LAN IP when testing on a physical phone:
            </Text>
            <TextInput
              style={styles.serverConfigInput}
              value={customServerUrl}
              onChangeText={setCustomServerUrl}
              placeholder="e.g. http://192.168.31.113:5000"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.serverActionRow}>
              <TouchableOpacity
                style={styles.serverSaveBtn}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.serverSaveBtnText}>Save URL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.serverResetBtn}
                onPress={() => {
                  setCustomServerUrl('http://192.168.31.113:5000');
                  api.setBaseUrl('http://192.168.31.113:5000');
                  setShowServerConfig(false);
                }}
              >
                <Text style={styles.serverResetBtnText}>Reset to LAN</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Forgot Password Modal ── */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Password Recovery</Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {Boolean(forgotError) && (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.modalErrorText}>{forgotError}</Text>
              </View>
            )}

            {forgotStep === 1 ? (
              <View>
                <Text style={styles.modalSubtitle}>
                  Enter the email address registered with your account to receive a secure recovery code.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      placeholder="you@company.com"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, forgotLoading && styles.loginButtonDisabled]}
                  onPress={handleRequestReset}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Send Recovery Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.modalSubtitle}>
                  Enter the recovery code sent for {forgotEmail} and choose a new password.
                </Text>

                {Boolean(devResetCodeHint) && (
                  <View style={styles.devHintBox}>
                    <Ionicons name="code-slash" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.devHintText}>
                      Zero-Cost Mode Code: <Text style={{ fontWeight: '800' }}>{devResetCodeHint}</Text>
                    </Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Reset Code</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={resetCode}
                      onChangeText={(t) => setResetCode(t.toUpperCase())}
                      placeholder="e.g. RST-XXXXXX"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Min 8 characters"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      placeholder="Re-enter password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, forgotLoading && styles.loginButtonDisabled]}
                  onPress={handleExecuteReset}
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSubmitBtnText}>Set New Password & Return</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12
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
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary
    },
    brandContainer: {
      alignItems: 'center',
      marginBottom: 16
    },
    logoBadge: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6
    },
    brandTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: -0.5
    },
    brandSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2
    },
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
      borderRadius: 14,
      padding: 4,
      marginBottom: 10
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      gap: 6
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary
    },
    segmentTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    portalPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(78, 93, 73, 0.25)' : 'rgba(107, 124, 89, 0.12)',
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginBottom: 16,
      alignSelf: 'center',
      gap: 6
    },
    portalPillText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600'
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 10,
      elevation: 3
    },
    cardHeader: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4
    },
    cardSubtext: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 16
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#f0fff4',
      borderLeftWidth: 4,
      borderLeftColor: '#38a169',
      padding: 12,
      borderRadius: 8,
      marginBottom: 14
    },
    successText: {
      fontSize: 13,
      color: '#276749',
      fontWeight: '600',
      flex: 1
    },
    errorBanner: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
      borderLeftWidth: 4,
      borderLeftColor: '#ef4444',
      padding: 12,
      borderRadius: 10,
      marginBottom: 16,
      alignItems: 'flex-start',
      gap: 10
    },
    errorIcon: {
      marginTop: 2
    },
    errorBody: {
      flex: 1
    },
    errorText: {
      fontSize: 13,
      color: '#ef4444',
      fontWeight: '600',
      lineHeight: 18
    },
    switchPromptBtn: {
      marginTop: 6
    },
    switchPromptText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '700'
    },
    inputGroup: {
      marginBottom: 16
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8
    },
    forgotBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary
    },
    fieldHelp: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      marginLeft: 4
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground || (isDark ? '#1f2937' : '#f9fafb'),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 48
    },
    inputIcon: {
      marginRight: 10
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      height: '100%'
    },
    eyeBtn: {
      padding: 6
    },
    loginButton: {
      backgroundColor: colors.primary,
      height: 50,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 6,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4
    },
    loginButtonDisabled: {
      opacity: 0.6
    },
    loginButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff'
    },
    serverToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 12,
      gap: 6
    },
    serverToggleText: {
      fontSize: 12,
      color: colors.textSecondary,
      maxWidth: 240
    },
    serverConfigCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
      marginTop: 8
    },
    serverConfigLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4
    },
    serverConfigHint: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 10
    },
    serverConfigInput: {
      backgroundColor: colors.inputBackground || (isDark ? '#1f2937' : '#f9fafb'),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 42,
      fontSize: 13,
      color: colors.textPrimary,
      marginBottom: 10
    },
    serverActionRow: {
      flexDirection: 'row',
      gap: 10
    },
    serverSaveBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center'
    },
    serverSaveBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '600'
    },
    serverResetBtn: {
      flex: 1,
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      borderRadius: 10,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center'
    },
    serverResetBtnText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600'
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    modalSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 16
    },
    modalErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fee2e2',
      padding: 10,
      borderRadius: 8,
      marginBottom: 12
    },
    modalErrorText: {
      fontSize: 12,
      color: '#ef4444',
      fontWeight: '600'
    },
    devHintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 8,
      backgroundColor: isDark ? '#23321d' : '#edf4e8',
      marginBottom: 14
    },
    devHintText: {
      fontSize: 12,
      color: colors.primary
    },
    modalSubmitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 46,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8
    },
    modalSubmitBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    }
  });
