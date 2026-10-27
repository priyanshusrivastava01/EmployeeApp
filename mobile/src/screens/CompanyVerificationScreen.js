import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar,
  FlatList,
  Alert,
  Modal,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CAROUSEL_SLIDES = [
  {
    icon: 'people-outline',
    title: 'Workforce Management',
    description: 'Streamline your team operations with smart attendance tracking and employee management.'
  },
  {
    icon: 'location-outline',
    title: 'Attendance & Location',
    description: 'GPS-verified punch-in with front camera selfies for transparent attendance records.'
  },
  {
    icon: 'bar-chart-outline',
    title: 'Productivity & Reports',
    description: 'Daily task reports, performance analytics, and Excel exports — all in one place.'
  }
];

export default function CompanyVerificationScreen({
  onVerified,
  onRegisterCompany,
  onScanComplete
}) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [companyCode, setCompanyCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const flatListRef = useRef(null);

  // Auto-advance carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide(prev => {
        const next = (prev + 1) % CAROUSEL_SLIDES.length;
        flatListRef.current?.scrollToOffset({
          offset: next * (SCREEN_WIDTH - 44),
          animated: true
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    const code = companyCode.trim();
    if (!code) {
      setErrorMessage('Please enter your company code.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');

    try {
      const result = await api.verifyCompanyCode(code);
      if (result.success && result.company) {
        if (onVerified) {
          onVerified(result.company);
        }
      } else {
        setErrorMessage(result.error || 'Company not found. Please check the code and try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Unable to verify. Please check your network connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQRScan = () => {
    // Will open QR scanner modal
    setShowQRScanner(true);
  };

  const handleQRResult = async (scannedData) => {
    setShowQRScanner(false);
    if (!scannedData) return;

    // Parse QR data — expected format: EMS:COMPANY_CODE or just the code
    let code = scannedData.trim();
    if (code.startsWith('EMS:')) {
      code = code.substring(4).trim();
    }
    // Reject URLs or arbitrary data
    if (code.includes('://') || code.includes('<') || code.length > 30) {
      setErrorMessage('Invalid QR code format. Please scan a valid company QR code.');
      return;
    }

    setCompanyCode(code.toUpperCase());
    // Auto-verify
    setIsVerifying(true);
    setErrorMessage('');
    try {
      const result = await api.verifyCompanyCode(code);
      if (result.success && result.company) {
        if (onVerified) onVerified(result.company);
      } else {
        setErrorMessage(result.error || 'Company not found for the scanned QR code.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const renderCarouselItem = ({ item, index }) => (
    <View style={[styles.carouselSlide, { width: SCREEN_WIDTH - 44 }]}>
      <View style={styles.carouselIconCircle}>
        <Ionicons name={item.icon} size={32} color="#ffffff" />
      </View>
      <Text style={styles.carouselTitle}>{item.title}</Text>
      <Text style={styles.carouselDesc}>{item.description}</Text>
    </View>
  );

  const onScroll = (event) => {
    const slideWidth = SCREEN_WIDTH - 44;
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / slideWidth);
    if (index !== activeSlide && index >= 0 && index < CAROUSEL_SLIDES.length) {
      setActiveSlide(index);
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo / Branding */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={30} color="#ffffff" />
          </View>
          <Text style={styles.brandName}>EmployeeApp</Text>
        </View>

        {/* Carousel */}
        <View style={styles.carouselContainer}>
          <FlatList
            ref={flatListRef}
            data={CAROUSEL_SLIDES}
            renderItem={renderCarouselItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => `slide-${i}`}
            onScroll={onScroll}
            scrollEventThrottle={16}
            snapToInterval={SCREEN_WIDTH - 44}
            decelerationRate="fast"
            contentContainerStyle={{ paddingRight: 0 }}
          />
          <View style={styles.dotContainer}>
            {CAROUSEL_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  activeSlide === i && styles.dotActive
                ]}
              />
            ))}
          </View>
        </View>

        {/* Company Verification Section */}
        <View style={styles.verificationCard}>
          <Text style={styles.cardHeading}>Company Verification</Text>
          <Text style={styles.cardSubtext}>Enter your company code to continue.</Text>

          {/* Error Banner */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Company Code Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Company Code <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="business-outline"
                size={18}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={companyCode}
                onChangeText={(val) => {
                  setCompanyCode(val.toUpperCase());
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="Enter your company code"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isVerifying}
                returnKeyType="go"
                onSubmitEditing={handleVerify}
                accessibilityLabel="Company Code"
              />
            </View>
          </View>

          {/* Verify & Proceed Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, isVerifying && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={isVerifying}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Verify and Proceed"
          >
            {isVerifying ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Verify & Proceed</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Scan QR Code Button */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleQRScan}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Scan QR Code"
          >
            <Ionicons name="qr-code-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Register Company */}
        <View style={styles.registerPrompt}>
          <Text style={styles.registerPromptText}>Don't have a registered company? </Text>
          <TouchableOpacity
            onPress={onRegisterCompany}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Register Company"
          >
            <Text style={styles.registerLink}>Register Company</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.footerText}>EmployeeApp — Secure Workforce Management</Text>
        </View>
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        onRequestClose={() => setShowQRScanner(false)}
      >
        <QRScannerView
          colors={colors}
          isDark={isDark}
          onScanResult={handleQRResult}
          onClose={() => setShowQRScanner(false)}
        />
      </Modal>
    </View>
  );
}

/**
 * Minimal QR Scanner View using expo-camera
 * Falls back to manual entry if camera is unavailable
 */
function QRScannerView({ colors, isDark, onScanResult, onClose }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const styles = getScannerStyles(colors, isDark);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { Camera } = require('expo-camera');
        if (Camera && Camera.requestCameraPermissionsAsync) {
          const { status } = await Camera.requestCameraPermissionsAsync();
          if (mounted) setHasPermission(status === 'granted');
        } else {
          if (mounted) setHasPermission(false);
        }
      } catch (e) {
        if (mounted) setHasPermission(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    onScanResult(data);
  };

  // Camera permission denied or unavailable — show manual entry
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" translucent={true} />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.fallbackContainer}>
          <Ionicons name="camera-outline" size={48} color="#999" />
          <Text style={styles.fallbackTitle}>Camera Access Required</Text>
          <Text style={styles.fallbackText}>
            Camera permission is needed to scan QR codes. You can enable it in your device settings, or enter the company code manually below.
          </Text>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => Linking.openSettings()}
          >
            <Ionicons name="settings-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.settingsBtnText}>Open Settings</Text>
          </TouchableOpacity>
          <View style={styles.manualInputGroup}>
            <Text style={styles.manualLabel}>Or enter code manually:</Text>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={(t) => setManualCode(t.toUpperCase())}
              placeholder="Company Code"
              placeholderTextColor="#888"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.manualSubmitBtn, !manualCode.trim() && styles.manualSubmitBtnDisabled]}
              onPress={() => manualCode.trim() && onScanResult(manualCode.trim())}
              disabled={!manualCode.trim()}
            >
              <Text style={styles.manualSubmitBtnText}>Verify Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Loading permission
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" translucent={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </View>
    );
  }

  // Camera view with barcode scanning
  let CameraComponent = null;
  try {
    const { CameraView } = require('expo-camera');
    CameraComponent = CameraView;
  } catch (e) {
    // expo-camera CameraView not available, try legacy
    try {
      const { Camera } = require('expo-camera');
      CameraComponent = Camera;
    } catch (e2) {
      // Camera completely unavailable
    }
  }

  if (!CameraComponent) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" translucent={true} />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.fallbackContainer}>
          <Ionicons name="qr-code" size={48} color="#999" />
          <Text style={styles.fallbackTitle}>QR Scanner Not Available</Text>
          <Text style={styles.fallbackText}>
            The camera component is not available in this environment. Please enter the company code manually.
          </Text>
          <View style={styles.manualInputGroup}>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={(t) => setManualCode(t.toUpperCase())}
              placeholder="Company Code"
              placeholderTextColor="#888"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.manualSubmitBtn, !manualCode.trim() && styles.manualSubmitBtnDisabled]}
              onPress={() => manualCode.trim() && onScanResult(manualCode.trim())}
              disabled={!manualCode.trim()}
            >
              <Text style={styles.manualSubmitBtnText}>Verify Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" translucent={true} />
      <CameraComponent
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />
      {/* Overlay */}
      <View style={styles.scanOverlay}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Company QR Code</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.scanFrame}>
          <View style={styles.scanCornerTL} />
          <View style={styles.scanCornerTR} />
          <View style={styles.scanCornerBL} />
          <View style={styles.scanCornerBR} />
        </View>
        <Text style={styles.scanHint}>Position the QR code within the frame</Text>
        {scanned && (
          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanBtnText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const getScannerStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 50,
    paddingBottom: 12,
    zIndex: 10
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff'
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 60
  },
  scanFrame: {
    width: 220,
    height: 220,
    position: 'relative'
  },
  scanCornerTL: {
    position: 'absolute', top: 0, left: 0, width: 40, height: 40,
    borderTopWidth: 3, borderLeftWidth: 3, borderColor: colors.primary, borderTopLeftRadius: 8
  },
  scanCornerTR: {
    position: 'absolute', top: 0, right: 0, width: 40, height: 40,
    borderTopWidth: 3, borderRightWidth: 3, borderColor: colors.primary, borderTopRightRadius: 8
  },
  scanCornerBL: {
    position: 'absolute', bottom: 0, left: 0, width: 40, height: 40,
    borderBottomWidth: 3, borderLeftWidth: 3, borderColor: colors.primary, borderBottomLeftRadius: 8
  },
  scanCornerBR: {
    position: 'absolute', bottom: 0, right: 0, width: 40, height: 40,
    borderBottomWidth: 3, borderRightWidth: 3, borderColor: colors.primary, borderBottomRightRadius: 8
  },
  scanHint: {
    fontSize: 14,
    color: '#cccccc',
    fontWeight: '500',
    textAlign: 'center'
  },
  rescanBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 10
  },
  rescanBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#cccccc',
    fontSize: 14,
    marginTop: 12
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 8
  },
  fallbackText: {
    fontSize: 14,
    color: '#aaaaaa',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: 24
  },
  settingsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  },
  manualInputGroup: {
    width: '100%',
    paddingHorizontal: 8
  },
  manualLabel: {
    fontSize: 13,
    color: '#aaaaaa',
    marginBottom: 8,
    fontWeight: '600'
  },
  manualInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#444444',
    marginBottom: 12
  },
  manualSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center'
  },
  manualSubmitBtnDisabled: {
    opacity: 0.5
  },
  manualSubmitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff'
  }
});

const getStyles = (colors, isDark) => StyleSheet.create({
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
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3
  },
  // Carousel
  carouselContainer: {
    marginBottom: 20
  },
  carouselSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: isDark ? '#202c1b' : '#edf4e8',
    borderWidth: 1,
    borderColor: isDark ? '#33452b' : '#cce0c2',
    marginRight: 0
  },
  carouselIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 2
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center'
  },
  carouselDesc: {
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: isDark ? '#3B4235' : '#DDE1D3',
    marginHorizontal: 4
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
    borderRadius: 4
  },
  // Verification Card
  verificationCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 3
  },
  cardHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4
  },
  cardSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 16
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
    marginBottom: 14
  },
  errorText: {
    fontSize: 13,
    color: isDark ? '#f87171' : '#c53030',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18
  },
  // Input
  inputGroup: {
    marginBottom: 14
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.card : '#FAFAF6',
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
    color: colors.text,
    letterSpacing: 0.5
  },
  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5
  },
  btnDisabled: {
    opacity: 0.7
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff'
  },
  secondaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.1)' : 'rgba(104, 119, 71, 0.06)'
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary
  },
  // Register prompt
  registerPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap'
  },
  registerPromptText: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: '500'
  },
  registerLink: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.primary
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6
  },
  footerText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500'
  }
});
