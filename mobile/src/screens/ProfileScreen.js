import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { mockProfile, mockOfficeGeofence } from '../data/mockEmployeeData';
import { getRegistrationStatus } from '../services/photoRegistrationService';
import {
  getProfilePhoto,
  saveProfilePhoto,
  removeProfilePhoto,
  pickProfilePhotoFromLibrary,
  takeProfilePhotoWithCamera
} from '../services/profilePhotoService';
import api from '../services/api';

const NOTIF_PREF_KEY = '@ems_notifications_enabled';

export default function ProfileScreen({ onLogout, onNavigate, currentUser, currentOrg }) {
  const { colors, isDark, preference, setPreference } = useTheme();
  const styles = getStyles(colors, isDark);

  // Appearance & Settings Modals
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  // Notifications preference
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Profile Photo States
  const [profilePhotoUri, setProfilePhotoUri] = useState(null);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);
  const [pendingPreviewUri, setPendingPreviewUri] = useState(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);

  // Edit Profile (Personal Info Updates)
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editFieldName, setEditFieldName] = useState('phone'); // 'phone' or 'address'
  const [editFieldValue, setEditFieldValue] = useState('');
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [updateRequests, setUpdateRequests] = useState([]);

  // Salary & Bank Details
  const [bankDetails, setBankDetails] = useState(null);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankHolderName, setBankHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankConfirmAccount, setBankConfirmAccount] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankAccountType, setBankAccountType] = useState('Savings');
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [bankFormError, setBankFormError] = useState(null);

  // Biometric status
  const [biometricInfo, setBiometricInfo] = useState({
    isRegistered: false,
    status: 'Checking...',
    photos: null
  });

  // Load saved profile photo, preferences, bank details, update requests
  const loadProfilePhoto = async () => {
    try {
      const saved = await getProfilePhoto();
      if (saved && saved.uri) {
        setProfilePhotoUri(saved.uri);
      } else {
        setProfilePhotoUri(null);
      }
    } catch (e) {
      console.warn('Failed to load profile photo:', e);
    }
  };

  const loadPreferences = async () => {
    try {
      const savedNotif = await AsyncStorage.getItem(NOTIF_PREF_KEY);
      if (savedNotif !== null) {
        setNotificationsEnabled(savedNotif === 'true');
      }
    } catch (e) {
      // non-fatal
    }
  };

  const loadBankDetails = async () => {
    try {
      const res = await api.getBankDetails();
      if (res && res.success && res.data) {
        setBankDetails(res.data);
      }
    } catch (e) {
      console.warn('Failed to load bank details:', e);
    }
  };

  const loadUpdateRequests = async () => {
    try {
      const res = await api.getProfileUpdateRequests();
      if (res && res.success && res.data) {
        setUpdateRequests(res.data);
      }
    } catch (e) {
      console.warn('Failed to load update requests:', e);
    }
  };

  const checkBiometrics = async () => {
    try {
      const res = await getRegistrationStatus();
      setBiometricInfo(res);
    } catch (err) {
      console.warn('Biometric status check failed:', err);
    }
  };

  useEffect(() => {
    loadProfilePhoto();
    loadPreferences();
    loadBankDetails();
    loadUpdateRequests();
    checkBiometrics();
  }, []);

  const handleToggleNotifications = async (val) => {
    setNotificationsEnabled(val);
    try {
      await AsyncStorage.setItem(NOTIF_PREF_KEY, val ? 'true' : 'false');
    } catch (e) {
      // non-fatal
    }
  };

  // Photo handlers
  const handlePickFromGallery = async () => {
    try {
      setIsPhotoLoading(true);
      const uri = await pickProfilePhotoFromLibrary();
      setIsPhotoLoading(false);
      if (uri) {
        setPendingPreviewUri(uri);
        setPhotoPickerVisible(false);
      }
    } catch (err) {
      setIsPhotoLoading(false);
      Alert.alert('Gallery Permission', err.message || 'Could not select photo from gallery.');
    }
  };

  const handleCaptureWithCamera = async () => {
    try {
      setIsPhotoLoading(true);
      const uri = await takeProfilePhotoWithCamera();
      setIsPhotoLoading(false);
      if (uri) {
        setPendingPreviewUri(uri);
        setPhotoPickerVisible(false);
      }
    } catch (err) {
      setIsPhotoLoading(false);
      Alert.alert('Camera Permission', err.message || 'Could not capture photo with camera.');
    }
  };

  const handleApplyPendingPhoto = async () => {
    if (!pendingPreviewUri) return;
    try {
      setIsPhotoLoading(true);
      const saved = await saveProfilePhoto(pendingPreviewUri);
      setProfilePhotoUri(saved.uri);
      // Sync photo url with backend
      await api.updateProfilePhoto(saved.uri);
      setPendingPreviewUri(null);
      setIsPhotoLoading(false);
      Alert.alert('Profile Photo Updated', 'Your employee profile photo has been updated successfully.');
    } catch (err) {
      setIsPhotoLoading(false);
      Alert.alert('Save Failed', 'Unable to save profile photo: ' + err.message);
    }
  };

  const handleRemovePhoto = async () => {
    Alert.alert(
      'Remove Profile Photo',
      'Are you sure you want to remove your profile photo and revert to the default avatar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeProfilePhoto();
              setProfilePhotoUri(null);
              setPhotoPickerVisible(false);
            } catch (err) {
              Alert.alert('Error', 'Failed to remove photo.');
            }
          }
        }
      ]
    );
  };

  // Profile update request submit
  const handleOpenEditProfile = () => {
    setEditFieldName('phone');
    setEditFieldValue(currentUser?.phone || mockProfile.phone || '');
    setEditProfileModalVisible(true);
  };

  const handleSubmitProfileUpdate = async () => {
    if (!editFieldValue.trim()) {
      Alert.alert('Required Field', 'Please enter a value for the selected field.');
      return;
    }

    try {
      setIsSubmittingUpdate(true);
      const res = await api.submitProfileUpdateRequest(
        editFieldName,
        editFieldValue.trim(),
        editFieldName === 'phone' ? (currentUser?.phone || '') : ''
      );

      setIsSubmittingUpdate(false);
      if (res.success) {
        Alert.alert(
          'Request Submitted',
          `Your request to update ${editFieldName === 'phone' ? 'phone number' : 'residential address'} has been submitted for HR review.`
        );
        setEditProfileModalVisible(false);
        loadUpdateRequests();
      } else {
        Alert.alert('Submission Error', res.error || 'Failed to submit update request.');
      }
    } catch (err) {
      setIsSubmittingUpdate(false);
      Alert.alert('Error', err.message || 'Network error.');
    }
  };

  // Bank Details handlers
  const handleOpenBankModal = () => {
    setBankFormError(null);
    if (bankDetails) {
      setBankHolderName(bankDetails.accountHolderName || '');
      setBankName(bankDetails.bankName || '');
      setBankAccountNumber('');
      setBankConfirmAccount('');
      setBankIfscCode(bankDetails.ifscCode || '');
      setBankAccountType(bankDetails.accountType || 'Savings');
    } else {
      setBankHolderName(currentUser?.name || mockProfile.name || '');
      setBankName('');
      setBankAccountNumber('');
      setBankConfirmAccount('');
      setBankIfscCode('');
      setBankAccountType('Savings');
    }
    setBankModalVisible(true);
  };

  const handleSubmitBankDetails = async () => {
    setBankFormError(null);

    if (!bankHolderName.trim()) {
      setBankFormError('Account holder name is required.');
      return;
    }
    if (!bankName.trim()) {
      setBankFormError('Bank name is required.');
      return;
    }
    if (!bankAccountNumber.trim() || !bankConfirmAccount.trim()) {
      setBankFormError('Account number and confirmation are required.');
      return;
    }
    if (bankAccountNumber.trim() !== bankConfirmAccount.trim()) {
      setBankFormError('Account number and confirm account number do not match.');
      return;
    }
    const cleanAcc = bankAccountNumber.replace(/\s+/g, '');
    if (!/^\d{9,18}$/.test(cleanAcc)) {
      setBankFormError('Please enter a valid bank account number (9 to 18 digits).');
      return;
    }

    const cleanIfsc = bankIfscCode.trim().toUpperCase();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(cleanIfsc)) {
      setBankFormError('Invalid IFSC code. Format: 4 letters, 0, 6 characters (e.g. SBIN0001234).');
      return;
    }

    try {
      setIsSubmittingBank(true);
      const res = await api.submitBankDetails({
        accountHolderName: bankHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber: cleanAcc,
        confirmAccountNumber: cleanAcc,
        ifscCode: cleanIfsc,
        accountType: bankAccountType
      });

      setIsSubmittingBank(false);
      if (res.success && res.data) {
        setBankDetails(res.data);
        setBankModalVisible(false);
        Alert.alert(
          'Bank Details Submitted',
          'Your bank details have been saved securely. Verification is now Pending Review by company management.'
        );
      } else {
        setBankFormError(res.error || 'Failed to submit bank details.');
      }
    } catch (err) {
      setIsSubmittingBank(false);
      setBankFormError(err.message || 'Failed to submit bank details.');
    }
  };

  const getPreferenceLabel = () => {
    if (preference === 'light') return 'Light (Olive & Cream)';
    if (preference === 'dark') return 'Dark (Sleek Contrast)';
    return 'System Default (Auto-Switch)';
  };

  const appearanceOptions = [
    {
      id: 'system',
      title: 'System Default',
      subtitle: 'Adapts automatically to your Android system appearance',
      icon: 'phone-portrait-outline'
    },
    {
      id: 'light',
      title: 'Light Theme',
      subtitle: 'Classic signature olive-green and warm cream palette',
      icon: 'sunny-outline'
    },
    {
      id: 'dark',
      title: 'Dark Theme',
      subtitle: 'Deep olive charcoal with high-contrast night aesthetics',
      icon: 'moon-outline'
    }
  ];

  const avatarUri = profilePhotoUri || currentUser?.profile_photo_url || mockProfile.avatar;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================================== */}
      {/* 1. HEADER PROFILE CARD */}
      {/* ============================================================== */}
      <View style={styles.headerCard}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <TouchableOpacity
              style={styles.avatarBadgeBtn}
              onPress={() => setPhotoPickerVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Change profile photo"
            >
              <Ionicons name="camera" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.changePhotoBtn}
            onPress={() => setPhotoPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="image-outline" size={14} color={colors.primary} />
            <Text style={styles.changePhotoBtnText}>Update Photo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.profileName}>{currentUser?.name || mockProfile.name}</Text>
        <Text style={styles.profileDesignation}>{currentUser?.designation || mockProfile.designation}</Text>
        <Text style={styles.profileDept}>{currentUser?.department || mockProfile.department}</Text>
        <Text style={styles.profileEmail}>{currentUser?.email || mockProfile.email}</Text>

        <View style={styles.headerMetaRow}>
          <View style={styles.idChip}>
            <Ionicons name="card-outline" size={12} color={colors.primary} />
            <Text style={styles.idChipText}>
              ID: {currentUser?.employee_id_number || currentUser?.employeeId || mockProfile.employeeId}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipText}>Active • On-Roll</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.editProfileBtn}
          onPress={handleOpenEditProfile}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={15} color={colors.primary} />
          <Text style={styles.editProfileBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================== */}
      {/* 2. SALARY & BANK DETAILS (ISSUE 5) */}
      {/* ============================================================== */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="card" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Salary & Bank Details</Text>
              <Text style={styles.cardSubtitle}>Verified payroll account records</Text>
            </View>
          </View>

          {bankDetails && (
            <View style={[
              styles.statusBadge,
              bankDetails.status === 'Verified'
                ? styles.badgeSuccess
                : (bankDetails.status === 'Rejected' ? styles.badgeDanger : styles.badgePending)
            ]}>
              <Text style={[
                styles.statusBadgeText,
                bankDetails.status === 'Verified'
                  ? styles.textSuccess
                  : (bankDetails.status === 'Rejected' ? styles.textDanger : styles.textPending)
              ]}>
                {bankDetails.status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {bankDetails ? (
          <View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Holder</Text>
              <Text style={styles.detailValue}>{bankDetails.accountHolderName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank Name</Text>
              <Text style={styles.detailValue}>{bankDetails.bankName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Number</Text>
              <Text style={[styles.detailValue, { fontWeight: '700', letterSpacing: 1 }]}>
                {bankDetails.accountNumberMasked}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IFSC Code</Text>
              <Text style={[styles.detailValue, { color: colors.primary, fontWeight: '700' }]}>
                {bankDetails.ifscCode}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Type</Text>
              <Text style={styles.detailValue}>{bankDetails.accountType || 'Savings'}</Text>
            </View>

            {bankDetails.rejectionReason && (
              <View style={[styles.disclaimerBox, { borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FBEBEB' }]}>
                <Ionicons name="alert-circle" size={15} color="#EF4444" />
                <Text style={[styles.disclaimerText, { color: '#EF4444' }]}>
                  Rejection Reason: {bankDetails.rejectionReason}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.actionOutlineBtn}
              onPress={handleOpenBankModal}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={14} color={colors.primary} />
              <Text style={styles.actionOutlineBtnText}>Update Bank Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Ionicons name="wallet-outline" size={36} color={colors.textSecondary} style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 12 }}>
              No bank account submitted for salary disbursements.
            </Text>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={handleOpenBankModal}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
              <Text style={styles.primaryActionBtnText}>Add Salary Bank Details</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ============================================================== */}
      {/* 3. WORK & OFFICIAL DETAILS */}
      {/* ============================================================== */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Official Employment Records</Text>
              <Text style={styles.cardSubtitle}>Managed strictly by Company HR Administration</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Employee ID</Text>
          <Text style={styles.detailValue}>
            {currentUser?.employee_id_number || currentUser?.employeeId || mockProfile.employeeId}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Company Workspace</Text>
          <Text style={styles.detailValue}>{currentOrg?.name || 'Acme Technologies Pvt. Ltd.'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Company ID</Text>
          <Text style={[styles.detailValue, { fontWeight: '700', color: colors.primary }]}>
            {currentOrg?.public_company_id || currentUser?.companyId || 'CMP-7K4M9X2Q'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Designation</Text>
          <Text style={styles.detailValue}>{currentUser?.designation || mockProfile.designation}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Department</Text>
          <Text style={styles.detailValue}>{currentUser?.department || mockProfile.department}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Employment Status</Text>
          <Text style={[styles.detailValue, { color: colors.primary, fontWeight: '800' }]}>Active • On-Roll</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Official Email</Text>
          <Text style={styles.detailValue}>{currentUser?.email || mockProfile.email}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Work Phone</Text>
          <Text style={styles.detailValue}>{currentUser?.phone || mockProfile.phone || 'Not configured'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Work Mode</Text>
          <Text style={styles.detailValue}>Hybrid (WFO / WFH)</Text>
        </View>

        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.detailLabel}>Assigned Campus</Text>
          <Text style={styles.detailValue}>
            {currentOrg?.name ? `${currentOrg.name} (${currentOrg.city || 'HQ'})` : mockOfficeGeofence.name}
          </Text>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 4. SETTINGS & PREFERENCES (ISSUE 3) */}
      {/* ============================================================== */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.cardTitle}>Settings & Preferences</Text>
              <Text style={styles.cardSubtitle}>Appearance, notifications & privacy controls</Text>
            </View>
          </View>
        </View>

        {/* 1. Theme / Appearance */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setAppearanceModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.settingIconBox}>
            <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Appearance & Theme</Text>
            <Text style={styles.settingDesc}>{getPreferenceLabel()}</Text>
          </View>
          <View style={styles.settingsPill}>
            <Text style={styles.settingsPillText}>Change</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* 2. Push & Shift Notifications */}
        <View style={styles.settingsRow}>
          <View style={styles.settingIconBox}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Push & Shift Reminders</Text>
            <Text style={styles.settingDesc}>Punch reminders and announcements</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {/* 3. Privacy Information */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setPrivacyModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.settingIconBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Data Privacy & Protection</Text>
            <Text style={styles.settingDesc}>Strict multi-tenant security & geofence rules</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* 4. Application Version */}
        <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingIconBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Application Version</Text>
            <Text style={styles.settingDesc}>EmployeeApp v3.2.0 • Build 202610</Text>
          </View>
          <View style={styles.tagVersion}>
            <Text style={styles.tagVersionText}>Latest</Text>
          </View>
        </View>
      </View>

      {/* ============================================================== */}
      {/* 5. ACCOUNT ACTIONS */}
      {/* ============================================================== */}
      <View style={styles.accountActionsSection}>
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setHelpModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.helpBtnText}>Help & Support Desk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={onLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Sign Out of Mobile App</Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================== */}
      {/* MODAL: PROFILE PHOTO PICKER */}
      {/* ============================================================== */}
      <Modal
        visible={photoPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="image-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Employee Profile Photo</Text>
              </View>
              <TouchableOpacity onPress={() => setPhotoPickerVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select a professional employee portrait for company directory identification.
            </Text>

            {isPhotoLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>Processing photo...</Text>
              </View>
            ) : (
              <View style={styles.photoActionsList}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickFromGallery} activeOpacity={0.8}>
                  <Ionicons name="images-outline" size={20} color={colors.primary} />
                  <Text style={styles.photoActionBtnText}>Choose from Photo Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.photoActionBtn} onPress={handleCaptureWithCamera} activeOpacity={0.8}>
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                  <Text style={styles.photoActionBtnText}>Take New Photo with Camera</Text>
                </TouchableOpacity>

                {profilePhotoUri && (
                  <TouchableOpacity
                    style={[styles.photoActionBtn, { borderColor: '#EF4444' }]}
                    onPress={handleRemovePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text style={[styles.photoActionBtnText, { color: '#EF4444' }]}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: PREVIEW SELECTED PHOTO */}
      {/* ============================================================== */}
      <Modal
        visible={!!pendingPreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPreviewUri(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="eye-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Preview Profile Photo</Text>
              </View>
              <TouchableOpacity onPress={() => setPendingPreviewUri(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.previewImageContainer}>
              {pendingPreviewUri && (
                <Image source={{ uri: pendingPreviewUri }} style={styles.previewLargeAvatar} />
              )}
            </View>

            <View style={styles.previewButtonsRow}>
              <TouchableOpacity
                style={styles.previewCancelBtn}
                onPress={() => setPendingPreviewUri(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.previewCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.previewApplyBtn}
                onPress={handleApplyPendingPhoto}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                <Text style={styles.previewApplyBtnText}>Apply Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: APPEARANCE SETTINGS (3 THEMES: SYSTEM, LIGHT, DARK) */}
      {/* ============================================================== */}
      <Modal
        visible={appearanceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Appearance & Theme</Text>
              </View>
              <TouchableOpacity onPress={() => setAppearanceModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select your appearance preference. Stored persistently on your device.
            </Text>

            <View style={styles.optionsList}>
              {appearanceOptions.map(opt => {
                const isSelected = preference === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => setPreference(opt.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionIconBox, isSelected && styles.optionIconBoxSelected]}>
                      <Ionicons
                        name={opt.icon}
                        size={20}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                    </View>

                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                        {opt.title}
                      </Text>
                      <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                    </View>

                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setAppearanceModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: EDIT PROFILE / PERSONAL CONTACT REQUEST (ISSUE 4) */}
      {/* ============================================================== */}
      <Modal
        visible={editProfileModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Edit Profile Contact</Text>
              </View>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Request updates to your contact phone or address. Official employment details (Role, Designation, Department, Employee ID) remain managed by HR.
            </Text>

            {/* Field Selector */}
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
              <TouchableOpacity
                style={[styles.choicePill, editFieldName === 'phone' && styles.choicePillActive]}
                onPress={() => {
                  setEditFieldName('phone');
                  setEditFieldValue(currentUser?.phone || mockProfile.phone || '');
                }}
              >
                <Text style={[styles.choicePillText, editFieldName === 'phone' && styles.choicePillTextActive]}>
                  Phone Number
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choicePill, editFieldName === 'address' && styles.choicePillActive]}
                onPress={() => {
                  setEditFieldName('address');
                  setEditFieldValue('');
                }}
              >
                <Text style={[styles.choicePillText, editFieldName === 'address' && styles.choicePillTextActive]}>
                  Residential Address
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>
              New {editFieldName === 'phone' ? 'Phone Number' : 'Residential Address'}
            </Text>
            <TextInput
              style={[styles.input, editFieldName === 'address' && { height: 70, textAlignVertical: 'top' }]}
              placeholder={editFieldName === 'phone' ? '+91 98765 43210' : 'Your current residential address...'}
              placeholderTextColor={colors.textSecondary}
              value={editFieldValue}
              onChangeText={setEditFieldValue}
              keyboardType={editFieldName === 'phone' ? 'phone-pad' : 'default'}
              multiline={editFieldName === 'address'}
            />

            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 14 }]}
              onPress={handleSubmitProfileUpdate}
              disabled={isSubmittingUpdate}
              activeOpacity={0.8}
            >
              {isSubmittingUpdate ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.primaryActionBtnText}>Submit Update Request</Text>
              )}
            </TouchableOpacity>

            {/* History of update requests */}
            {updateRequests.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                  Recent Update Requests
                </Text>
                {updateRequests.slice(0, 3).map(req => (
                  <View key={req.id} style={styles.requestHistoryCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>
                        {req.field_name} Update
                      </Text>
                      <Text style={[
                        styles.statusBadgeText,
                        req.status === 'Approved' ? styles.textSuccess : (req.status === 'Rejected' ? styles.textDanger : styles.textPending)
                      ]}>
                        {req.status}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                      Value: {req.new_value}
                    </Text>
                    {req.rejection_reason && (
                      <Text style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>
                        Note: {req.rejection_reason}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: SALARY & BANK DETAILS FORM (ISSUE 5) */}
      {/* ============================================================== */}
      <Modal
        visible={bankModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} style={{ width: '100%' }}>
            <View style={[styles.modalCard, { width: '92%', maxWidth: 420, alignSelf: 'center' }]}>
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalTitleWrap}>
                  <Ionicons name="card-outline" size={20} color={colors.primary} />
                  <Text style={styles.modalTitle}>Salary & Bank Account</Text>
                </View>
                <TouchableOpacity onPress={() => setBankModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                Enter your official bank details for salary disbursements. Account numbers are masked and verified by company payroll management.
              </Text>

              {bankFormError && (
                <View style={[styles.disclaimerBox, { borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FBEBEB', marginBottom: 10 }]}>
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={[styles.disclaimerText, { color: '#EF4444' }]}>{bankFormError}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Account Holder Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name as in bank account"
                placeholderTextColor={colors.textSecondary}
                value={bankHolderName}
                onChangeText={setBankHolderName}
              />

              <Text style={styles.inputLabel}>Bank Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. State Bank of India, HDFC, ICICI"
                placeholderTextColor={colors.textSecondary}
                value={bankName}
                onChangeText={setBankName}
              />

              <Text style={styles.inputLabel}>Account Number * (9 to 18 digits)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter bank account number"
                placeholderTextColor={colors.textSecondary}
                value={bankAccountNumber}
                onChangeText={setBankAccountNumber}
                keyboardType="numeric"
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Confirm Account Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter bank account number"
                placeholderTextColor={colors.textSecondary}
                value={bankConfirmAccount}
                onChangeText={setBankConfirmAccount}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>IFSC Code * (Indian Standard format)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. SBIN0001234"
                placeholderTextColor={colors.textSecondary}
                value={bankIfscCode}
                onChangeText={t => setBankIfscCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={11}
              />

              <Text style={styles.inputLabel}>Account Type</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {['Savings', 'Current'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.choicePill, bankAccountType === type && styles.choicePillActive]}
                    onPress={() => setBankAccountType(type)}
                  >
                    <Text style={[styles.choicePillText, bankAccountType === type && styles.choicePillTextActive]}>
                      {type} Account
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.disclaimerBox}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.primary} />
                <Text style={styles.disclaimerText}>
                  Zero-cost secure persistence: Bank records are masked (XXXXXX1234) and accessible only to authorized payroll personnel.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, { marginTop: 12 }]}
                onPress={handleSubmitBankDetails}
                disabled={isSubmittingBank}
                activeOpacity={0.8}
              >
                {isSubmittingBank ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Save & Submit for Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: PRIVACY POLICY */}
      {/* ============================================================== */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Data Privacy & Isolation</Text>
              </View>
              <TouchableOpacity onPress={() => setPrivacyModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 10 }}>
                <Text style={{ fontWeight: '700' }}>Organization Isolation:</Text> Your attendance, task reports, leave applications, and bank details are strictly isolated to your verified company workspace.
              </Text>
              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18, marginBottom: 10 }}>
                <Text style={{ fontWeight: '700' }}>Biometrics & Camera Privacy:</Text> Attendance selfies are taken solely via the front-facing camera for shift verification stamps. They are never sold or shared with third-party tracking services.
              </Text>
              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
                <Text style={{ fontWeight: '700' }}>Financial Security:</Text> Bank account numbers are masked and never exposed in clear text logs.
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setPrivacyModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================================== */}
      {/* MODAL: HELP & SUPPORT DESK */}
      {/* ============================================================== */}
      <Modal
        visible={helpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="help-buoy-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Help & Support Desk</Text>
              </View>
              <TouchableOpacity onPress={() => setHelpModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Need assistance with attendance, GPS geofencing, or payroll requests? Contact your internal company support team.
            </Text>

            <View style={{ gap: 10, marginVertical: 14 }}>
              <View style={styles.supportContactCard}>
                <Ionicons name="mail-outline" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.supportContactTitle}>Company IT & HR Help Desk</Text>
                  <Text style={styles.supportContactValue}>{currentOrg?.contact_email || 'support@acmetech.com'}</Text>
                </View>
              </View>
              <View style={styles.supportContactCard}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <View>
                  <Text style={styles.supportContactTitle}>HR Emergency Line</Text>
                  <Text style={styles.supportContactValue}>{currentOrg?.contact_phone || '+91 98765 00001'}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setHelpModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
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
    padding: 16,
    paddingBottom: 110
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.25 : 0.05,
    shadowRadius: 8,
    elevation: 3
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 12
  },
  avatarWrapper: {
    position: 'relative'
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.lightOlive
  },
  avatarBadgeBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.12)' : colors.lightOlive,
    borderRadius: 12
  },
  changePhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center'
  },
  profileDesignation: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
    textAlign: 'center'
  },
  profileDept: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center'
  },
  profileEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center'
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12
  },
  idChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.beige,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  idChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.15)' : colors.lightOlive,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  editProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.2 : 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.15)' : colors.lightOlive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  cardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  detailValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  badgeSuccess: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : colors.lightOlive
  },
  badgePending: {
    backgroundColor: '#FAF4E8'
  },
  badgeDanger: {
    backgroundColor: '#FBEBEB'
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  textSuccess: {
    color: colors.darkOlive
  },
  textPending: {
    color: '#C28424'
  },
  textDanger: {
    color: '#C0392B'
  },
  actionOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.beige
  },
  actionOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginTop: 8
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  settingIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center'
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  settingDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  settingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.beige,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  settingsPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary
  },
  tagVersion: {
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  tagVersionText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.darkOlive
  },
  accountActionsSection: {
    gap: 12,
    marginTop: 4,
    marginBottom: 16
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  helpBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.danger
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 16
  },
  modalCloseBtn: {
    padding: 4
  },
  photoActionsList: {
    gap: 10
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  photoActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  previewImageContainer: {
    alignItems: 'center',
    marginVertical: 16
  },
  previewLargeAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: colors.primary
  },
  previewButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  previewCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.beige
  },
  previewCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary
  },
  previewApplyBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary
  },
  previewApplyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },
  optionsList: {
    gap: 8,
    marginVertical: 8
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.12)' : 'rgba(104, 119, 71, 0.08)'
  },
  optionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionIconBoxSelected: {
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.2)' : colors.lightOlive
  },
  optionTextWrap: {
    flex: 1
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  optionTitleSelected: {
    color: colors.primary,
    fontWeight: '800'
  },
  optionSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioCircleSelected: {
    borderColor: colors.primary
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 5,
    marginTop: 8
  },
  input: {
    backgroundColor: colors.beige,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  choicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  choicePillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  choicePillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  requestHistoryCard: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6
  },
  supportContactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  supportContactTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  supportContactValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2
  }
});
