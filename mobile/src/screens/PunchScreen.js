import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

import { mockOfficeGeofence } from '../data/mockEmployeeData';
import { evaluateGeofence } from '../utils/geofence';
import { lightTheme } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

// 10 Distinct Verification States for Phase 1C (Dynamic by theme)
export const getVerificationStates = (c = lightTheme) => ({
  CAMERA_PERMISSION_REQUIRED: {
    id: 'CAMERA_PERMISSION_REQUIRED',
    title: '1. Camera Permission Required',
    desc: 'Camera access is required for facial capture.',
    color: c.danger,
    icon: 'camera-outline',
    ovalBorderColor: c.danger,
    ovalBorderStyle: 'dashed'
  },
  NO_FACE_DETECTED: {
    id: 'NO_FACE_DETECTED',
    title: '2. No Face Detected',
    desc: 'No face detected in camera viewport. Position face towards lens.',
    color: c.danger,
    icon: 'alert-circle-outline',
    ovalBorderColor: c.danger,
    ovalBorderStyle: 'dashed'
  },
  FACE_OUTSIDE_OVAL: {
    id: 'FACE_OUTSIDE_OVAL',
    title: '3. Face Outside Oval Guide',
    desc: 'Face is misaligned. Center your head inside the oval boundary.',
    color: c.danger,
    icon: 'scan-outline',
    ovalBorderColor: c.danger,
    ovalBorderStyle: 'dashed'
  },
  FACE_ALIGNED: {
    id: 'FACE_ALIGNED',
    title: '4. Face Alignment Correct',
    desc: 'Face properly positioned. Ready for biometric scan.',
    color: c.primary,
    icon: 'checkmark-circle-outline',
    ovalBorderColor: c.primary,
    ovalBorderStyle: 'solid'
  },
  LIVENESS_CHECKING: {
    id: 'LIVENESS_CHECKING',
    title: '5. Liveness Check in Progress',
    desc: 'Analyzing micro-movement & anti-spoofing reflection...',
    color: c.darkOlive,
    icon: 'refresh-outline',
    ovalBorderColor: c.primary,
    ovalBorderStyle: 'solid',
    loading: true
  },
  VERIFYING: {
    id: 'VERIFYING',
    title: '6. Face Verification in Progress',
    desc: 'Matching face embedding against enrolled template on backend...',
    color: c.primary,
    icon: 'sync-outline',
    ovalBorderColor: c.primary,
    ovalBorderStyle: 'solid',
    loading: true
  },
  VERIFIED: {
    id: 'VERIFIED',
    title: '7. Verification Successful',
    desc: 'Identity confirmed by biometric engine (Match >= 90%).',
    color: c.success,
    icon: 'shield-checkmark',
    ovalBorderColor: c.success,
    ovalBorderStyle: 'solid'
  },
  VERIFICATION_FAILED: {
    id: 'VERIFICATION_FAILED',
    title: '8. Verification Failed',
    desc: 'Biometric match rejected or presentation attack suspected.',
    color: c.danger,
    icon: 'close-circle-outline',
    ovalBorderColor: c.danger,
    ovalBorderStyle: 'solid'
  },
  SERVER_ERROR: {
    id: 'SERVER_ERROR',
    title: '9. Network / Server Error',
    desc: 'Failed to connect to trusted biometric endpoint.',
    color: c.danger,
    icon: 'cloud-offline-outline',
    ovalBorderColor: c.danger,
    ovalBorderStyle: 'dashed'
  },
  MANUAL_REVIEW_REQUIRED: {
    id: 'MANUAL_REVIEW_REQUIRED',
    title: '10. Supervisor Review Required',
    desc: 'Automated engine offline (Phase 1). Submit for supervisor sign-off.',
    color: c.warning,
    icon: 'shield-outline',
    ovalBorderColor: c.warning,
    ovalBorderStyle: 'solid'
  }
});

export const VERIFICATION_STATES = getVerificationStates(lightTheme);

export default function PunchScreen({ attendanceState, onPunchSuccess }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const verificationStates = getVerificationStates(colors);

  const isPunchedIn = attendanceState.isPunchedIn;

  // Selected work mode (defaults to existing mode if shift active, else WFO)
  const [selectedMode, setSelectedMode] = useState(
    isPunchedIn ? attendanceState.mode : 'WFO'
  );

  // Camera state
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState('front');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  // Verification state (Phase 1C state machine)
  const [verificationStateKey, setVerificationStateKey] = useState('FACE_ALIGNED');
  const [isSupervisorReviewMode, setIsSupervisorReviewMode] = useState(false);
  const [showStateTester, setShowStateTester] = useState(false);

  // GPS Location state
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);

  // Review confirmation modal
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [actionSuccessModal, setActionSuccessModal] = useState(null);

  const currentVerifState = verificationStates[verificationStateKey] || verificationStates.FACE_ALIGNED;

  // Request location on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // Sync mode if already punched in
  useEffect(() => {
    if (isPunchedIn && attendanceState.mode) {
      setSelectedMode(attendanceState.mode);
    }
  }, [isPunchedIn, attendanceState.mode]);

  // Sync camera permission state
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted) {
      setVerificationStateKey('CAMERA_PERMISSION_REQUIRED');
    }
  }, [cameraPermission]);

  /**
   * Acquire real device GPS position
   */
  const fetchCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable location access in device settings.');
        setLocationLoading(false);
        return;
      }

      // Check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setLocationError('Device location/GPS is turned off. Please turn on GPS.');
        setLocationLoading(false);
        return;
      }

      // High accuracy GPS reading
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      setCurrentCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp
      });
    } catch (err) {
      console.error('GPS acquisition error:', err);
      setLocationError(err.message || 'Failed to acquire GPS fix. Please retry.');
    } finally {
      setLocationLoading(false);
    }
  };

  /**
   * Capture photo and progress through verification lifecycle
   */
  const handleCapturePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      setIsTakingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7
      });
      if (photo && photo.uri) {
        setCapturedPhotoUri(photo.uri);

        // Transition through verification state sequence
        setVerificationStateKey('LIVENESS_CHECKING');
        setTimeout(() => {
          setVerificationStateKey('VERIFYING');
          setTimeout(() => {
            // Because biometric backend engine is not active yet in Phase 1,
            // transition to MANUAL_REVIEW_REQUIRED to prevent unverified automatic punch!
            setVerificationStateKey('MANUAL_REVIEW_REQUIRED');
          }, 900);
        }, 900);
      }
    } catch (err) {
      console.error('Camera snap error:', err);
      Alert.alert('Camera Error', 'Could not capture photo. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const handleRetakePhoto = () => {
    setCapturedPhotoUri(null);
    setVerificationStateKey('FACE_ALIGNED');
    setIsSupervisorReviewMode(false);
  };

  // Evaluate geofence
  const geofenceResult = evaluateGeofence(currentCoords, mockOfficeGeofence, selectedMode);

  /**
   * Initiate standard review step (Locked in Phase 1 unless verified or supervisor approved)
   */
  const handleProceedToReview = (asSupervisorOverride = false) => {
    if (!capturedPhotoUri) {
      Alert.alert('Photo Required', 'Please take a real selfie photo using the camera before proceeding.');
      return;
    }

    if (!currentCoords) {
      Alert.alert(
        'GPS Required',
        locationError || 'Waiting for real GPS coordinates. Please wait or tap "Retry GPS".'
      );
      return;
    }

    setIsSupervisorReviewMode(asSupervisorOverride);
    setReviewModalVisible(true);
  };

  /**
   * Final confirmation of Punch In or Punch Out
   */
  const handleConfirmPunch = () => {
    setReviewModalVisible(false);

    // Strict session conflict guard: prevent duplicate Punch In and invalid Punch Out
    if (!isPunchedIn && attendanceState.isPunchedIn) {
      Alert.alert('Session Conflict', 'You already have an active shift in progress. Duplicate Punch In is prevented.');
      return;
    }
    if (isPunchedIn && !attendanceState.isPunchedIn) {
      Alert.alert('Session Conflict', 'No active shift is currently logged to punch out from.');
      return;
    }

    const punchAction = isPunchedIn ? 'Punch Out' : 'Punch In';
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const punchRecord = {
      action: punchAction,
      mode: selectedMode,
      photoUri: capturedPhotoUri,
      coords: currentCoords,
      geofenceResult: geofenceResult,
      timestamp: timeStr,
      dateString: now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      // Audit details
      verificationStatus: isSupervisorReviewMode ? 'Supervisor Review Required (Queued)' : 'Biometric Match Pending Engine',
      isSupervisorOverride: isSupervisorReviewMode,
      verificationEngineStatus: 'Disconnected (Phase 1 UI Preparation)'
    };

    // Propagate to parent state
    onPunchSuccess(punchRecord);

    // Show success dialog
    setActionSuccessModal({
      action: punchAction,
      time: timeStr,
      mode: selectedMode,
      photoUri: capturedPhotoUri,
      statusLabel: isSupervisorReviewMode ? 'Submitted for Supervisor Approval' : geofenceResult.statusLabel
    });

    // Reset captured photo so next action requires a fresh photo
    setCapturedPhotoUri(null);
    setVerificationStateKey('FACE_ALIGNED');
    setIsSupervisorReviewMode(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Session State Banner */}
      <View style={[
        styles.sessionStatusBanner,
        isPunchedIn ? styles.sessionStatusBannerActive : styles.sessionStatusBannerIdle
      ]}>
        <View style={[
          styles.sessionStatusDot,
          { backgroundColor: isPunchedIn ? colors.success : (attendanceState.isPunchedOut ? colors.primary : colors.warning) }
        ]} />
        <Text style={styles.sessionStatusText}>
          {isPunchedIn
            ? `Active Shift in Progress • ${attendanceState.mode} Mode (Started ${attendanceState.punchInTime})`
            : (attendanceState.isPunchedOut
                ? `Shift Completed Today (${attendanceState.lastPunchOutTime || 'Logged'})`
                : 'Not Punched In Today • Ready to Start Shift')}
        </Text>
      </View>

      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isPunchedIn ? 'End Shift (Punch Out)' : 'Start Shift (Punch In)'}
        </Text>
        <Text style={styles.subtitle}>
          Real-time selfie photo & device GPS verification required
        </Text>
      </View>

      {/* Mode Selector (WFO vs WFH) */}
      <View style={styles.modeContainer}>
        <Text style={styles.sectionLabel}>
          Work Mode: {isPunchedIn ? '(Active Shift Mode)' : '(Select Mode)'}
        </Text>
        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            disabled={isPunchedIn}
            style={[
              styles.modeBtn,
              selectedMode === 'WFO' && styles.modeBtnActive,
              isPunchedIn && selectedMode !== 'WFO' && styles.modeBtnDisabled
            ]}
            onPress={() => setSelectedMode('WFO')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="business"
              size={18}
              color={selectedMode === 'WFO' ? '#ffffff' : '#94a3b8'}
            />
            <Text style={[styles.modeBtnText, selectedMode === 'WFO' && styles.modeBtnTextActive]}>
              Work From Office (WFO)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={isPunchedIn}
            style={[
              styles.modeBtn,
              selectedMode === 'WFH' && styles.modeBtnActivePurple,
              isPunchedIn && selectedMode !== 'WFH' && styles.modeBtnDisabled
            ]}
            onPress={() => setSelectedMode('WFH')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="home"
              size={18}
              color={selectedMode === 'WFH' ? '#ffffff' : '#94a3b8'}
            />
            <Text style={[styles.modeBtnText, selectedMode === 'WFH' && styles.modeBtnTextActive]}>
              Work From Home (WFH)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Biometric Verification Status & State Machine Banner (Phase 1C) */}
      <View style={[styles.biometricStateCard, { borderColor: currentVerifState.color }]}>
        <View style={styles.biometricStateTopRow}>
          <View style={[styles.stateIconCircle, { backgroundColor: currentVerifState.color + '22' }]}>
            {currentVerifState.loading ? (
              <ActivityIndicator size="small" color={currentVerifState.color} />
            ) : (
              <Ionicons name={currentVerifState.icon} size={20} color={currentVerifState.color} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stateTitleText, { color: currentVerifState.color }]}>
              {currentVerifState.title}
            </Text>
            <Text style={styles.stateDescText}>{currentVerifState.desc}</Text>
          </View>
          <TouchableOpacity
            style={styles.testerToggleBtn}
            onPress={() => setShowStateTester(!showStateTester)}
            activeOpacity={0.7}
          >
            <Text style={styles.testerToggleText}>{showStateTester ? 'Hide' : 'Test 10 States'}</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive Verification State Simulator for QA / Inspection */}
        {showStateTester && (
          <View style={styles.stateTesterBox}>
            <Text style={styles.testerHeading}>Inspect Phase 1C Verification UI States:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              {Object.keys(VERIFICATION_STATES).map(key => {
                const s = VERIFICATION_STATES[key];
                const isSelected = verificationStateKey === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.testerPill, isSelected && { backgroundColor: s.color, borderColor: s.color }]}
                    onPress={() => setVerificationStateKey(key)}
                  >
                    <Text style={[styles.testerPillText, isSelected && { color: '#ffffff', fontWeight: '800' }]}>
                      {s.title.split('.')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Real Camera Frame with Dynamic Oval Alignment Styling */}
      <View style={styles.cameraBox}>
        <View style={styles.cameraFrame}>
          {capturedPhotoUri ? (
            // Preview captured photo with Retake option
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: capturedPhotoUri }} style={styles.photoPreview} />
              <View style={[styles.capturedBadge, { backgroundColor: currentVerifState.color }]}>
                <Ionicons name={currentVerifState.icon} size={15} color="#ffffff" />
                <Text style={styles.capturedBadgeText}>
                  {currentVerifState.title.split('. ')[1] || 'PHOTO CAPTURED'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleRetakePhoto}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#ffffff" />
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : !cameraPermission ? (
            // Permission loading
            <View style={styles.cameraCenterMessage}>
              <ActivityIndicator size="small" color="#38bdf8" />
              <Text style={styles.cameraMessageText}>Checking camera permissions...</Text>
            </View>
          ) : !cameraPermission.granted ? (
            // Permission request UI
            <View style={styles.cameraCenterMessage}>
              <Ionicons name="camera-outline" size={42} color="#ef4444" />
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                A live selfie photo is required to verify identity for punch in and punch out.
              </Text>
              <TouchableOpacity
                style={styles.permissionBtn}
                onPress={requestCameraPermission}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Live Camera View
            <>
              <CameraView
                ref={cameraRef}
                style={styles.liveCameraView}
                facing={cameraFacing}
              />

              {/* Dynamic Face Guide Oval (Colors & Borders mapped to verification state) */}
              <View
                style={[
                  styles.faceOvalGuide,
                  {
                    borderColor: currentVerifState.ovalBorderColor,
                    borderStyle: currentVerifState.ovalBorderStyle,
                    borderWidth: currentVerifState.ovalBorderStyle === 'solid' ? 3 : 2
                  }
                ]}
                pointerEvents="none"
              />

              {/* Camera Overlays */}
              <View style={styles.cameraOverlayTop}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    LIVE CAMERA ({cameraFacing.toUpperCase()})
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.camSwitchBtn}
                  onPress={() => setCameraFacing(prev => (prev === 'front' ? 'back' : 'front'))}
                >
                  <Ionicons name="camera-reverse" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Shutter Capture Button */}
              <View style={styles.cameraOverlayBottom}>
                <TouchableOpacity
                  style={styles.shutterBtn}
                  onPress={handleCapturePhoto}
                  disabled={isTakingPhoto}
                  activeOpacity={0.8}
                >
                  {isTakingPhoto ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.shutterInner} />
                  )}
                </TouchableOpacity>
                <Text style={styles.shutterLabel}>Tap circle to capture photo</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Real GPS Location Card */}
      <View style={styles.gpsCard}>
        <View style={styles.gpsHeader}>
          <Ionicons name="location" size={20} color="#38bdf8" />
          <Text style={styles.gpsTitle}>Real Device GPS Location</Text>
          <TouchableOpacity
            style={styles.refreshGpsBtn}
            onPress={fetchCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color="#38bdf8" />
            ) : (
              <Ionicons name="refresh" size={16} color="#38bdf8" />
            )}
          </TouchableOpacity>
        </View>

        {locationLoading && !currentCoords ? (
          <View style={styles.loadingGpsRow}>
            <ActivityIndicator size="small" color="#38bdf8" />
            <Text style={styles.loadingGpsText}>Acquiring high-accuracy GPS fix...</Text>
          </View>
        ) : locationError ? (
          <View style={styles.errorGpsBox}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorGpsText}>{locationError}</Text>
          </View>
        ) : currentCoords ? (
          <>
            <View style={styles.gpsDetailsRow}>
              <View>
                <Text style={styles.coordsText}>
                  Lat: {currentCoords.latitude.toFixed(6)}°  •  Lng: {currentCoords.longitude.toFixed(6)}°
                </Text>
                <Text style={styles.coordsSubtext}>
                  Accuracy: ±{currentCoords.accuracy ? currentCoords.accuracy.toFixed(1) : '—'}m • Captured:{' '}
                  {new Date(currentCoords.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              </View>
            </View>

            {/* Real Geofence Evaluation Status */}
            <View style={[styles.geofenceStatusBox, { borderColor: geofenceResult.color }]}>
              <Ionicons
                name={geofenceResult.isInside ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={geofenceResult.color}
              />
              <Text style={[styles.geofenceStatusText, { color: geofenceResult.color }]}>
                {geofenceResult.statusLabel}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Step Checklist Indicator */}
      <View style={styles.checklistCard}>
        <Text style={styles.checklistHeader}>Requirements for {isPunchedIn ? 'Punch Out' : 'Punch In'}:</Text>
        <View style={styles.checkItem}>
          <Ionicons
            name={capturedPhotoUri ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={capturedPhotoUri ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.checkText, capturedPhotoUri && styles.checkTextDone]}>
            Real selfie photo captured
          </Text>
        </View>
        <View style={styles.checkItem}>
          <Ionicons
            name={currentCoords ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={currentCoords ? '#10b981' : '#64748b'}
          />
          <Text style={[styles.checkText, currentCoords && styles.checkTextDone]}>
            Device GPS coordinates acquired
          </Text>
        </View>
        <View style={styles.checkItem}>
          <Ionicons
            name={verificationStateKey === 'VERIFIED' ? 'checkmark-circle' : 'alert-circle-outline'}
            size={16}
            color={verificationStateKey === 'VERIFIED' ? '#10b981' : '#f59e0b'}
          />
          <Text style={[styles.checkText, verificationStateKey === 'VERIFIED' && styles.checkTextDone]}>
            Biometric verification engine: {verificationStateKey === 'VERIFIED' ? 'Verified' : 'Pending Phase 2 Engine'}
          </Text>
        </View>
      </View>

      {/* SECURE PUNCH ACTIONS (Phase 1C Lockdown & Supervisor Review Fallback) */}
      <View style={styles.actionsContainer}>
        {/* Direct Punch Button is strictly locked when automated engine is not connected */}
        <TouchableOpacity
          style={[styles.bigActionBtn, styles.bigActionBtnDisabled]}
          disabled={true}
          activeOpacity={1}
        >
          <Ionicons name="lock-closed" size={18} color="#94a3b8" />
          <Text style={[styles.bigActionBtnText, { color: '#94a3b8' }]}>
            Direct Punch Locked (Biometric Engine Inactive)
          </Text>
        </TouchableOpacity>

        {/* Phase 1 Fallback: Supervisor Manual Review Request */}
        <TouchableOpacity
          style={[
            styles.supervisorReviewBtn,
            (!capturedPhotoUri || !currentCoords) && styles.supervisorReviewBtnDisabled
          ]}
          onPress={() => handleProceedToReview(true)}
          disabled={!capturedPhotoUri || !currentCoords}
          activeOpacity={0.85}
        >
          <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
          <Text style={styles.supervisorReviewBtnText}>
            Request Supervisor Manual Punch Approval
          </Text>
        </TouchableOpacity>
        <Text style={styles.supervisorHelpText}>
          Submits photo and GPS proof to Team Leader (Priya Nambiar) for verified manual approval.
        </Text>
      </View>

      {/* ========================================================================= */}
      {/* REVIEW & CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reviewModalVisible}
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <Ionicons
                name={isPunchedIn ? 'exit-outline' : 'finger-print'}
                size={24}
                color={isPunchedIn ? '#ef4444' : '#38bdf8'}
              />
              <Text style={styles.modalHeading}>
                Confirm {isPunchedIn ? 'Punch Out' : 'Punch In'}
              </Text>
            </View>

            {isSupervisorReviewMode ? (
              <View style={styles.overrideNoticeBox}>
                <Ionicons name="shield-half-outline" size={16} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overrideNoticeTitle}>SUBMITTING FOR MANUAL SUPERVISOR REVIEW</Text>
                  <Text style={styles.overrideNoticeDesc}>
                    Automated biometric recognition is inactive in Phase 1. This punch will be logged with selfie and GPS proof for Team Leader manual sign-off.
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.modalSubheading}>
                Please verify your photo and location before recording attendance.
              </Text>
            )}

            {/* Photo & Details preview */}
            <View style={styles.reviewBody}>
              {capturedPhotoUri && (
                <Image source={{ uri: capturedPhotoUri }} style={styles.reviewPhoto} />
              )}
              <View style={styles.reviewInfoList}>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Mode:</Text>
                  <Text style={styles.reviewItemValue}>{selectedMode}</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>GPS Latitude:</Text>
                  <Text style={styles.reviewItemValue}>{currentCoords?.latitude.toFixed(6)}°</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>GPS Longitude:</Text>
                  <Text style={styles.reviewItemValue}>{currentCoords?.longitude.toFixed(6)}°</Text>
                </View>
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewItemLabel}>Accuracy:</Text>
                  <Text style={styles.reviewItemValue}>±{currentCoords?.accuracy?.toFixed(1)}m</Text>
                </View>
              </View>
            </View>

            <View style={[styles.modalGeofenceBox, { borderColor: geofenceResult.color }]}>
              <Text style={[styles.modalGeofenceText, { color: geofenceResult.color }]}>
                {geofenceResult.statusLabel}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReviewModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  isPunchedIn ? styles.modalConfirmBtnRed : styles.modalConfirmBtnBlue
                ]}
                onPress={handleConfirmPunch}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {isSupervisorReviewMode ? 'Submit for TL Approval' : `Confirm ${isPunchedIn ? 'Punch Out' : 'Punch In'}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* FINAL SUCCESS MODAL */}
      {/* ========================================================================= */}
      {actionSuccessModal && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setActionSuccessModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCardSuccess}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={36} color="#ffffff" />
              </View>
              <Text style={styles.successHeading}>
                {actionSuccessModal.action} Recorded Locally!
              </Text>
              <Text style={styles.successSubtext}>
                Recorded at {actionSuccessModal.time} • Mode: {actionSuccessModal.mode}
              </Text>

              <View style={styles.successPreviewRow}>
                <Image source={{ uri: actionSuccessModal.photoUri }} style={styles.successPhotoThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successDetailText}>
                    <Text style={styles.successDetailBold}>Photo:</Text> Verified Real Capture
                  </Text>
                  <Text style={styles.successDetailText}>
                    <Text style={styles.successDetailBold}>Status:</Text> {actionSuccessModal.statusLabel}
                  </Text>
                  <Text style={styles.successNotice}>
                    Stored in local app state (database sync arrives in Stage 2).
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successDismissBtn}
                onPress={() => setActionSuccessModal(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.successDismissBtnText}>Continue to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  sessionStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  sessionStatusBannerActive: {
    backgroundColor: colors.surfaceBeige,
    borderColor: colors.border,
  },
  sessionStatusBannerIdle: {
    backgroundColor: colors.surfaceBeige,
    borderColor: colors.border,
  },
  sessionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2
  },
  modeContainer: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkOlive,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 10
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark
  },
  modeBtnActivePurple: {
    backgroundColor: colors.darkOlive,
    borderColor: colors.darkOlive
  },
  modeBtnDisabled: {
    opacity: 0.4
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary
  },
  modeBtnTextActive: {
    color: '#ffffff'
  },
  cameraBox: {
    marginBottom: 16
  },
  cameraFrame: {
    height: 310,
    backgroundColor: colors.cameraBackdrop,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: colors.cameraFrameBorder
  },
  liveCameraView: {
    flex: 1,
    width: '100%'
  },
  faceOvalGuide: {
    position: 'absolute',
    top: '12%',
    left: '25%',
    width: '50%',
    height: '62%',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 100,
    borderStyle: 'dashed'
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 35, 25, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f8fafc'
  },
  camSwitchBtn: {
    backgroundColor: 'rgba(30, 35, 25, 0.85)',
    padding: 8,
    borderRadius: 8
  },
  cameraOverlayBottom: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6
  },
  shutterBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff'
  },
  shutterInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff'
  },
  shutterLabel: {
    fontSize: 11,
    color: '#ffffff',
    backgroundColor: 'rgba(30, 35, 25, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6
  },
  photoPreviewContainer: {
    flex: 1,
    position: 'relative'
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  capturedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 35, 25, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  capturedBadgeText: {
    color: colors.success,
    fontWeight: '800',
    fontSize: 11
  },
  retakeButton: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12
  },
  retakeButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700'
  },
  cameraCenterMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12
  },
  cameraMessageText: {
    color: colors.textSecondary,
    fontSize: 13
  },
  permissionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700'
  },
  permissionDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6
  },
  permissionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  gpsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 8
  },
  refreshGpsBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.lightOlive
  },
  loadingGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8
  },
  loadingGpsText: {
    color: colors.textSecondary,
    fontSize: 12
  },
  errorGpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    padding: 10,
    borderRadius: 8
  },
  errorGpsText: {
    color: colors.danger,
    fontSize: 12,
    flex: 1
  },
  gpsDetailsRow: {
    marginBottom: 10
  },
  coordsText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: 'monospace'
  },
  coordsSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3
  },
  geofenceStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1
  },
  geofenceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  checklistCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20
  },
  checklistHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkOlive,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  checkText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  checkTextDone: {
    color: colors.textPrimary,
    fontWeight: '600'
  },
  bigActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    elevation: 4
  },
  bigActionBtnBlue: {
    backgroundColor: colors.primary
  },
  bigActionBtnRed: {
    backgroundColor: colors.danger
  },
  bigActionBtnDisabled: {
    opacity: 0.5
  },
  bigActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(41, 45, 38, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary
  },
  modalSubheading: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16
  },
  reviewBody: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  reviewPhoto: {
    width: 80,
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover'
  },
  reviewInfoList: {
    flex: 1,
    justifyContent: 'center'
  },
  reviewItem: {
    marginBottom: 4
  },
  reviewItemLabel: {
    fontSize: 10,
    color: colors.textSecondary
  },
  reviewItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary
  },
  modalGeofenceBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.beige,
    marginBottom: 18
  },
  modalGeofenceText: {
    fontSize: 11,
    fontWeight: '600'
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  modalCancelBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600'
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  modalConfirmBtnBlue: {
    backgroundColor: colors.primary
  },
  modalConfirmBtnRed: {
    backgroundColor: colors.danger
  },
  modalConfirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  modalCardSuccess: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center'
  },
  successSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16
  },
  successPreviewRow: {
    width: '100%',
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  successPhotoThumb: {
    width: 60,
    height: 75,
    borderRadius: 8,
    resizeMode: 'cover'
  },
  successDetailText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4
  },
  successDetailBold: {
    fontWeight: '700',
    color: colors.textPrimary
  },
  successNotice: {
    fontSize: 10,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600'
  },
  successDismissBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  successDismissBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  // Phase 1C Biometric State Banner & Tester Styles
  biometricStateCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 16
  },
  biometricStateTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  stateIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stateTitleText: {
    fontSize: 13,
    fontWeight: '800'
  },
  stateDescText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16
  },
  testerToggleBtn: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  testerToggleText: {
    color: colors.darkOlive,
    fontSize: 10,
    fontWeight: '700'
  },
  stateTesterBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  testerHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  testerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 6
  },
  testerPillText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  actionsContainer: {
    gap: 10,
    marginBottom: 20
  },
  supervisorReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.warning,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3
  },
  supervisorReviewBtnDisabled: {
    opacity: 0.4
  },
  supervisorReviewBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  supervisorHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 10
  },
  overrideNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  overrideNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warningDark
  },
  overrideNoticeDesc: {
    fontSize: 10,
    color: colors.textPrimary,
    marginTop: 2,
    lineHeight: 14
  }
});
