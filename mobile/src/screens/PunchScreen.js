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
import { useResponsiveLayout } from '../utils/responsive';
import SecureSelfie from '../components/SecureSelfie';

function formatDuration(totalMins) {
  if (totalMins == null || isNaN(totalMins) || totalMins < 0) return '0h 00m';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function PunchScreen({ attendanceState = {}, onPunchSuccess, currentOrg, onNavigate }) {
  const { colors, isDark } = useTheme();
  const layout = useResponsiveLayout();
  const styles = getStyles(colors, isDark, layout);

  const isPunchedIn = Boolean(attendanceState.isPunchedIn);
  const isPunchedOut = Boolean(attendanceState.isPunchedOut);

  // Live working duration counter for State B (Shift in progress)
  const [liveElapsedMinutes, setLiveElapsedMinutes] = useState(
    attendanceState?.liveDurationMinutes ?? 0
  );

  useEffect(() => {
    if (!isPunchedIn || isPunchedOut) return;
    const calcMinutes = () => {
      const punchInRaw = attendanceState?.record?.punch_in_time || attendanceState?.rawRecord?.punch_in_time;
      if (punchInRaw) {
        const ms = Date.now() - new Date(punchInRaw).getTime();
        setLiveElapsedMinutes(Math.max(0, Math.floor(ms / 60000)));
      } else if (attendanceState?.liveDurationMinutes != null) {
        setLiveElapsedMinutes(attendanceState.liveDurationMinutes);
      }
    };
    calcMinutes();
    const interval = setInterval(calcMinutes, 30000);
    return () => clearInterval(interval);
  }, [isPunchedIn, isPunchedOut, attendanceState?.record?.punch_in_time, attendanceState?.liveDurationMinutes]);

  // Attendance classification status & badge styling
  const rawStatus = attendanceState?.attendanceStatus || attendanceState?.attendance_status || (attendanceState?.totalMinutes >= 480 ? 'Full Day' : (attendanceState?.totalMinutes >= 240 ? 'Half Day' : 'Absent'));
  const isFullDay = rawStatus === 'Full Day';
  const isHalfDay = rawStatus === 'Half Day';

  const statusBadgeColor = isFullDay
    ? (isDark ? '#34D399' : '#059669')
    : isHalfDay
    ? (isDark ? '#FBBF24' : '#D97706')
    : (isDark ? '#F87171' : '#DC2626');

  const statusBadgeBg = isFullDay
    ? (isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5')
    : isHalfDay
    ? (isDark ? 'rgba(217, 119, 6, 0.2)' : '#FFFBEB')
    : (isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2');

  const statusBadgeBorder = isFullDay
    ? (isDark ? '#059669' : '#A7F3D0')
    : isHalfDay
    ? (isDark ? '#D97706' : '#FDE68A')
    : (isDark ? '#DC2626' : '#FECACA');

  const statusBadgeIcon = isFullDay
    ? 'checkmark-circle'
    : isHalfDay
    ? 'time'
    : 'close-circle';

  // Selected work mode (defaults to existing mode if shift active, else WFO)
  const [selectedMode, setSelectedMode] = useState(
    isPunchedIn ? (attendanceState.mode || 'WFO') : 'WFO'
  );

  // Branch-specific geofencing (Prompt 2 Module D)
  const [assignedBranch, setAssignedBranch] = useState(null);

  useEffect(() => {
    let isMounted = true;
    api.getMyBranch().then(res => {
      if (isMounted && res && res.success && res.branch) {
        setAssignedBranch(res.branch);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  // Derive effective geofence from assigned office branch with fallback to org headquarters
  const officeGeofence = useMemo(() => {
    if (assignedBranch && assignedBranch.latitude != null && assignedBranch.longitude != null) {
      return {
        id: assignedBranch.id,
        name: assignedBranch.name || 'Assigned Office Branch',
        address: assignedBranch.address || null,
        latitude: Number(assignedBranch.latitude),
        longitude: Number(assignedBranch.longitude),
        radiusMeters: Number(assignedBranch.radius_meters) || 150,
        isActive: assignedBranch.is_active !== false
      };
    }
    if (currentOrg && (currentOrg.office_lat != null || currentOrg.latitude != null)) {
      return {
        id: 'org-default',
        name: currentOrg.name || 'Company Office',
        address: currentOrg.address || null,
        latitude: currentOrg.office_lat != null ? Number(currentOrg.office_lat) : Number(currentOrg.latitude),
        longitude: currentOrg.office_lng != null ? Number(currentOrg.office_lng) : Number(currentOrg.longitude),
        radiusMeters: currentOrg.office_radius_meters != null ? Number(currentOrg.office_radius_meters) : (currentOrg.radius_meters != null ? Number(currentOrg.radius_meters) : 100),
        isActive: true
      };
    }
    return null;
  }, [assignedBranch, currentOrg]);

  // Camera state - Strictly front-facing only
  // Camera state - Strictly front-facing only
  const cameraRef = useRef(null);
  const webVideoRef = useRef(null);
  const webStreamRef = useRef(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);

  // Face alignment detection state
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

  // Web video element ref callback to guarantee immediate stream binding on mount/remount
  const attachWebVideo = (videoEl) => {
    webVideoRef.current = videoEl;
    if (videoEl && webStreamRef.current && videoEl.srcObject !== webStreamRef.current) {
      videoEl.srcObject = webStreamRef.current;
      videoEl.play().catch(pErr => console.warn('[Web Camera] Autoplay wait:', pErr));
    }
  };

  // Web camera initialization with getUserMedia
  const startWebCamera = async () => {
    try {
      setCameraError(null);
      setIsCameraReady(false);
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Front camera access is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      webStreamRef.current = stream;
      if (webVideoRef.current) {
        webVideoRef.current.srcObject = stream;
        try {
          await webVideoRef.current.play();
        } catch (pErr) {
          console.warn('[Web Camera] Autoplay wait:', pErr);
        }
      }
      if (webVideoRef.current && webVideoRef.current.readyState >= 2) {
        setIsCameraReady(true);
      }
    } catch (err) {
      console.warn('[Web Camera] Failed to open front camera:', err.message);
      setCameraError(err.message || 'Unable to open front camera in browser.');
      setIsCameraReady(false);
    }
  };

  const stopWebCamera = () => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach(t => t.stop());
      webStreamRef.current = null;
    }
    if (webVideoRef.current) {
      webVideoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  // Browser camera lifecycle
  useEffect(() => {
    if (Platform.OS === 'web') {
      startWebCamera();
      return () => {
        stopWebCamera();
      };
    }
  }, []);

  // Native camera permission auto-request on mount
  useEffect(() => {
    if (Platform.OS !== 'web' && cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
  }, [cameraPermission]);

  // Request location on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // Listen to AppState (when user returns from system Settings, refresh GPS fix & camera)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchCurrentLocation();
        if (Platform.OS === 'web' && !webStreamRef.current && !capturedPhotoUri) {
          startWebCamera();
        }
      }
    });
    return () => subscription.remove();
  }, [capturedPhotoUri]);

  // Face alignment state driven by camera readiness and review state
  useEffect(() => {
    let timer;
    if (capturedPhotoUri) {
      setFaceAlignmentState('ALIGNED');
      setFaceGuidanceText('Photo captured. Review your selfie below.');
    } else if ((Platform.OS === 'web' || cameraPermission?.granted) && isCameraReady) {
      setFaceAlignmentState('ALIGNING');
      setFaceGuidanceText('Aligning face within guide...');

      timer = setTimeout(() => {
        setFaceAlignmentState('ALIGNED');
        setFaceGuidanceText('Face aligned. Tap circle to take photo.');
      }, 600);
    } else if ((Platform.OS === 'web' || cameraPermission?.granted) && !isCameraReady) {
      setFaceAlignmentState('NO_FACE');
      setFaceGuidanceText('Starting live front camera...');
    } else {
      setFaceAlignmentState('NO_FACE');
      setFaceGuidanceText('Camera access required.');
    }
    return () => clearTimeout(timer);
  }, [cameraPermission?.granted, isCameraReady, capturedPhotoUri]);

  /**
   * Acquire real device GPS position with distinction between permission denied and GPS disabled
   */
  const fetchCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);
    setLocationDisabled(false);

    try {
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setLocationDisabled(true);
        setLocationError('Device Location Services are turned off. Please turn on Location in system settings.');
        setLocationLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please grant location access in device settings.');
        setLocationLoading(false);
        return;
      }

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
   * Open system Location / App Settings
   */
  const handleOpenLocationSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      }
    } catch (err) {
      Alert.alert('Settings', 'Could not open settings automatically. Please enable Location in your device Settings.');
    }
  };

  /**
   * Handle camera permission request with fallback to system settings if blocked
   */
  const handleRequestCamera = async () => {
    if (cameraPermission && !cameraPermission.canAskAgain && Platform.OS !== 'web') {
      try {
        if (Platform.OS === 'android') {
          await Linking.openSettings();
        } else if (Platform.OS === 'ios') {
          await Linking.openURL('app-settings:');
        }
      } catch (err) {
        Alert.alert('Settings', 'Please enable Camera access in your device Settings.');
      }
      return;
    }
    await requestCameraPermission();
  };

  // Evaluate geofence against authenticated organization
  const geofenceResult = evaluateGeofence(currentCoords, officeGeofence, selectedMode);

  /**
   * Step 1: Capture Real Front-Camera Selfie
   * Snaps the current frame and switches to the Review State
   */
  const handleCapturePhoto = async () => {
    if (isTakingPhoto || isSubmittingPunch) return;
    if (!isCameraReady) {
      Alert.alert('Camera Not Ready', 'Please wait for the live front camera preview to become ready.');
      return;
    }

    try {
      setIsTakingPhoto(true);

      let photoUri = null;
      if (Platform.OS === 'web') {
        const video = webVideoRef.current;
        if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
          throw new Error('Front camera stream is warming up. Please wait for the live preview and try again.');
        }
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        // Mirror horizontally to match front-camera preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        photoUri = canvas.toDataURL('image/jpeg', 0.85);
      } else {
        if (!cameraRef.current) {
          throw new Error('Front camera reference is not available.');
        }
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false
        });
        if (!photo || !photo.uri) {
          throw new Error('Camera snap did not return a valid photo image.');
        }
        photoUri = photo.uri;
      }

      if (!photoUri) {
        throw new Error('Could not capture selfie photo. Please retry.');
      }

      setCapturedPhotoUri(photoUri);
    } catch (err) {
      console.error('[Capture Photo] Error:', err);
      Alert.alert('Capture Failed', err.message || 'Failed to capture photo. Please retry.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  /**
   * Step 2: Retake Photo
   * Discards captured image and resumes live camera stream
   */
  const handleRetakePhoto = () => {
    setIsCameraReady(false);
    setCapturedPhotoUri(null);
    if (Platform.OS === 'web') {
      if (webVideoRef.current && webStreamRef.current) {
        webVideoRef.current.srcObject = webStreamRef.current;
        webVideoRef.current.play().catch(() => {});
      } else {
        startWebCamera();
      }
    }
  };

  /**
   * Step 3: Confirm & Submit Attendance
   * Validates photo, GPS, geofence, and submits to backend + Supabase
   */
  const handleConfirmAndSubmitPunch = async () => {
    if (isSubmittingPunch) return;
    if (!capturedPhotoUri) {
      Alert.alert('Selfie Required', 'Please capture a selfie photo before confirming attendance.');
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
      setIsSubmittingPunch(true);

      // 1. Obtain fresh GPS fix at moment of punch confirmation
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
        setIsSubmittingPunch(false);
        Alert.alert(
          'GPS Coordinates Required',
          locationError || 'Unable to acquire fresh GPS reading. Please check location permissions and retry.'
        );
        return;
      }

      // 2. Geofence enforcement for WFO against assigned office branch
      if (selectedMode === 'WFO') {
        if (!officeGeofence || officeGeofence.latitude == null || officeGeofence.longitude == null) {
          setIsSubmittingPunch(false);
          Alert.alert(
            'Office Location Not Configured',
            'Office GPS coordinates are not configured for your assigned branch. WFO attendance cannot be verified. Please contact your company administrator or select WFH if authorized.'
          );
          return;
        }

        if (officeGeofence.isActive === false) {
          setIsSubmittingPunch(false);
          Alert.alert(
            'Assigned Branch Inactive',
            `Your assigned office branch (${officeGeofence.name}) is currently inactive. Contact your company administrator.`
          );
          return;
        }

        const freshGeofence = evaluateGeofence(freshCoords, officeGeofence, selectedMode);
        if (!freshGeofence.isInside) {
          setIsSubmittingPunch(false);
          Alert.alert(
            'Outside Office Geofence',
            `You are currently outside your assigned office geofence for ${officeGeofence.name} (${freshGeofence.distanceMeters != null ? `${freshGeofence.distanceMeters}m away` : 'location unverified'}, allowed radius: ${officeGeofence.radiusMeters}m). Please move closer or select authorized WFH mode.`
          );
          return;
        }
      }

      const freshGeofence = evaluateGeofence(freshCoords, officeGeofence, selectedMode);
      const punchAction = isPunchedIn ? 'Punch Out' : 'Punch In';
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const punchRecord = {
        type: isPunchedIn ? 'OUT' : 'IN',
        action: punchAction,
        mode: selectedMode,
        photoUri: capturedPhotoUri,
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

      // 3. Submit to parent handler & backend API (uploads to Supabase Storage and inserts in DB)
      if (onPunchSuccess) {
        await onPunchSuccess(punchRecord);
      }

      setIsSubmittingPunch(false);

      // Display server-confirmed success modal
      setPunchResultModal({
        action: punchAction,
        time: timeStr,
        mode: selectedMode,
        photoUri: capturedPhotoUri,
        distance: freshGeofence.distanceMeters,
        verified: freshGeofence.isInside
      });
      setCapturedPhotoUri(null);
    } catch (err) {
      console.error('[Punch Submit] Error:', err);
      setIsSubmittingPunch(false);
      Alert.alert(
        'Attendance Submission Failed',
        err.message || 'Unable to record attendance. Please retry.',
        [{ text: 'OK' }]
      );
    }
  };

  // Camera Live State: Permission granted (or web stream active), camera is mounted and ready, and no mount error
  const isCameraLive = Platform.OS === 'web'
    ? Boolean(isCameraReady && !cameraError)
    : Boolean(cameraPermission?.granted && isCameraReady && !cameraError);

  // Status values: honest, transparent and reactive to capture/review state
  const statusTitle = capturedPhotoUri
    ? 'Selfie Photo Captured'
    : (Platform.OS !== 'web' && !cameraPermission?.granted)
    ? 'Camera Access Required'
    : cameraError
    ? 'Camera Initialization Failed'
    : !isCameraReady
    ? 'Starting Front Camera...'
    : 'Front Camera Ready';

  const statusDesc = capturedPhotoUri
    ? 'Review your selfie photo below before confirming your attendance.'
    : (Platform.OS !== 'web' && !cameraPermission?.granted)
    ? 'Front-camera permission is required for shift attendance.'
    : cameraError
    ? cameraError
    : !isCameraReady
    ? 'Warming up front camera sensor...'
    : 'Position your face within the oval guide and tap the shutter.';

  const statusColor = capturedPhotoUri
    ? colors.primary
    : (Platform.OS !== 'web' && !cameraPermission?.granted) || cameraError
    ? '#EF4444'
    : !isCameraReady
    ? colors.textSecondary
    : colors.primary;

  const ovalBorderColor = isCameraLive ? colors.primary : 'rgba(255, 255, 255, 0.45)';
  const ovalBorderStyle = isCameraLive ? 'solid' : 'dashed';

  // STATE C: Shift Completed (Punch Out already recorded today)
  if (isPunchedOut) {
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
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
              borderColor: '#10B981'
            }
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={[styles.sessionStatusText, { color: isDark ? '#34D399' : '#065F46' }]}>
            Shift Completed Today • Great work!
          </Text>
        </View>

        {/* Screen Title */}
        <View style={styles.header}>
          <Text style={styles.title}>Shift Completed</Text>
          <Text style={styles.subtitle}>
            Your shift attendance has been recorded with verified photos, GPS, and duration.
          </Text>
        </View>

        {/* Comprehensive Summary Card */}
        <View style={styles.summaryCard}>
          {/* Status Badge & Mode Header */}
          <View style={styles.summaryStatusHeader}>
            <View style={[styles.attendanceStatusPill, { backgroundColor: statusBadgeBg, borderColor: statusBadgeBorder }]}>
              <Ionicons name={statusBadgeIcon} size={14} color={statusBadgeColor} />
              <Text style={[styles.attendanceStatusPillText, { color: statusBadgeColor }]}>
                {rawStatus}
              </Text>
            </View>
            <View style={[styles.modeBadge, (attendanceState.mode || 'WFO') === 'WFO' ? styles.modeWfo : styles.modeWfh]}>
              <Ionicons
                name={(attendanceState.mode || 'WFO') === 'WFO' ? 'business' : 'home'}
                size={12}
                color={(attendanceState.mode || 'WFO') === 'WFO' ? colors.darkOlive : colors.primary}
              />
              <Text style={[styles.modeText, (attendanceState.mode || 'WFO') === 'WFO' ? styles.modeTextWfo : styles.modeTextWfh]}>
                {attendanceState.mode || 'WFO'}
              </Text>
            </View>
          </View>

          {/* 3-Column Timings Grid */}
          <View style={styles.summaryMetricsGrid}>
            <View style={styles.summaryMetricCol}>
              <Text style={styles.summaryMetricLabel}>PUNCH IN</Text>
              <Text style={styles.summaryMetricValue}>
                {attendanceState.punchInTime || '—'}
              </Text>
              <Text style={styles.summaryMetricSub}>Shift Start</Text>
            </View>

            <View style={styles.summaryMetricDivider} />

            <View style={styles.summaryMetricCol}>
              <Text style={styles.summaryMetricLabel}>PUNCH OUT</Text>
              <Text style={styles.summaryMetricValue}>
                {attendanceState.punchOutTime || attendanceState.lastPunchOutTime || '—'}
              </Text>
              <Text style={styles.summaryMetricSub}>Shift End</Text>
            </View>

            <View style={styles.summaryMetricDivider} />

            <View style={styles.summaryMetricCol}>
              <Text style={styles.summaryMetricLabel}>TOTAL DURATION</Text>
              <Text style={[styles.summaryMetricValue, { color: statusBadgeColor }]}>
                {formatDuration(attendanceState.totalMinutes)}
              </Text>
              <Text style={styles.summaryMetricSub}>{rawStatus}</Text>
            </View>
          </View>

          {/* Verified Selfie Proof Row */}
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Verified Selfie Proof</Text>
            <View style={styles.summarySelfieRow}>
              {/* Punch In Selfie */}
              <View style={styles.summarySelfieCard}>
                <SecureSelfie
                  photoPath={attendanceState.punchInPhotoUri}
                  style={styles.summarySelfieImg}
                  placeholderIcon="camera"
                  placeholderText="Punch In Selfie"
                />
                <View style={styles.summarySelfieBadge}>
                  <Ionicons name="log-in-outline" size={12} color={colors.primary} />
                  <Text style={styles.summarySelfieBadgeText}>Punch In</Text>
                </View>
                <Text style={styles.summarySelfieTime}>{attendanceState.punchInTime || 'Logged'}</Text>
              </View>

              {/* Punch Out Selfie */}
              <View style={styles.summarySelfieCard}>
                <SecureSelfie
                  photoPath={attendanceState.punchOutPhotoUri}
                  style={styles.summarySelfieImg}
                  placeholderIcon="camera"
                  placeholderText="Punch Out Selfie"
                />
                <View style={[styles.summarySelfieBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                  <Ionicons name="log-out-outline" size={12} color="#EF4444" />
                  <Text style={[styles.summarySelfieBadgeText, { color: '#EF4444' }]}>Punch Out</Text>
                </View>
                <Text style={styles.summarySelfieTime}>{attendanceState.punchOutTime || attendanceState.lastPunchOutTime || 'Logged'}</Text>
              </View>
            </View>
          </View>

          {/* GPS Verification Audit Section */}
          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>GPS & Geofence Verification</Text>
            <View style={styles.summaryGpsBox}>
              <View style={styles.summaryGpsRow}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <Text style={styles.summaryGpsText}>
                  Punch In: {(attendanceState.mode || 'WFO') === 'WFO' ? 'Office Geofence Verified' : 'WFH Location Logged'}
                  {attendanceState.punchInCoords ? ` (${attendanceState.punchInCoords.latitude.toFixed(4)}°, ${attendanceState.punchInCoords.longitude.toFixed(4)}°)` : ''}
                </Text>
              </View>
              <View style={[styles.summaryGpsRow, { marginTop: 6 }]}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <Text style={styles.summaryGpsText}>
                  Punch Out: {(attendanceState.mode || 'WFO') === 'WFO' ? 'Office Geofence Verified' : 'WFH Location Logged'}
                  {attendanceState.punchOutCoords ? ` (${attendanceState.punchOutCoords.latitude.toFixed(4)}°, ${attendanceState.punchOutCoords.longitude.toFixed(4)}°)` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* Locked notice */}
          <View style={styles.lockedNoticeBox}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.lockedNoticeText}>
              Attendance is locked for today. You will be able to punch in again on your next working day.
            </Text>
          </View>

          {/* Navigate to History Button */}
          {onNavigate && (
            <TouchableOpacity
              style={styles.viewHistoryBtn}
              onPress={() => onNavigate('history')}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={18} color="#ffffff" />
              <Text style={styles.viewHistoryBtnText}>View in Attendance History</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

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
            : 'Not Punched In Today • Ready to Start Shift'}
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

      {/* State B: Live Working Duration Banner */}
      {isPunchedIn && (
        <View style={styles.liveDurationCard}>
          <View style={styles.liveDurationPulse}>
            <View style={styles.liveDurationPulseDot} />
            <Text style={styles.liveDurationLabel}>SHIFT IN PROGRESS</Text>
          </View>
          <Text style={styles.liveDurationTime}>
            {formatDuration(liveElapsedMinutes)}
          </Text>
          <Text style={styles.liveDurationSub}>
            Punched in at {attendanceState.punchInTime || 'earlier'} • {selectedMode} Mode
          </Text>
        </View>
      )}

      {/* Mode Selector (WFO vs WFH) */}
      <View style={styles.modeContainer}>
        <Text style={styles.sectionLabel}>
          Work Mode: {isPunchedIn ? '(Locked to active shift)' : '(Select Mode)'}
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
          {capturedPhotoUri ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: capturedPhotoUri }}
                style={styles.capturedPhotoPreview}
                resizeMode="cover"
              />
              <View style={styles.reviewBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                <Text style={styles.reviewBadgeText}>SELFIE CAPTURED</Text>
              </View>
            </View>
          ) : Platform.OS !== 'web' && !cameraPermission ? (
            <View style={styles.cameraCenterMessage}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.cameraMessageText}>Checking camera permissions...</Text>
            </View>
          ) : Platform.OS !== 'web' && !cameraPermission.granted ? (
            <View style={styles.cameraCenterMessage}>
              <Ionicons name="camera-outline" size={42} color="#EF4444" />
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>
                A live front-camera selfie is required to verify identity for punch in and punch out.
              </Text>
              <TouchableOpacity
                style={styles.permissionBtn}
                onPress={handleRequestCamera}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionBtnText}>
                  {cameraPermission && !cameraPermission.canAskAgain
                    ? 'Open Settings to Grant Permission'
                    : 'Grant Camera Permission'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              {/* Web Native Video / Native Expo CameraView */}
              {Platform.OS === 'web' ? (
                <View style={styles.webVideoContainer}>
                  <video
                    ref={attachWebVideo}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => {
                      setIsCameraReady(true);
                      setCameraError(null);
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)'
                    }}
                  />
                </View>
              ) : (
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
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
              )}

              {/* Initializing indicator overlay (non-blocking, transparent pill so preview can appear) */}
              {!isCameraReady && !cameraError && (
                <View style={styles.cameraLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.cameraLoadingText}>Starting front camera...</Text>
                </View>
              )}

              {/* Camera Mount Error Overlay with Retry */}
              {cameraError && (
                <View style={[styles.cameraCenterMessage, StyleSheet.absoluteFillObject, { backgroundColor: colors.cameraBackdrop || '#0B1414', zIndex: 10, padding: 20 }]}>
                  <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
                  <Text style={styles.permissionTitle}>Camera Error</Text>
                  <Text style={[styles.permissionDesc, { marginVertical: 8 }]}>{cameraError}</Text>
                  <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={() => {
                      setCameraError(null);
                      setIsCameraReady(false);
                      if (Platform.OS === 'web') startWebCamera();
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
              <View style={styles.cameraOverlayTop} pointerEvents="box-none">
                <View style={styles.liveIndicator}>
                  <View style={[styles.liveDot, { backgroundColor: isCameraLive ? '#10b981' : '#f59e0b' }]} />
                  <Text style={styles.liveText}>FRONT CAMERA</Text>
                </View>
              </View>

              {/* Shutter Capture Button - Tapping snaps photo into review state */}
              <View style={styles.cameraOverlayBottom} pointerEvents="box-none">
                <TouchableOpacity
                  style={[
                    styles.shutterBtn,
                    (!isCameraLive || isTakingPhoto) && styles.shutterBtnDisabled
                  ]}
                  onPress={handleCapturePhoto}
                  disabled={!isCameraLive || isTakingPhoto}
                  activeOpacity={0.8}
                >
                  {isTakingPhoto ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={[styles.shutterInner, { backgroundColor: isCameraLive ? colors.primary : '#94a3b8' }]} />
                  )}
                </TouchableOpacity>
                <Text style={styles.shutterLabel}>
                  {isTakingPhoto
                    ? 'Capturing Selfie...'
                    : (isCameraLive ? 'Tap circle to capture selfie' : 'Starting camera preview...')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Review Action Controls (visible once selfie photo is captured) */}
        {capturedPhotoUri && (
          <View style={styles.reviewControlsRow}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={handleRetakePhoto}
              disabled={isSubmittingPunch}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-reverse-outline" size={18} color={colors.text} />
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmPunchBtn,
                { backgroundColor: isPunchedIn ? '#EF4444' : colors.primary },
                isSubmittingPunch && styles.confirmPunchBtnDisabled
              ]}
              onPress={handleConfirmAndSubmitPunch}
              disabled={isSubmittingPunch}
              activeOpacity={0.8}
            >
              {isSubmittingPunch ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name={isPunchedIn ? 'log-out-outline' : 'log-in-outline'}
                    size={18}
                    color="#ffffff"
                  />
                  <Text style={styles.confirmPunchBtnText}>
                    {isPunchedIn ? 'Confirm & Punch Out' : 'Confirm & Punch In'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
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

const getStyles = (colors, isDark, layout = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    paddingHorizontal: layout?.screenPadding || 16,
    paddingTop: 16,
    paddingBottom: 110,
    maxWidth: layout?.isTablet ? 720 : '100%',
    alignSelf: 'center',
    width: '100%'
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
    height: Math.min(350, Math.max(260, (layout?.height || 700) * 0.4)),
    width: '100%',
    position: 'relative',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#000000',
    overflow: 'hidden'
  },
  cameraContainer: {
    flex: 1,
    width: '100%',
    position: 'relative'
  },
  camera: {
    flex: 1,
    width: '100%'
  },
  webVideoContainer: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  previewContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  capturedPhotoPreview: {
    width: '100%',
    height: '100%'
  },
  reviewBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 5
  },
  reviewBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  reviewControlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  retakeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  confirmPunchBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12
  },
  confirmPunchBtnDisabled: {
    opacity: 0.6
  },
  confirmPunchBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff'
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
    width: layout?.isVerySmallMobile ? 144 : 176,
    height: layout?.isVerySmallMobile ? 186 : 220,
    borderRadius: layout?.isVerySmallMobile ? 72 : 88,
    top: layout?.isVerySmallMobile ? 22 : 36,
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
  },
  // State C: Summary Card Styles
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20
  },
  summaryStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  attendanceStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1
  },
  attendanceStatusPillText: {
    fontSize: 12,
    fontWeight: '800'
  },
  summaryMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.beige,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  summaryMetricCol: {
    flex: 1,
    alignItems: 'center'
  },
  summaryMetricDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border
  },
  summaryMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4
  },
  summaryMetricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  summaryMetricSub: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2
  },
  summarySection: {
    marginBottom: 16
  },
  summarySectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  summarySelfieRow: {
    flexDirection: 'row',
    gap: 12
  },
  summarySelfieCard: {
    flex: 1,
    backgroundColor: colors.beige,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  summarySelfieImg: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: colors.lightOlive
  },
  summarySelfieBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8
  },
  summarySelfieBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary
  },
  summarySelfieTime: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4
  },
  summaryGpsBox: {
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  summaryGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  summaryGpsText: {
    fontSize: 11,
    color: colors.text,
    flex: 1
  },
  lockedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(100, 116, 139, 0.15)' : '#F1F5F9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border
  },
  lockedNoticeText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3
  },
  viewHistoryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  // State B: Live Working Duration Card
  liveDurationCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    alignItems: 'center'
  },
  liveDurationPulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  liveDurationPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981'
  },
  liveDurationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.8
  },
  liveDurationTime: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5
  },
  liveDurationSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  modeWfo: {
    backgroundColor: isDark ? 'rgba(13, 148, 136, 0.15)' : '#E6F4F1'
  },
  modeWfh: {
    backgroundColor: isDark ? 'rgba(20, 184, 166, 0.15)' : '#E0F2FE'
  },
  modeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  modeTextWfo: {
    color: colors.primary
  },
  modeTextWfh: {
    color: '#0284C7'
  }
});
