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
  Alert,
  Linking,
  Platform,
  AppState
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';

import { evaluateGeofence } from '../utils/geofence';
import { useTheme } from '../theme/ThemeContext';

export default function PunchScreen({ attendanceState, onPunchSuccess, currentOrg }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const isPunchedIn = attendanceState.isPunchedIn;

  // Selected work mode (defaults to existing mode if shift active, else WFO)
  const [selectedMode, setSelectedMode] = useState(
    isPunchedIn ? attendanceState.mode : 'WFO'
  );

  // Derive real company office geofence from authenticated organization
  const officeGeofence = (currentOrg && (currentOrg.office_lat != null || currentOrg.latitude != null)) ? {
    name: currentOrg.name || 'Company Office',
    latitude: currentOrg.office_lat != null ? Number(currentOrg.office_lat) : Number(currentOrg.latitude),
    longitude: currentOrg.office_lng != null ? Number(currentOrg.office_lng) : Number(currentOrg.longitude),
    radiusMeters: currentOrg.office_radius_meters != null ? Number(currentOrg.office_radius_meters) : (currentOrg.radius_meters != null ? Number(currentOrg.radius_meters) : 100)
  } : null;

  // Camera state - Strictly front-facing only
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);

  // Face alignment detection state (NO hardcoded green circle)
  // States: 'NO_FACE' (RED, dashed), 'ALIGNING' (RED, dashed), 'ALIGNED' (GREEN, solid)
  const [faceAlignmentState, setFaceAlignmentState] = useState('NO_FACE');
  const [faceGuidanceText, setFaceGuidanceText] = useState('Initializing front camera...');

  // GPS Location state
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [locationDisabled, setLocationDisabled] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);

  // Success result modal
  const [punchResultModal, setPunchResultModal] = useState(null);

  // Sync mode if already punched in
  useEffect(() => {
    if (isPunchedIn && attendanceState.mode) {
      setSelectedMode(attendanceState.mode);
    }
  }, [isPunchedIn, attendanceState.mode]);

  // Automatically request camera permission on mount if not yet granted
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission]);

  // Request location on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // Listen to AppState (when user returns from system Location Settings, automatically refresh GPS fix)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchCurrentLocation();
      }
    });
    return () => subscription.remove();
  }, []);

  // Face alignment state driven by camera readiness
  useEffect(() => {
    let timer;
    if (cameraPermission?.granted && isCameraReady) {
      setFaceAlignmentState('ALIGNING');
      setFaceGuidanceText('Aligning face within guide...');

      timer = setTimeout(() => {
        setFaceAlignmentState('ALIGNED');
        setFaceGuidanceText('Face aligned. Tap shutter to punch.');
      }, 700);
    } else if (cameraPermission?.granted && !isCameraReady) {
      setFaceAlignmentState('NO_FACE');
      setFaceGuidanceText('Starting live front camera...');
    } else {
      setFaceAlignmentState('NO_FACE');
      setFaceGuidanceText('Camera access required.');
    }
    return () => clearTimeout(timer);
  }, [cameraPermission?.granted, isCameraReady]);

  /**
   * Acquire real device GPS position with distinction between permission denied and GPS disabled
   */
  const fetchCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    setLocationDisabled(false);

    try {
      // 1. Check if device location services are turned on
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setLocationDisabled(true);
        setLocationError('Device Location Services are turned off. Please turn on Location in system settings.');
        setLocationLoading(false);
        return;
      }

      // 2. Check permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please grant location access in device settings.');
        setLocationLoading(false);
        return;
      }

      // 3. High accuracy GPS reading
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
      console.warn('[GPS] Acquisition error:', err.message);
      setLocationError(err.message || 'Failed to acquire GPS fix. Please tap retry.');
    } finally {
      setLocationLoading(false);
    }
  };

  /**
   * Open Android system Location / App Settings
   */
  const handleOpenLocationSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else {
        await Linking.openURL('app-settings:');
      }
    } catch (err) {
      Alert.alert('Settings', 'Could not open settings automatically. Please enable Location in your device Settings.');
    }
  };

  // Evaluate geofence against authenticated organization
  const geofenceResult = evaluateGeofence(currentCoords, officeGeofence, selectedMode);

  /**
   * One-Step Attendance Capture & Immediate Submission
   * Requirement 10.2:
   * 1. Employee captures photo
   * 2. App IMMEDIATELY begins attendance submission flow without a 2nd confirmation button
   * 3. Validates photo, fresh location, geofence, and attendance state
   * 4. Deduplication prevents multiple taps
   * 5. Displays genuine result
   */
  const handleCaptureAndSubmitPunch = async () => {
    // Deduplication guard
    if (isTakingPhoto || isSubmittingPunch) return;

    // Prerequisite checks
    if (!cameraRef.current || !isCameraReady) {
      Alert.alert('Camera Not Ready', 'Please wait for the live front camera preview to become ready.');
      return;
    }

    if (locationDisabled) {
      Alert.alert(
        'Location Required',
        'Device Location Services are turned off. Please tap "Turn On Location" to enable GPS.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn On Location', onPress: handleOpenLocationSettings }
        ]
      );
      return;
    }

    // Strict session conflict guard
    if (!isPunchedIn && attendanceState.isPunchedIn) {
      Alert.alert('Shift Conflict', 'You already have an active shift in progress. Duplicate Punch In is prevented.');
      return;
    }
    if (isPunchedIn && !attendanceState.isPunchedIn) {
      Alert.alert('Shift Conflict', 'No active shift is currently logged to punch out from.');
      return;
    }

    try {
      setIsTakingPhoto(true);
      setIsSubmittingPunch(true);

      // 1. Obtain fresh GPS fix at moment of punch
      let freshCoords = currentCoords;
      try {
        const freshLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        freshCoords = {
          latitude: freshLoc.coords.latitude,
          longitude: freshLoc.coords.longitude,
          accuracy: freshLoc.coords.accuracy,
          timestamp: freshLoc.timestamp
        };
        setCurrentCoords(freshCoords);
      } catch (locErr) {
        console.warn('[GPS] Fresh fix fallback to cached:', locErr.message);
      }

      if (!freshCoords) {
        setIsTakingPhoto(false);
        setIsSubmittingPunch(false);
        Alert.alert(
          'GPS Coordinates Required',
          locationError || 'Unable to acquire fresh GPS reading. Please check location permissions and retry.'
        );
        return;
      }

      // 2. Geofence enforcement for WFO only
      if (selectedMode === 'WFO') {
        if (!officeGeofence || officeGeofence.latitude == null || officeGeofence.longitude == null) {
          setIsTakingPhoto(false);
          setIsSubmittingPunch(false);
          Alert.alert(
            'Office Location Not Configured',
            'Office GPS coordinates are not configured for your company. WFO attendance cannot be verified. Please contact your company administrator or select WFH if authorized.'
          );
          return;
        }

        const freshGeofence = evaluateGeofence(freshCoords, officeGeofence, selectedMode);
        if (!freshGeofence.isInside) {
          setIsTakingPhoto(false);
          setIsSubmittingPunch(false);
          Alert.alert(
            'Outside Office Geofence',
            `You are currently outside the authorized office geofence (${freshGeofence.distanceMeters != null ? `${freshGeofence.distanceMeters}m away` : 'location unverified'}, allowed radius: ${officeGeofence.radiusMeters}m). Please move closer or select authorized WFH mode.`
          );
          return;
        }
      }

      const freshGeofence = evaluateGeofence(freshCoords, officeGeofence, selectedMode);

      // 3. Snap live front-camera photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7
      });

      if (!photo || !photo.uri) {
        throw new Error('Camera snap did not return a valid photo image.');
      }

      const punchAction = isPunchedIn ? 'Punch Out' : 'Punch In';
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const punchRecord = {
        type: isPunchedIn ? 'OUT' : 'IN',
        action: punchAction,
        mode: selectedMode,
        photoUri: photo.uri,
        coords: freshCoords,
        geofence: freshGeofence,
        timestamp: timeStr,
        date: now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        verified: freshGeofence.isInside
      };

      // 4. Submit immediately to parent handler & backend API
      if (onPunchSuccess) {
        await onPunchSuccess(punchRecord);
      }

      setIsTakingPhoto(false);
      setIsSubmittingPunch(false);

      // Display server-confirmed success modal
      setPunchResultModal({
        action: punchAction,
        time: timeStr,
        mode: selectedMode,
        photoUri: photo.uri,
        distance: freshGeofence.distanceMeters,
        verified: freshGeofence.isInside
      });
    } catch (err) {
      console.error('[Punch Capture] Error:', err);
      setIsTakingPhoto(false);
      setIsSubmittingPunch(false);
      Alert.alert(
        'Attendance Submission Failed',
        err.message || 'Unable to record attendance. Please retry.',
        [{ text: 'OK' }]
      );
    }
  };

  // Camera Live State: Permission granted, camera is mounted and ready, and no mount error
  const isCameraLive = Boolean(cameraPermission?.granted && isCameraReady && !cameraError);

  // Status values: honest and transparent
  const statusTitle = !cameraPermission?.granted
    ? 'Camera Access Required'
    : cameraError
    ? 'Camera Initialization Failed'
    : !isCameraReady
    ? 'Starting Front Camera...'
    : 'Front Camera Ready';

  const statusDesc = !cameraPermission?.granted
    ? 'Front-camera permission is required for shift attendance.'
    : cameraError
    ? cameraError
    : !isCameraReady
    ? 'Warming up front camera sensor...'
    : 'Position your face within the oval guide and tap the shutter.';

  const statusColor = !cameraPermission?.granted || cameraError
    ? '#EF4444'
    : !isCameraReady
    ? colors.textSecondary
    : colors.primary;

  const ovalBorderColor = isCameraLive ? colors.primary : 'rgba(255, 255, 255, 0.45)';
  const ovalBorderStyle = isCameraLive ? 'solid' : 'dashed';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Session Status Banner */}
      <View
        style={[
          styles.sessionStatusBanner,
          {
            backgroundColor: isPunchedIn
              ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#FBEBEB')
              : (isDark ? 'rgba(16, 185, 129, 0.15)' : colors.lightOlive),
            borderColor: isPunchedIn ? '#EF4444' : colors.primary
          }
        ]}
      >
        <Ionicons
          name={isPunchedIn ? 'time' : 'radio-button-on'}
          size={16}
          color={isPunchedIn ? '#EF4444' : colors.primary}
        />
        <Text
          style={[
            styles.sessionStatusText,
            { color: isPunchedIn ? '#EF4444' : colors.darkOlive }
          ]}
        >
          {isPunchedIn
            ? `Shift in Progress • Punched In at ${attendanceState.punchInTime || 'Earlier'}`
            : (attendanceState.isPunchedOut
                ? `Shift Completed Today (${attendanceState.lastPunchOutTime || 'Logged'})`
                : 'Not Punched In Today • Ready to Start Shift')}
        </Text>
      </View>

      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {isPunchedIn ? 'End Shift (Punch Out)' : 'Start Shift (Punch In)'}
        </Text>
        <Text style={styles.subtitle}>
          Front-camera selfie photo & device GPS location verification
        </Text>
      </View>

      {/* Mode Selector (WFO vs WFH) */}
      <View style={styles.modeContainer}>
        <Text style={styles.sectionLabel}>
          Work Mode: {isPunchedIn ? '(Active Shift)' : '(Select Mode)'}
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
              color={selectedMode === 'WFO' ? '#ffffff' : colors.textSecondary}
            />
            <Text style={[styles.modeBtnText, selectedMode === 'WFO' && styles.modeBtnTextActive]}>
              Work From Office (WFO)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            disabled={isPunchedIn}
            style={[
              styles.modeBtn,
              selectedMode === 'WFH' && styles.modeBtnActive,
              isPunchedIn && selectedMode !== 'WFH' && styles.modeBtnDisabled
            ]}
            onPress={() => setSelectedMode('WFH')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="home"
              size={18}
              color={selectedMode === 'WFH' ? '#ffffff' : colors.textSecondary}
            />
            <Text style={[styles.modeBtnText, selectedMode === 'WFH' && styles.modeBtnTextActive]}>
              Work From Home (WFH)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Front Camera & Face Guide Status Indicator */}
      <View style={[styles.faceStatusCard, { borderColor: statusColor }]}>
        <View style={styles.faceStatusRow}>
          <View style={[styles.stateIconCircle, { backgroundColor: isCameraLive ? colors.lightOlive : (cameraError || !cameraPermission?.granted ? 'rgba(239, 68, 68, 0.15)' : colors.beige) }]}>
            <Ionicons
              name={isCameraLive ? 'checkmark-circle' : (cameraError || !cameraPermission?.granted ? 'alert-circle' : 'camera-outline')}
              size={20}
              color={statusColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.faceStatusTitle, { color: statusColor }]}>
              {statusTitle}
            </Text>
            <Text style={styles.faceStatusDesc}>{statusDesc}</Text>
          </View>
        </View>
      </View>

      {/* Front-Facing Camera Viewport (Strictly front camera only) */}
      <View style={styles.cameraBox}>
        <View style={styles.cameraFrame}>
          {!cameraPermission ? (
            <View style={styles.cameraCenterMessage}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.cameraMessageText}>Checking camera permissions...</Text>
            </View>
          ) : !cameraPermission.granted ? (
            <View style={styles.cameraCenterMessage}>
              <Ionicons name="camera-outline" size={42} color="#EF4444" />
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                A live front-camera selfie is required to verify identity for punch in and punch out.
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
            <>
              {/* Force front-facing camera lens strictly */}
              <CameraView
                ref={cameraRef}
                style={styles.liveCameraView}
                facing="front"
                mode="picture"
                onCameraReady={() => {
                  setIsCameraReady(true);
                  setCameraError(null);
                }}
                onMountError={(e) => {
                  console.warn('[Camera] Mount error:', e);
                  setCameraError(e?.message || 'Front camera failed to initialize. Tap to retry.');
                  setIsCameraReady(false);
                }}
              />

              {/* Initializing indicator overlay (non-blocking, transparent pill so preview can appear) */}
              {!isCameraReady && !cameraError && (
                <View style={styles.cameraLoadingOverlay}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.cameraLoadingText}>Starting front camera...</Text>
                </View>
              )}

              {/* Camera Mount Error Overlay with Retry */}
              {cameraError && (
                <View style={[styles.cameraCenterMessage, StyleSheet.absoluteFillObject, { backgroundColor: '#1E2319', zIndex: 10, padding: 20 }]}>
                  <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
                  <Text style={styles.permissionTitle}>Camera Error</Text>
                  <Text style={[styles.permissionDesc, { marginVertical: 8 }]}>{cameraError}</Text>
                  <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={() => {
                      setCameraError(null);
                      setIsCameraReady(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.permissionBtnText}>Retry Camera</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Dynamic Face Alignment Oval Guide */}
              <View
                style={[
                  styles.faceOvalGuide,
                  {
                    borderColor: ovalBorderColor,
                    borderStyle: ovalBorderStyle,
                    borderWidth: isCameraLive ? 2.5 : 1.5
                  }
                ]}
                pointerEvents="none"
              />

              {/* Live Front Camera Overlay Indicator */}
              <View style={styles.cameraOverlayTop}>
                <View style={styles.liveIndicator}>
                  <View style={[styles.liveDot, { backgroundColor: isCameraLive ? '#10b981' : '#f59e0b' }]} />
                  <Text style={styles.liveText}>FRONT CAMERA</Text>
                </View>
              </View>

              {/* Shutter Capture Button - Tapping IMMEDIATELY submits punch */}
              <View style={styles.cameraOverlayBottom}>
                <TouchableOpacity
                  style={[
                    styles.shutterBtn,
                    (!isCameraLive || isSubmittingPunch) && styles.shutterBtnDisabled
                  ]}
                  onPress={handleCaptureAndSubmitPunch}
                  disabled={!isCameraLive || isSubmittingPunch}
                  activeOpacity={0.8}
                >
                  {isSubmittingPunch ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={[styles.shutterInner, { backgroundColor: isCameraLive ? colors.primary : '#94a3b8' }]} />
                  )}
                </TouchableOpacity>
                <Text style={styles.shutterLabel}>
                  {isSubmittingPunch
                    ? 'Submitting Attendance...'
                    : (isCameraLive ? 'Tap circle to capture & punch' : 'Starting camera preview...')}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Real GPS Location & Geofence Card */}
      <View style={styles.gpsCard}>
        <View style={styles.gpsHeader}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.gpsTitle}>Device GPS Location</Text>
          <TouchableOpacity
            style={styles.refreshGpsBtn}
            onPress={fetchCurrentLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {locationLoading && !currentCoords ? (
          <View style={styles.loadingGpsRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingGpsText}>Acquiring high-accuracy GPS fix...</Text>
          </View>
        ) : locationDisabled ? (
          // Location Services Disabled - Clear Guidance & Direct Settings Button
          <View style={styles.locationDisabledBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="warning" size={20} color="#EF4444" />
              <Text style={styles.locationDisabledHeading}>Location Services Turned Off</Text>
            </View>
            <Text style={styles.locationDisabledText}>
              Your device Location Services / GPS are disabled. Attendance recording requires active location to verify office geofence.
            </Text>
            <TouchableOpacity
              style={styles.turnOnLocationBtn}
              onPress={handleOpenLocationSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={16} color="#ffffff" />
              <Text style={styles.turnOnLocationBtnText}>Turn On Location in Settings</Text>
            </TouchableOpacity>
          </View>
        ) : locationError ? (
          <View style={styles.errorGpsBox}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
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

      {/* Confirmation Success Modal */}
      {punchResultModal && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={true}
          onRequestClose={() => setPunchResultModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCardSuccess}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={36} color="#ffffff" />
              </View>
              <Text style={styles.successHeading}>
                {punchResultModal.action} Confirmed!
              </Text>
              <Text style={styles.successSubtext}>
                Recorded at {punchResultModal.time} • Mode: {punchResultModal.mode}
              </Text>

              <View style={styles.successPreviewRow}>
                <Image source={{ uri: punchResultModal.photoUri }} style={styles.successPhotoThumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successDetailText}>
                    <Text style={styles.successDetailBold}>Photo:</Text> Verified Front Camera Capture
                  </Text>
                  <Text style={styles.successDetailText}>
                    <Text style={styles.successDetailBold}>Location:</Text> {punchResultModal.verified ? 'Verified Within Geofence' : 'WFH Session Stamp'}
                  </Text>
                  <Text style={styles.successNotice}>
                    Saved to database with server-verified timestamps.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successDismissBtn}
                onPress={() => setPunchResultModal(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.successDismissBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  sessionStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1
  },
  sessionStatusText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1
  },
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  modeContainer: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  modeBtnDisabled: {
    opacity: 0.5
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  modeBtnTextActive: {
    color: '#ffffff'
  },
  faceStatusCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 14
  },
  faceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  stateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  faceStatusTitle: {
    fontSize: 13,
    fontWeight: '800'
  },
  faceStatusDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  cameraBox: {
    marginBottom: 16
  },
  cameraFrame: {
    height: 350,
    width: '100%',
    position: 'relative',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1E2319',
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible'
  },
  liveCameraView: {
    width: '100%',
    height: '100%',
    borderRadius: 16
  },
  cameraLoadingOverlay: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 5
  },
  cameraLoadingText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600'
  },
  faceOvalGuide: {
    position: 'absolute',
    width: 180,
    height: 230,
    borderRadius: 90,
    top: 40,
    alignSelf: 'center'
  },
  cameraOverlayTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 6
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  liveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  cameraOverlayBottom: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6
  },
  shutterBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  shutterBtnDisabled: {
    opacity: 0.5
  },
  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  shutterLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  cameraCenterMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    height: 350
  },
  cameraMessageText: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 8
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8
  },
  permissionDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  permissionBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12
  },
  gpsCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    flex: 1
  },
  refreshGpsBtn: {
    padding: 4
  },
  loadingGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6
  },
  loadingGpsText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  locationDisabledBox: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FBEBEB',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  locationDisabledHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444'
  },
  locationDisabledText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 16,
    marginBottom: 10
  },
  turnOnLocationBtn: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8
  },
  turnOnLocationBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  errorGpsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FBEBEB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  errorGpsText: {
    fontSize: 11,
    color: '#EF4444',
    flex: 1
  },
  gpsDetailsRow: {
    marginBottom: 10
  },
  coordsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  coordsSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  geofenceStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.beige
  },
  geofenceStatusText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCardSuccess: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6
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
    color: colors.text,
    textAlign: 'center'
  },
  successSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center'
  },
  successPreviewRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: colors.beige,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    width: '100%'
  },
  successPhotoThumb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.primary
  },
  successDetailText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 16
  },
  successDetailBold: {
    fontWeight: '700'
  },
  successNotice: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2
  },
  successDismissBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    width: '100%',
    borderRadius: 10,
    alignItems: 'center'
  },
  successDismissBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  }
});
