import React, { useState, useRef, useEffect } from 'react';
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
import {
  getRegistrationStatus,
  saveRegistration,
  removeRegistration
} from '../services/photoRegistrationService';

export default function FaceEnrollmentScreen({ onBack, onRegistrationComplete }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // Existing registration state
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [existingRegistration, setExistingRegistration] = useState(null);
  const [viewMode, setViewMode] = useState('capture'); // 'manage' | 'capture'

  // Consent state
  const [hasConsented, setHasConsented] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState(null);

  // Enrollment capture steps:
  // 0: Consent & Privacy
  // 1: Front Pose
  // 2: Left Pose (~30°)
  // 3: Right Pose (~30°)
  // 4: Review All 3 Poses & Final Local Save
  const [currentStep, setCurrentStep] = useState(0);

  // Return to review after retaking a single pose from Step 4
  const [returnToReviewAfterSnap, setReturnToReviewAfterSnap] = useState(false);

  // Temporary captured images for the 3 poses
  const [captures, setCaptures] = useState({
    front: null,
    left: null,
    right: null
  });

  // Current step preview state (before confirming)
  const [stepPreviewUri, setStepPreviewUri] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing local registration on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const reg = await getRegistrationStatus();
      if (reg.isRegistered && reg.photos) {
        setExistingRegistration(reg);
        setViewMode('manage');
      } else {
        setExistingRegistration(null);
        setViewMode('capture');
        setCurrentStep(0);
      }
    } catch (err) {
      console.warn('Status load error:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  /**
   * Capture photo for the current active step
   */
  const handleSnapPose = async () => {
    if (!cameraRef.current) return;
    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo && photo.uri) {
        setStepPreviewUri(photo.uri);
      }
    } catch (err) {
      console.error('Enrollment snap error:', err);
      Alert.alert('Capture Failed', 'Could not capture photo. Please check camera access and try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  /**
   * Retake photo for the current step
   */
  const handleRetakeStep = () => {
    setStepPreviewUri(null);
  };

  /**
   * Confirm the current step photo and advance
   */
  const handleConfirmStep = () => {
    if (!stepPreviewUri) return;

    if (currentStep === 1) {
      setCaptures(prev => ({ ...prev, front: stepPreviewUri }));
      setStepPreviewUri(null);
      if (returnToReviewAfterSnap) {
        setReturnToReviewAfterSnap(false);
        setCurrentStep(4);
      } else {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      setCaptures(prev => ({ ...prev, left: stepPreviewUri }));
      setStepPreviewUri(null);
      if (returnToReviewAfterSnap) {
        setReturnToReviewAfterSnap(false);
        setCurrentStep(4);
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      setCaptures(prev => ({ ...prev, right: stepPreviewUri }));
      setStepPreviewUri(null);
      setReturnToReviewAfterSnap(false);
      setCurrentStep(4);
    }
  };

  /**
   * Retake an individual view from Step 4 Review
   */
  const handleRetakeSpecificPose = (stepNum) => {
    setReturnToReviewAfterSnap(true);
    setStepPreviewUri(null);
    setCurrentStep(stepNum);
  };

  /**
   * Restart the entire capture sequence
   */
  const handleStartOver = () => {
    setCaptures({ front: null, left: null, right: null });
    setStepPreviewUri(null);
    setReturnToReviewAfterSnap(false);
    setCurrentStep(1);
  };

  /**
   * Save registration locally to permanent app document storage
   */
  const handleSaveRegistration = async () => {
    if (!captures.front || !captures.left || !captures.right) {
      Alert.alert(
        'Missing Photos',
        'All three reference photos (Front, Left, and Right) must be captured before completing registration.'
      );
      return;
    }

    try {
      setIsSaving(true);
      await saveRegistration({
        frontUri: captures.front,
        leftUri: captures.left,
        rightUri: captures.right,
        employeeId: 'EMP-2024-0891',
        consentDate: consentTimestamp || new Date().toISOString()
      });

      Alert.alert(
        'Registration Saved Locally',
        'Your 3 reference poses have been saved securely in app device storage.\n\nStatus: Registered Locally — Cloud Sync Pending\n\n(Cloud upload to Supabase will be enabled during backend synchronization.)',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onRegistrationComplete) {
                onRegistrationComplete();
              } else {
                loadStatus();
              }
            }
          }
        ]
      );
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Save Failed', err.message || 'Could not save photo registration locally. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Delete existing local registration
   */
  const handleDeleteRegistration = () => {
    Alert.alert(
      'Remove Photo Registration?',
      'This will permanently delete the 3 reference photos stored locally on this device. You will need to re-register before biometric attendance can be activated.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeRegistration();
              Alert.alert('Registration Removed', 'Local registration photos have been deleted.');
              setExistingRegistration(null);
              setViewMode('capture');
              setCurrentStep(0);
              setCaptures({ front: null, left: null, right: null });
            } catch (err) {
              Alert.alert('Error', 'Could not delete local registration: ' + err.message);
            }
          }
        }
      ]
    );
  };

  if (loadingStatus) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading photo registration status...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {viewMode === 'manage' ? 'Registered Facial Profile' : 'Employee Photo Registration'}
          </Text>
          <Text style={styles.subtitle}>
            {viewMode === 'manage'
              ? 'Local reference photos for punch validation'
              : 'Multi-angle reference capture for shift verification'}
          </Text>
        </View>
        <View style={styles.localBadge}>
          <Text style={styles.localBadgeText}>LOCAL STORAGE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================= */}
        {/* VIEW MODE A: MANAGE EXISTING LOCAL REGISTRATION           */}
        {/* ========================================================= */}
        {viewMode === 'manage' && existingRegistration && (
          <View>
            {/* Status Banner */}
            <View style={styles.statusCard}>
              <View style={styles.statusTopRow}>
                <View style={styles.statusIconWrap}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>Registered Locally</Text>
                  <Text style={styles.statusSubtitle}>Cloud Sync Pending • Saved on Device</Text>
                </View>
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>SAVED</Text>
                </View>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Employee ID:</Text>
                <Text style={styles.metaValue}>{existingRegistration.employeeId}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Registered Date:</Text>
                <Text style={styles.metaValue}>
                  {new Date(existingRegistration.registeredAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>DPDPA 2023 Consent:</Text>
                <Text style={styles.metaValue}>Granted Affirmative Consent</Text>
              </View>
            </View>

            {/* Honest Technical Transparency Notice */}
            <View style={styles.honestyCard}>
              <Ionicons name="information-circle-outline" size={20} color={colors.darkOlive} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.honestyHeading}>Biometric Status: Enrollment UI available; verification integration pending</Text>
                <Text style={styles.honestyBody}>
                  These 3 reference photographs are stored securely on this phone. Automatic biometric face matching, identity recognition, and liveness anti-spoofing are currently not active. Photos serve as reference captures pending backend enrollment and verification service integration.
                </Text>
              </View>
            </View>

            {/* Saved Thumbnails */}
            <Text style={styles.sectionHeading}>Active Reference Views (3 Poses)</Text>
            <View style={styles.thumbsGrid}>
              <View style={styles.thumbBox}>
                <Image source={{ uri: existingRegistration.photos.front }} style={styles.thumbImage} />
                <Text style={styles.thumbLabel}>1. Front Pose</Text>
                <View style={styles.thumbCheck}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                </View>
              </View>

              <View style={styles.thumbBox}>
                <Image source={{ uri: existingRegistration.photos.left }} style={styles.thumbImage} />
                <Text style={styles.thumbLabel}>2. Left Angle</Text>
                <View style={styles.thumbCheck}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                </View>
              </View>

              <View style={styles.thumbBox}>
                <Image source={{ uri: existingRegistration.photos.right }} style={styles.thumbImage} />
                <Text style={styles.thumbLabel}>3. Right Angle</Text>
                <View style={styles.thumbCheck}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                </View>
              </View>
            </View>

            {/* Management Actions */}
            <View style={styles.manageActionsWrap}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  setCaptures({ front: null, left: null, right: null });
                  setStepPreviewUri(null);
                  setViewMode('capture');
                  setCurrentStep(1); // Consent already given
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh-circle-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Update / Re-register Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dangerOutlineBtn}
                onPress={handleDeleteRegistration}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.dangerOutlineBtnText}>Remove Local Registration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onBack}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Back to Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* VIEW MODE B: GUIDED PHOTO CAPTURE FLOW                   */}
        {/* ========================================================= */}
        {viewMode === 'capture' && (
          <View>
            {/* STEP 0: PRIVACY NOTICE & AFFIRMATIVE CONSENT */}
            {currentStep === 0 && (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
                  <Text style={styles.cardTitle}>Employee Photo Registration & Consent</Text>
                </View>
                <Text style={styles.cardBodyText}>
                  To support attendance presence and future biometric verification, the Employee Management System records reference photographs from 3 angles (front, left, right).
                </Text>

                <View style={styles.privacyBox}>
                  <Text style={styles.privacyHeading}>DPDPA 2023 Compliance & Data Protection Notice</Text>
                  <Text style={styles.privacyItem}>
                    • <Text style={styles.bold}>Local Storage:</Text> Your photographs are saved directly to local device storage in an app-controlled directory. No photos are uploaded to external clouds or sold to third parties.
                  </Text>
                  <Text style={styles.privacyItem}>
                    • <Text style={styles.bold}>Future Cloud Sync:</Text> Cloud synchronization with private Supabase Storage will be introduced during backend integration.
                  </Text>
                  <Text style={styles.privacyItem}>
                    • <Text style={styles.bold}>Employee Rights:</Text> You can review, update, or permanently delete these stored reference photos at any time from your Profile settings.
                  </Text>
                  <Text style={styles.privacyItem}>
                    • <Text style={styles.bold}>Biometric Disclaimer:</Text> Real-time face recognition and liveness detection are currently not implemented. Capturing photos registers your reference poses only.
                  </Text>
                </View>

                {/* Consent Checkbox */}
                <TouchableOpacity
                  style={styles.consentRow}
                  onPress={() => {
                    const next = !hasConsented;
                    setHasConsented(next);
                    if (next) setConsentTimestamp(new Date().toISOString());
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={hasConsented ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={hasConsented ? colors.primary : colors.textSecondary}
                  />
                  <Text style={styles.consentLabel}>
                    I have read the privacy notice and give affirmative consent to capture and save my reference photographs on this device for attendance registration.
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

                <TouchableOpacity style={styles.cancelLink} onPress={onBack}>
                  <Text style={styles.cancelLinkText}>Cancel Registration</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEPS 1, 2, 3: CAMERA CAPTURE WITH REAL-TIME PREVIEW & CONFIRMATION */}
            {(currentStep === 1 || currentStep === 2 || currentStep === 3) && (
              <View>
                {/* 3-Step Progress Indicators */}
                <View style={styles.stepProgressRow}>
                  {[
                    { step: 1, label: 'Front Pose', key: 'front' },
                    { step: 2, label: 'Left Turn', key: 'left' },
                    { step: 3, label: 'Right Turn', key: 'right' }
                  ].map(s => {
                    const isDone = captures[s.key] !== null;
                    const isCurrent = currentStep === s.step;
                    return (
                      <View key={s.step} style={styles.stepIndicatorItem}>
                        <View style={[
                          styles.stepCircle,
                          isCurrent && styles.stepCircleActive,
                          isDone && styles.stepCircleDone
                        ]}>
                          <Text style={[
                            styles.stepCircleText,
                            (isCurrent || isDone) && styles.stepCircleTextActive
                          ]}>
                            {isDone ? '✓' : s.step}
                          </Text>
                        </View>
                        <Text style={[styles.stepLabel, isCurrent && styles.stepLabelActive]}>
                          {s.label}
                        </Text>
                        <Text style={styles.stepSubStatus}>
                          {isDone ? 'Completed' : (isCurrent ? 'Active' : 'Pending')}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Camera / Captured Preview Box */}
                <View style={styles.cameraBox}>
                  {!cameraPermission ? (
                    <View style={styles.cameraCenterMessage}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.cameraMessageText}>Checking camera permissions...</Text>
                    </View>
                  ) : !cameraPermission.granted ? (
                    <View style={styles.cameraCenterMessage}>
                      <Ionicons name="camera-outline" size={44} color={colors.danger} />
                      <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                      <Text style={styles.permissionDesc}>
                        Camera access is required to capture your reference photographs. Please grant permission in your device settings.
                      </Text>
                      <TouchableOpacity style={styles.grantBtn} onPress={requestCameraPermission}>
                        <Text style={styles.grantBtnText}>Grant Camera Access</Text>
                      </TouchableOpacity>
                    </View>
                  ) : stepPreviewUri ? (
                    /* Photo Review State Before Confirming */
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: stepPreviewUri }} style={styles.capturedPreviewImage} />
                      <View style={styles.previewOverlay}>
                        <View style={styles.previewBadge}>
                          <Ionicons name="eye" size={14} color="#ffffff" />
                          <Text style={styles.previewBadgeText}>REVIEW CAPTURE</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* Live Camera View */
                    <View style={styles.cameraContainer}>
                      <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="front"
                      />

                      {/* Oval Alignment Guide */}
                      <View style={styles.ovalGuide} pointerEvents="none" />

                      {/* Pose Guidance Overlay */}
                      <View style={styles.poseInstructionBox}>
                        <Text style={styles.poseInstructionTitle}>
                          {currentStep === 1 && 'Step 1: Look Directly at the Camera'}
                          {currentStep === 2 && 'Step 2: Turn Head Slightly Left (~30°)'}
                          {currentStep === 3 && 'Step 3: Turn Head Slightly Right (~30°)'}
                        </Text>
                        <Text style={styles.poseInstructionSub}>
                          Align face inside oval guide. Ensure natural lighting and remove sunglasses.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Controls: If in review mode, show Retake & Confirm. Else show Shutter. */}
                {stepPreviewUri ? (
                  <View style={styles.reviewControlsRow}>
                    <TouchableOpacity
                      style={styles.retakeBtn}
                      onPress={handleRetakeStep}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="refresh" size={18} color={colors.text} />
                      <Text style={styles.retakeBtnText}>Retake Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.confirmStepBtn}
                      onPress={handleConfirmStep}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                      <Text style={styles.confirmStepBtnText}>Confirm & Continue</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.shutterRow}>
                    <TouchableOpacity
                      style={styles.shutterBtn}
                      onPress={handleSnapPose}
                      disabled={isCapturing || !cameraPermission?.granted}
                      activeOpacity={0.8}
                    >
                      {isCapturing ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <View style={styles.shutterInner} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.shutterHelpText}>
                      Tap circle to take {currentStep === 1 ? 'Front' : currentStep === 2 ? 'Left' : 'Right'} photo
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.cancelLink}
                  onPress={() => {
                    if (existingRegistration) {
                      setViewMode('manage');
                    } else {
                      setCurrentStep(0);
                    }
                  }}
                >
                  <Text style={styles.cancelLinkText}>Cancel & Exit</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4: FINAL REVIEW OF ALL 3 VIEWS */}
            {currentStep === 4 && (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="images-outline" size={22} color={colors.primary} />
                  <Text style={styles.cardTitle}>Review Reference Poses</Text>
                </View>

                <Text style={styles.cardBodyText}>
                  All 3 reference angles have been recorded. Verify each view below before confirming local storage:
                </Text>

                <View style={styles.thumbsGrid}>
                  {/* Front View */}
                  <View style={styles.thumbBox}>
                    <Image source={{ uri: captures.front }} style={styles.thumbImage} />
                    <Text style={styles.thumbLabel}>1. Front Pose</Text>
                    <TouchableOpacity
                      style={styles.retakePill}
                      onPress={() => handleRetakeSpecificPose(1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.retakePillText}>Retake</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Left View */}
                  <View style={styles.thumbBox}>
                    <Image source={{ uri: captures.left }} style={styles.thumbImage} />
                    <Text style={styles.thumbLabel}>2. Left Angle</Text>
                    <TouchableOpacity
                      style={styles.retakePill}
                      onPress={() => handleRetakeSpecificPose(2)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.retakePillText}>Retake</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Right View */}
                  <View style={styles.thumbBox}>
                    <Image source={{ uri: captures.right }} style={styles.thumbImage} />
                    <Text style={styles.thumbLabel}>3. Right Angle</Text>
                    <TouchableOpacity
                      style={styles.retakePill}
                      onPress={() => handleRetakeSpecificPose(3)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.retakePillText}>Retake</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Honesty Notice */}
                <View style={styles.engineNoticeBox}>
                  <Ionicons name="information-circle" size={18} color="#C28424" />
                  <Text style={styles.engineNoticeText}>
                    Biometric Verification Status: Pending. Saving these photographs records your reference images into local device storage. Real biometric vector matching will be enabled once the backend engine is integrated.
                  </Text>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={handleStartOver}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={16} color={colors.text} />
                    <Text style={styles.retakeBtnText}>Retake All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.doneBtn, isSaving && { opacity: 0.7 }]}
                    onPress={handleSaveRegistration}
                    disabled={isSaving}
                    activeOpacity={0.85}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={16} color="#ffffff" />
                        <Text style={styles.doneBtnText}>Save Local Registration</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary
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
    color: colors.textSecondary,
    marginTop: 1
  },
  localBadge: {
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.15)' : colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  localBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.darkOlive
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
    color: colors.text,
    marginBottom: 6
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
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryBtnDisabled: {
    opacity: 0.5
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  cancelLink: {
    marginTop: 14,
    alignItems: 'center'
  },
  cancelLinkText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  stepProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  stepIndicatorItem: {
    alignItems: 'center',
    gap: 2
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.beige,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  stepCircleDone: {
    borderColor: colors.success,
    backgroundColor: colors.success
  },
  stepCircleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  stepCircleTextActive: {
    color: '#ffffff'
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700'
  },
  stepSubStatus: {
    fontSize: 9,
    color: colors.textSecondary
  },
  cameraBox: {
    height: 340,
    backgroundColor: '#1E2319',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  cameraContainer: {
    flex: 1,
    position: 'relative'
  },
  camera: {
    flex: 1,
    width: '100%'
  },
  ovalGuide: {
    position: 'absolute',
    top: '12%',
    left: '22%',
    width: '56%',
    height: '62%',
    borderRadius: 120,
    borderWidth: 2,
    borderColor: '#A3B879',
    borderStyle: 'dashed'
  },
  poseInstructionBox: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(25, 28, 23, 0.88)',
    borderRadius: 10,
    padding: 10
  },
  poseInstructionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A3B879',
    marginBottom: 2
  },
  poseInstructionSub: {
    fontSize: 10,
    color: '#F1F2E9',
    lineHeight: 14
  },
  cameraCenterMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10
  },
  cameraMessageText: {
    color: '#F1F2E9',
    fontSize: 12
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff'
  },
  permissionDesc: {
    fontSize: 12,
    color: '#B7BBAE',
    textAlign: 'center',
    lineHeight: 17
  },
  grantBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6
  },
  grantBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  previewContainer: {
    flex: 1,
    position: 'relative'
  },
  capturedPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  previewOverlay: {
    position: 'absolute',
    top: 12,
    right: 12
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(25, 28, 23, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  previewBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  shutterRow: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(104, 119, 71, 0.2)'
  },
  shutterInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary
  },
  shutterHelpText: {
    fontSize: 11,
    color: colors.textSecondary
  },
  reviewControlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10
  },
  confirmStepBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13
  },
  confirmStepBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  thumbsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  thumbBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative'
  },
  thumbImage: {
    width: '100%',
    height: 90,
    borderRadius: 6,
    backgroundColor: '#000000',
    marginBottom: 6,
    resizeMode: 'cover'
  },
  thumbLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center'
  },
  thumbCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.card,
    borderRadius: 8
  },
  retakePill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  retakePillText: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: '700'
  },
  engineNoticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.15)' : colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  engineNoticeText: {
    flex: 1,
    fontSize: 11,
    color: isDark ? colors.textPrimary : colors.warningDark,
    lineHeight: 15
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12
  },
  retakeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  doneBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
  },
  // Management Screen Styles
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.15)' : colors.lightOlive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  statusSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  activeTag: {
    backgroundColor: isDark ? 'rgba(82, 122, 69, 0.2)' : colors.successLight,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.success
  },
  metaDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  metaLabel: {
    fontSize: 11,
    color: colors.textSecondary
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text
  },
  honestyCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  honestyHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2
  },
  honestyBody: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10
  },
  manageActionsWrap: {
    gap: 10,
    marginTop: 8
  },
  dangerOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: 'transparent'
  },
  dangerOutlineBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700'
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  }
});
