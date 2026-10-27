import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Image,
  StatusBar,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import api from '../services/api';
import LocationPickerModal from '../components/LocationPickerModal';

export default function CompanyRegistrationScreen({ onBack, onRegistrationSuccess }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  // Founder details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Company details
  const [companyName, setCompanyName] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [employeeSize, setEmployeeSize] = useState('1-20');

  // Logo
  const [logoUri, setLogoUri] = useState(null);

  // Location
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Company code availability
  const [codeStatus, setCodeStatus] = useState('idle'); // idle | checking | available | taken | error | invalid
  const [codeMessage, setCodeMessage] = useState('');
  const codeCheckTimeout = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const handleCompanyNameChange = (val) => {
    setCompanyName(val);
    if (!slugManuallyEdited) {
      const generated = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      setCompanySlug(generated);
    }
  };

  const handleSlugChange = (val) => {
    setSlugManuallyEdited(true);
    setCompanySlug(val.toLowerCase().replace(/[^a-z0-9-_]/g, '-'));
  };

  // Debounced company code availability check
  const handleCompanyCodeChange = (val) => {
    const normalizedCode = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setCompanyCode(normalizedCode);
    setCodeStatus('idle');
    setCodeMessage('');

    if (codeCheckTimeout.current) {
      clearTimeout(codeCheckTimeout.current);
    }

    if (!normalizedCode.trim()) {
      return;
    }

    // Validate format
    if (normalizedCode.length < 3) {
      setCodeStatus('invalid');
      setCodeMessage('Code must be at least 3 characters.');
      return;
    }

    if (normalizedCode.length > 20) {
      setCodeStatus('invalid');
      setCodeMessage('Code must be 20 characters or less.');
      return;
    }

    // Debounced check
    codeCheckTimeout.current = setTimeout(async () => {
      setCodeStatus('checking');
      setCodeMessage('Checking availability...');

      try {
        const result = await api.checkCompanyCodeAvailability(normalizedCode);
        if (result.success) {
          if (result.available) {
            setCodeStatus('available');
            setCodeMessage('This company code is available.');
          } else {
            setCodeStatus('taken');
            setCodeMessage('This company code is already in use. Please choose another.');
          }
        } else {
          setCodeStatus('error');
          setCodeMessage('Could not verify code availability.');
        }
      } catch (err) {
        setCodeStatus('error');
        setCodeMessage('Unable to check availability. Please try again.');
      }
    }, 600);
  };

  // Logo picker
  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Validate file size (max 5MB)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Logo image must be smaller than 5 MB.');
          return;
        }
        setLogoUri(asset.uri);
      }
    } catch (err) {
      Alert.alert('Image Selection', 'Could not open image picker. Please try again.');
    }
  };

  const handleRemoveLogo = () => {
    setLogoUri(null);
  };

  // Location confirmation
  const handleLocationConfirm = (location) => {
    setSelectedLocation(location);
    setShowLocationPicker(false);
  };

  // Get code status icon and color
  const getCodeStatusVisual = () => {
    switch (codeStatus) {
      case 'checking':
        return { icon: null, color: colors.textSecondary, isSpinner: true };
      case 'available':
        return { icon: 'checkmark-circle', color: '#527A45', isSpinner: false };
      case 'taken':
        return { icon: 'close-circle', color: '#C0392B', isSpinner: false };
      case 'error':
        return { icon: 'warning', color: '#C28424', isSpinner: false };
      case 'invalid':
        return { icon: 'close-circle-outline', color: '#C0392B', isSpinner: false };
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name as the company Founder.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid work or personal email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter a password.');
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
    if (!companyName.trim()) {
      setErrorMessage('Please enter your company name.');
      return;
    }
    if (!companyCode.trim()) {
      setErrorMessage('Please choose a company code.');
      return;
    }
    if (companyCode.trim().length < 3) {
      setErrorMessage('Company code must be at least 3 characters.');
      return;
    }
    if (codeStatus === 'taken') {
      setErrorMessage('The selected company code is already in use. Please choose another.');
      return;
    }
    if (!companySlug.trim()) {
      setErrorMessage('Please specify a unique workspace identifier (slug).');
      return;
    }
    if (!selectedLocation) {
      setErrorMessage('Please select your company location.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        confirmPassword,
        companyName: companyName.trim(),
        companyCode: companyCode.trim(),
        companySlug: companySlug.trim().toLowerCase(),
        industry: industry.trim() || undefined,
        country: country.trim() || 'India',
        city: city.trim() || undefined,
        timezone: 'Asia/Kolkata',
        employeeSize,
        location: {
          address: selectedLocation.address,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude
        }
      };

      const res = await api.registerCompany(payload);
      if (res.success) {
        if (onRegistrationSuccess) {
          onRegistrationSuccess({
            companyId: res.companyId,
            companyCode: res.organization?.company_code || companyCode,
            founderId: res.founderId,
            companyName: res.organization?.name || companyName,
            user: res.user,
            organization: res.organization,
            branch: res.branch,
            token: res.token
          });
        }
      } else {
        setErrorMessage(res.error || 'Registration failed. Please check your details.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to register company. Please verify network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const codeVisual = getCodeStatusVisual();

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
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Register Company</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Logo Upload */}
        <View style={styles.logoSection}>
          <TouchableOpacity
            style={styles.logoUploadArea}
            onPress={handlePickLogo}
            activeOpacity={0.7}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="camera-outline" size={28} color={colors.textSecondary} />
                <Text style={styles.logoPlaceholderText}>Upload Logo</Text>
              </View>
            )}
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity onPress={handleRemoveLogo} style={styles.removeLogo}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
              <Text style={styles.removeLogoText}>Remove</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.logoHelp}>Company Logo (Optional)</Text>
        </View>

        {/* Header Intro */}
        <View style={styles.introCard}>
          <View style={styles.introIconBadge}>
            <Ionicons name="business" size={28} color="#ffffff" />
          </View>
          <View style={styles.introTextWrap}>
            <Text style={styles.introTitle}>Company Workspace Setup</Text>
            <Text style={styles.introSubtitle}>
              Register your company workspace. A unique Company ID and Founder account will be created automatically.
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

        {/* ── SECTION 1: FOUNDER DETAILS ── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionHeaderText}>1. Founder Details</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., Rajesh Sharma"
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Work or Personal Email <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="founder@yourcompany.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mobile Phone Number (Optional)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Founder Password <Text style={styles.required}>*</Text></Text>
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
              placeholder="Re-enter password"
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

        {/* ── SECTION 2: COMPANY DETAILS ── */}
        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionHeaderText}>2. Company Details</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Company Name <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="business-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., Nexus Aerospace Pvt. Ltd."
              placeholderTextColor={colors.textSecondary}
              value={companyName}
              onChangeText={handleCompanyNameChange}
              autoCapitalize="words"
              maxLength={150}
            />
          </View>
        </View>

        {/* Company Code with availability check */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Company Code <Text style={styles.required}>*</Text></Text>
          <View style={[
            styles.inputContainer,
            codeStatus === 'available' && styles.inputContainerSuccess,
            (codeStatus === 'taken' || codeStatus === 'invalid') && styles.inputContainerError
          ]}>
            <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Choose a unique company code"
              placeholderTextColor={colors.textSecondary}
              value={companyCode}
              onChangeText={handleCompanyCodeChange}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={20}
            />
            {codeVisual && (
              <View style={styles.codeStatusIcon}>
                {codeVisual.isSpinner ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Ionicons name={codeVisual.icon} size={20} color={codeVisual.color} />
                )}
              </View>
            )}
          </View>
          {Boolean(codeMessage) && (
            <Text style={[
              styles.codeStatusText,
              codeStatus === 'available' && { color: '#527A45' },
              (codeStatus === 'taken' || codeStatus === 'invalid') && { color: '#C0392B' },
              codeStatus === 'error' && { color: '#C28424' }
            ]}>
              {codeMessage}
            </Text>
          )}
          <Text style={styles.fieldHelp}>Choose a code that is easy to remember (e.g., VAR007). Letters, numbers, and hyphens only.</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Workspace Slug <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <Ionicons name="link-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="nexus-aerospace"
              placeholderTextColor={colors.textSecondary}
              value={companySlug}
              onChangeText={handleSlugChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.fieldHelp}>Unique workspace identifier used for internal routing.</Text>
        </View>

        {/* Company Location */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Company Location <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity
            style={[styles.inputContainer, styles.locationSelector]}
            onPress={() => setShowLocationPicker(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <View style={styles.locationTextContainer}>
              {selectedLocation ? (
                <>
                  <Text style={styles.locationSelectedText} numberOfLines={2}>
                    {selectedLocation.address}
                  </Text>
                  <Text style={styles.locationCoords}>
                    {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                  </Text>
                </>
              ) : (
                <Text style={styles.locationPlaceholder}>Select company location</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {selectedLocation && (
            <Text style={[styles.fieldHelp, { color: '#527A45' }]}>
              ✓ Location selected — this will be your initial branch/office address.
            </Text>
          )}
        </View>

        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Industry</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g., Tech / Retail"
                placeholderTextColor={colors.textSecondary}
                value={industry}
                onChangeText={setIndustry}
              />
            </View>
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>City</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="e.g., Bengaluru"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Employee Size Range</Text>
          <View style={styles.sizeRangeContainer}>
            {['1-20', '21-50', '51-200', '200+'].map((sz) => (
              <TouchableOpacity
                key={sz}
                style={[
                  styles.sizeChip,
                  employeeSize === sz && styles.sizeChipActive
                ]}
                onPress={() => setEmployeeSize(sz)}
              >
                <Text style={[
                  styles.sizeChipText,
                  employeeSize === sz && styles.sizeChipTextActive
                ]}>{sz}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Registration Note */}
        <View style={styles.warningCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginRight: 8, marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Before you register</Text>
            <Text style={styles.warningText}>
              Your Company Code will be used by employees to find and join your organization. Choose a code that represents your company.
            </Text>
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
              <Text style={styles.submitBtnText}>Register Company</Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.safeNote}>
          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
          <Text style={styles.safeNoteText}>
            Protected by database constraints & secure salted password hashing. Zero-cost setup.
          </Text>
        </View>
      </ScrollView>

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={handleLocationConfirm}
        initialLatitude={selectedLocation?.latitude}
        initialLongitude={selectedLocation?.longitude}
        colors={colors}
        isDark={isDark}
      />
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
  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: 16
  },
  logoUploadArea: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: isDark ? '#2a3524' : '#eef4ea',
    borderWidth: 2,
    borderColor: isDark ? '#3d4a34' : '#ccd9c4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: 20
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoPlaceholderText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 4
  },
  removeLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4
  },
  removeLogoText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600'
  },
  logoHelp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4
  },
  // Intro Card
  introCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    backgroundColor: isDark ? '#202c1b' : '#edf4e8',
    borderWidth: 1.5,
    borderColor: isDark ? '#33452b' : '#cce0c2',
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
  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    backgroundColor: isDark ? '#3a2323' : '#fff5f5',
    borderWidth: 1,
    borderColor: isDark ? '#5a3030' : '#feb2b2',
    marginBottom: 16
  },
  errorText: {
    fontSize: 13,
    color: isDark ? '#f87171' : '#c53030',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18
  },
  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  // Form
  formGroup: {
    marginBottom: 14
  },
  formRow: {
    flexDirection: 'row'
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
  inputContainerSuccess: {
    borderColor: '#527A45'
  },
  inputContainerError: {
    borderColor: '#C0392B'
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
  codeStatusIcon: {
    marginLeft: 4,
    width: 24,
    alignItems: 'center'
  },
  codeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
    color: colors.textSecondary
  },
  // Location
  locationSelector: {
    height: 'auto',
    minHeight: 48,
    paddingVertical: 10
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 4
  },
  locationSelectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18
  },
  locationCoords: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2
  },
  locationPlaceholder: {
    fontSize: 14,
    color: colors.textSecondary
  },
  // Size
  sizeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  sizeChip: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: isDark ? '#222d1d' : '#f0f5ec',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  sizeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  sizeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  },
  sizeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  // Warning card
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.1)' : 'rgba(104, 119, 71, 0.06)',
    borderWidth: 1,
    borderColor: isDark ? '#3d4a34' : '#ccd9c4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2
  },
  warningText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16
  },
  // Submit
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
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
