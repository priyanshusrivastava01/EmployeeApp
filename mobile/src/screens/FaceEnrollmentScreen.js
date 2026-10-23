import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme } from '../theme/ThemeContext';

export default function FaceEnrollmentScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Consent state
  const [hasConsented, setHasConsented] = useState(false);
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  // Enrollment capture steps: 0: Consent, 1: Front, 2: Left Turn, 3: Right Turn, 4: Review
  const [currentStep, setCurrentStep] = useState(0);

  // Captured images for the 3 poses
  const [captures, setCaptures] = useState({
    front: null,
    left: null,
    right: null
  });

  const [isCapturing, setIsCapturing] = useState(false);

  // Capture current step photo
  const handleSnapPose = async () => {
    if (!cameraRef.current) return;
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo && photo.uri) {
        if (currentStep === 1) {
          setCaptures(prev => ({ ...prev, front: photo.uri }));
          setCurrentStep(2);
        } else if (currentStep === 2) {
          setCaptures(prev => ({ ...prev, left: photo.uri }));
          setCurrentStep(3);
        } else if (currentStep === 3) {
          setCaptures(prev => ({ ...prev, right: photo.uri }));
          setCurrentStep(4);
        }
      }
    } catch (err) {
      console.error('Enrollment snap error:', err);
      Alert.alert('Capture Failed', 'Could not capture photo. Please check camera.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetakeAll = () => {
    setCaptures({ front: null, left: null, right: null });
    setCurrentStep(1);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Face Biometric Enrollment</Text>
          <Text style={styles.subtitle}>Secure identity registration for punch validation</Text>
        </View>
        <View style={styles.previewBadge}>
          <Text style={styles.previewBadgeText}>PHASE 1 PREVIEW</Text>
        </View>
      </View>

      {/* Notice Banner */}
      <View style={styles.disclaimerBanner}>
        <Ionicons name="shield-outline" size={16} color={colors.darkOlive} style={{ marginTop: 2 }} />
        <Text style={styles.disclaimerText}>
          Enrollment UI Preview — Verification Engine Not Active. Photographs are held in local memory. Real embedding vector generation will be connected in Phase 2.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* STEP 0: PRIVACY NOTICE & AFFIRMATIVE CONSENT */}
        {currentStep === 0 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Why We Use Facial Verification</Text>
            </View>
            <Text style={styles.cardBodyText}>
              To protect company premises, prevent buddy punching, and verify genuine shift presence, the Employee Management System uses biometric facial matching during Punch In and Punch Out.
            </Text>

            <View style={styles.privacyBox}>
              <Text style={styles.privacyHeading}>Biometric Privacy Notice & Legal Rights (DPDPA 2023)</Text>
              <Text style={styles.privacyItem}>
                • <Text style={styles.bold}>Data Collected:</Text> Three reference photographs (front, left, right) used to generate a mathematical landmark vector (embedding). Raw images are never sold or shared.
              </Text>
              <Text style={styles.privacyItem}>
                • <Text style={styles.bold}>Storage & Security:</Text> Templates are encrypted at rest using AES-256 and stored in private backend storage with restricted access controls.
              </Text>
              <Text style={styles.privacyItem}>
                • <Text style={styles.bold}>Retention Period:</Text> Retained strictly for the duration of your active employment and purged within 30 days of exit.
              </Text>
              <Text style={styles.privacyItem}>
                • <Text style={styles.bold}>Employee Rights:</Text> You have the right to inspect, update, or withdraw consent. If medical or physical constraints prevent biometric verification, supervisor manual review is available.
              </Text>
            </View>

            {/* Checkbox */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setHasConsented(!hasConsented)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasConsented ? 'checkbox' : 'square-outline'}
                size={24}
                color={hasConsented ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.consentLabel}>
                I have read the Biometric Privacy Notice and provide affirmative consent to enroll my facial profile for attendance verification.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !hasConsented && styles.primaryBtnDisabled]}
              onPress={() => {
                if (hasConsented) setCurrentStep(1);
              }}
              disabled={!hasConsented}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Proceed to Camera Setup</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        {/* STEPS 1, 2, 3: MULTI-ANGLE CAMERA CAPTURE */}
        {(currentStep === 1 || currentStep === 2 || currentStep === 3) && (
          <View>
            {/* Step Indicator */}
            <View style={styles.stepProgressRow}>
              {[
                { step: 1, label: 'Front Pose' },
                { step: 2, label: 'Left Turn' },
                { step: 3, label: 'Right Turn' }
              ].map(s => (
                <View key={s.step} style={styles.stepIndicatorItem}>
                  <View style={[
                    styles.stepCircle,
                    currentStep === s.step && styles.stepCircleActive,
                    currentStep > s.step && styles.stepCircleDone
                  ]}>
                    <Text style={styles.stepCircleText}>
                      {currentStep > s.step ? '✓' : s.step}
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, currentStep === s.step && styles.stepLabelActive]}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Camera Viewport with Oval Guide */}
            <View style={styles.cameraBox}>
              {!cameraPermission ? (
                <View style={styles.cameraCenterMessage}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.cameraMessageText}>Checking camera permissions...</Text>
                </View>
              ) : !cameraPermission.granted ? (
                <View style={styles.cameraCenterMessage}>
                  <Ionicons name="camera-outline" size={42} color="#C0392B" />
                  <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                  <TouchableOpacity style={styles.grantBtn} onPress={requestCameraPermission}>
                    <Text style={styles.grantBtnText}>Grant Camera Access</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cameraContainer}>
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="front"
                  />

                  {/* Oval Face Guide */}
                  <View style={styles.ovalGuide} pointerEvents="none" />

                  {/* Pose Guidance Instruction */}
                  <View style={styles.poseInstructionBox}>
                    <Text style={styles.poseInstructionTitle}>
                      {currentStep === 1 && 'Step 1: Look Directly at Camera'}
                      {currentStep === 2 && 'Step 2: Turn Head Slightly Left (~30°)'}
                      {currentStep === 3 && 'Step 3: Turn Head Slightly Right (~30°)'}
                    </Text>
                    <Text style={styles.poseInstructionSub}>
                      Keep eyes open, remove sunglasses or face masks, and ensure even lighting.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Shutter Button */}
            <View style={styles.shutterRow}>
              <TouchableOpacity
                style={styles.shutterBtn}
                onPress={handleSnapPose}
                disabled={isCapturing}
                activeOpacity={0.8}
              >
                {isCapturing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={styles.shutterInner} />
                )}
              </TouchableOpacity>
              <Text style={styles.shutterHelpText}>Tap to capture pose {currentStep} of 3</Text>
            </View>

            <TouchableOpacity style={styles.cancelLink} onPress={() => setCurrentStep(0)}>
              <Text style={styles.cancelLinkText}>Cancel Enrollment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: REVIEW CAPTURES */}
        {currentStep === 4 && (
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={22} color={colors.primary} />
              <Text style={styles.cardTitle}>Review Enrollment Poses</Text>
            </View>

            <Text style={styles.cardBodyText}>
              All 3 reference angles have been captured for biometric template creation:
            </Text>

            <View style={styles.thumbsGrid}>
              <View style={styles.thumbBox}>
                <Image source={{ uri: captures.front }} style={styles.thumbImage} />
                <Text style={styles.thumbLabel}>1. Front Pose</Text>
              </View>
              <View style={styles.thumbBox}>
                <Image source={{ uri: captures.left }} style={styles.thumbImage} />
                <Text style={styles.thumbLabel}>2. Left Angle</Text>
              </View>
              <View style={styles.thumbBox}>
                <Image source={{ uri: captures.right }} style={styles.thumbImage} />
                <Text style={styles.thumbLabel}>3. Right Angle</Text>
              </View>
            </View>

            <View style={styles.engineNoticeBox}>
              <Ionicons name="information-circle" size={18} color="#C28424" />
              <Text style={styles.engineNoticeText}>
                Biometric Engine Status: Standby. In Phase 2, these frames will be submitted to the trusted backend to generate cryptographic ArcFace/AWS embeddings.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={handleRetakeAll}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color={colors.text} />
                <Text style={styles.retakeBtnText}>Retake All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  Alert.alert(
                    'Enrollment Preview Recorded',
                    'Your reference photographs are staged in local preview memory. Once Phase 2 connects the biometric backend, permanent vector enrollment will be enabled.',
                    [{ text: 'OK', onPress: onBack }]
                  );
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
                <Text style={styles.doneBtnText}>Save Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary
  },
  previewBadge: {
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  previewBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.darkOlive
  },
  disclaimerBanner: {
    backgroundColor: colors.lightOlive,
    borderWidth: 1,
    borderColor: colors.primary,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    gap: 8
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: colors.darkOlive,
    lineHeight: 15
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  cardBodyText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14
  },
  privacyBox: {
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  privacyHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkOlive,
    marginBottom: 8
  },
  privacyItem: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6
  },
  bold: {
    fontWeight: '700',
    color: colors.text
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.beige,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  consentLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.text,
    lineHeight: 17
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryBtnDisabled: {
    backgroundColor: colors.beige,
    opacity: 0.7
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  stepProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16
  },
  stepIndicatorItem: {
    alignItems: 'center',
    gap: 4
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  stepCircleDone: {
    backgroundColor: colors.darkOlive,
    borderColor: colors.darkOlive
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff'
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700'
  },
  cameraBox: {
    height: 360,
    backgroundColor: '#1E2319',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 16
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  ovalGuide: {
    width: 200,
    height: 260,
    borderRadius: 100,
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderStyle: 'dashed'
  },
  poseInstructionBox: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(41, 45, 38, 0.90)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  poseInstructionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.lightOlive,
    textAlign: 'center'
  },
  poseInstructionSub: {
    fontSize: 10,
    color: colors.beige,
    textAlign: 'center',
    marginTop: 2
  },
  cameraCenterMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  cameraMessageText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8
  },
  permissionTitle: {
    color: '#C0392B',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12
  },
  grantBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  grantBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  shutterRow: {
    alignItems: 'center',
    marginVertical: 12
  },
  shutterBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(104, 119, 71, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary
  },
  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff'
  },
  shutterHelpText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 8
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8
  },
  cancelLinkText: {
    color: colors.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline'
  },
  thumbsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 14
  },
  thumbBox: {
    flex: 1,
    alignItems: 'center'
  },
  thumbImage: {
    width: '100%',
    height: 110,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  thumbLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 6
  },
  engineNoticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  engineNoticeText: {
    flex: 1,
    fontSize: 11,
    color: colors.text,
    lineHeight: 15
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  retakeBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  doneBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  }
});
