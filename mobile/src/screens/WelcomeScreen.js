import React, { useState, useEffect } from 'react';
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
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import api from '../services/api';

/**
 * Clean, Simple, and Secure Welcome / Login Screen for EmployeeApp
 * Primary unauthenticated experience:
 * 1. EmployeeApp Branding
 * 2. Role Selector (Management Login vs Employee Login)
 * 3. Minimal, focused Login Form (Company ID, Email/ID, Password, Show/Hide, Forgot Password)
 * 4. Secondary Action: "New company? Register Company"
 */
export default function WelcomeScreen({
  initialPortal = 'employee',
  initialCompanyId = '',
  initialEmail = '',
  onLoginSuccess,
  onRegisterCompany,
  onJoinCompany,
  onSelectOption // for backward compatibility if called as selector
}) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  // Portal selection: 'employee' (default) or 'management'
  const [portal, setPortal] = useState(initialPortal);

  // Form Fields
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

  // Optional Developer Server Configuration (discreet footer)
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(api.baseUrl);

  // Synchronize when initial props change (e.g. returning from registration)
  useEffect(() => {
    if (initialPortal) setPortal(initialPortal);
  }, [initialPortal]);

  useEffect(() => {
    if (initialCompanyId) setCompanyId(initialCompanyId);
  }, [initialCompanyId]);

  useEffect(() => {
    if (initialEmail) setIdentifier(initialEmail);
  }, [initialEmail]);

  const handlePortalSwitch = (newPortal) => {
    setPortal(newPortal);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const isEmployeeIdInput = identifier.trim() && !identifier.includes('@');

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorMessage(
        portal === 'management'
          ? 'Please enter your registered management email or ID, and password.'
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
        err.message || `Unable to reach EMS backend. Please verify connection.`
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

  const isSwitchSuggestion = errorMessage.toLowerCase().includes('switch to');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. App Branding ── */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={32} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>EmployeeApp</Text>
          <Text style={styles.brandSubtitle}>Your workplace, connected.</Text>
        </View>

        {/* ── 2. Role Selection (Segmented Control) ── */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              portal === 'employee' && styles.segmentBtnActive
            ]}
            onPress={() => handlePortalSwitch('employee')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: portal === 'employee' }}
            accessibilityLabel="Employee Login"
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

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              portal === 'management' && styles.segmentBtnActive
            ]}
            onPress={() => handlePortalSwitch('management')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: portal === 'management' }}
            accessibilityLabel="Management Login"
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
        </View>

        {/* Role Helper Indicator */}
        <View style={styles.roleIndicatorPill}>
          <Ionicons
            name={portal === 'management' ? 'briefcase-outline' : 'people-outline'}
            size={13}
            color={colors.primary}
          />
          <Text style={styles.roleIndicatorText}>
            {portal === 'management'
              ? 'Founders, Admins & Team Leaders'
              : 'Enrolled Staff & Team Members'}
          </Text>
        </View>

        {/* ── 3. Clean Login Form Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>
            {portal === 'management' ? 'Management Sign In' : 'Employee Sign In'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {portal === 'management'
              ? 'Access organization dashboards, staff oversight, and policies.'
              : 'Sign in to record attendance, submit tasks, and view history.'}
          </Text>

          {/* Success Banner */}
          {Boolean(successMessage) && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color="#2f855a" style={{ marginRight: 8 }} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* Error Banner with Quick Switch Action */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginTop: 2 }} />
              <View style={styles.errorBody}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {isSwitchSuggestion && (
                  <TouchableOpacity
                    style={styles.switchPromptBtn}
                    onPress={() => handlePortalSwitch(portal === 'management' ? 'employee' : 'management')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.switchPromptText}>
                      Switch to {portal === 'management' ? 'Employee Login' : 'Management Login'} &rarr;
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Field 1: Company ID */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company ID</Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="business-outline"
                size={18}
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
                accessibilityLabel="Company ID"
              />
            </View>
          </View>

          {/* Field 2: Work Email or Employee ID */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {portal === 'management' ? 'Work Email or Management ID' : 'Work Email or Employee ID'}
            </Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name={isEmployeeIdInput ? 'id-card-outline' : 'mail-outline'}
                size={18}
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
                placeholder={
                  portal === 'management'
                    ? 'founder@company.com or FND-0001'
                    : 'you@company.com or EMP-0001'
                }
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                accessibilityLabel="Email or Employee ID"
              />
            </View>
          </View>

          {/* Field 3: Password + Show/Hide */}
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
                accessibilityRole="button"
                accessibilityLabel="Forgot Password"
              >
                <Text style={styles.forgotLinkText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
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
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Field 4: Primary Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={portal === 'management' ? 'Sign In to Management' : 'Sign In as Employee'}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>
                  {portal === 'management' ? 'Sign In to Management' : 'Sign In as Employee'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── 4. Secondary Action: Register Company ── */}
        <View style={styles.footerActions}>
          <View style={styles.registerPromptRow}>
            <Text style={styles.registerPromptText}>New company? </Text>
            <TouchableOpacity
              onPress={() => {
                if (onRegisterCompany) onRegisterCompany();
                else if (onSelectOption) onSelectOption('register_company');
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Register Company"
            >
              <Text style={styles.registerLinkText}>Register Company</Text>
            </TouchableOpacity>
          </View>

          {/* Subtle activation option for invited employees */}
          <View style={styles.joinPromptRow}>
            <Text style={styles.joinPromptText}>Have an invitation code? </Text>
            <TouchableOpacity
              onPress={() => {
                if (onJoinCompany) onJoinCompany();
                else if (onSelectOption) onSelectOption('join_company');
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Activate Account"
            >
              <Text style={styles.joinLinkText}>Activate Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Discreet Developer Server Toggle ── */}
        <TouchableOpacity
          style={styles.serverToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
          activeOpacity={0.7}
        >
          <Ionicons name="server-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.serverToggleText} numberOfLines={1}>
            Server: {api.baseUrl}
          </Text>
          <Ionicons
            name={showServerConfig ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigCard}>
            <Text style={styles.serverConfigLabel}>Backend Server URL</Text>
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
                onPress={() => {
                  if (customServerUrl.trim()) {
                    api.setBaseUrl(customServerUrl.trim());
                    setShowServerConfig(false);
                  }
                }}
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

      {/* ── 5. Zero-Cost Forgot Password Modal ── */}
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
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close recovery dialog"
              >
                <Ionicons name="close" size={24} color={colors.text} />
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
                    <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      placeholder="you@company.com"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, forgotLoading && styles.loginBtnDisabled]}
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
                    <Ionicons name="key-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
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
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
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
                    <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
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
                  style={[styles.modalSubmitBtn, forgotLoading && styles.loginBtnDisabled]}
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
      paddingHorizontal: 22,
      paddingTop: 16,
      paddingBottom: 40
    },
    // Branding
    brandContainer: {
      alignItems: 'center',
      marginBottom: 16
    },
    logoBadge: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      elevation: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 6
    },
    brandTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4
    },
    brandSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
      marginTop: 2
    },
    // Segmented Role Selector
    segmentContainer: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#232b1f' : '#e9eee3',
      borderRadius: 14,
      padding: 4,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? '#333e2c' : '#dbe3d4'
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
      borderRadius: 10,
      gap: 6
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
      elevation: 2,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary
    },
    segmentTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    roleIndicatorPill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(163, 184, 121, 0.14)' : 'rgba(104, 119, 71, 0.1)',
      marginBottom: 14,
      gap: 6
    },
    roleIndicatorText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600'
    },
    // Card Form
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 3,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.25 : 0.06,
      shadowRadius: 8
    },
    cardHeading: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 3
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 16
    },
    successBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1a2e1d' : '#f0fff4',
      borderLeftWidth: 4,
      borderLeftColor: '#38a169',
      padding: 10,
      borderRadius: 8,
      marginBottom: 14
    },
    successText: {
      fontSize: 12,
      color: isDark ? '#81e6d9' : '#276749',
      fontWeight: '600',
      flex: 1
    },
    errorBanner: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fee2e2',
      borderLeftWidth: 4,
      borderLeftColor: '#ef4444',
      padding: 10,
      borderRadius: 8,
      marginBottom: 14,
      gap: 8,
      alignItems: 'flex-start'
    },
    errorBody: {
      flex: 1
    },
    errorText: {
      fontSize: 12,
      color: '#ef4444',
      fontWeight: '600',
      lineHeight: 16
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
      marginBottom: 14
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6
    },
    forgotLinkText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1d2319' : '#f9faf7',
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
      color: colors.text,
      height: '100%'
    },
    eyeBtn: {
      padding: 6
    },
    loginBtn: {
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 6,
      elevation: 3,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 5
    },
    loginBtnDisabled: {
      opacity: 0.65
    },
    loginBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff'
    },
    // Footer Actions
    footerActions: {
      alignItems: 'center',
      marginTop: 20
    },
    registerPromptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10
    },
    registerPromptText: {
      fontSize: 14,
      color: colors.textSecondary
    },
    registerLinkText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary
    },
    joinPromptRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    joinPromptText: {
      fontSize: 12,
      color: colors.textSecondary
    },
    joinLinkText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary
    },
    // Discreet Server Toggle
    serverToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 22,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 6
    },
    serverToggleText: {
      fontSize: 11,
      color: colors.textSecondary,
      maxWidth: 240
    },
    serverConfigCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginTop: 6
    },
    serverConfigLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6
    },
    serverConfigInput: {
      backgroundColor: isDark ? '#1d2319' : '#f9faf7',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 40,
      fontSize: 13,
      color: colors.text,
      marginBottom: 8
    },
    serverActionRow: {
      flexDirection: 'row',
      gap: 8
    },
    serverSaveBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 8,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center'
    },
    serverSaveBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '600'
    },
    serverResetBtn: {
      flex: 1,
      backgroundColor: isDark ? '#333e2c' : '#e5e7eb',
      borderRadius: 8,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center'
    },
    serverResetBtnText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600'
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: 20
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 14
    },
    modalErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fee2e2',
      padding: 8,
      borderRadius: 6,
      marginBottom: 10
    },
    modalErrorText: {
      fontSize: 12,
      color: '#ef4444',
      fontWeight: '600'
    },
    devHintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#23321d' : '#edf4e8',
      marginBottom: 12
    },
    devHintText: {
      fontSize: 12,
      color: colors.primary
    },
    modalSubmitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6
    },
    modalSubmitBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    }
  });
