import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  StatusBar,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

/**
 * LocationPickerModal — Zero-cost location picker using expo-location.
 * Shows current coordinates and address, allows manual adjustment.
 * No paid map API required.
 */
export default function LocationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLatitude,
  initialLongitude,
  colors,
  isDark
}) {
  const styles = getStyles(colors, isDark);

  const [latitude, setLatitude] = useState(initialLatitude || null);
  const [longitude, setLongitude] = useState(initialLongitude || null);
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied. You can enter coordinates manually or enable location in device Settings.');
        setShowManual(true);
        setIsLoading(false);
        return;
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setErrorMsg('Location services are disabled. Please enable GPS in your device settings, or enter coordinates manually.');
        setShowManual(true);
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setLatitude(lat);
      setLongitude(lng);
      setManualLat(lat.toFixed(6));
      setManualLng(lng.toFixed(6));

      // Try reverse geocoding (free, built into expo-location)
      try {
        const [geocoded] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocoded) {
          const parts = [
            geocoded.name,
            geocoded.street,
            geocoded.district,
            geocoded.city,
            geocoded.region,
            geocoded.postalCode,
            geocoded.country
          ].filter(Boolean);
          setAddress(parts.join(', '));
        }
      } catch (geoErr) {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (err) {
      setErrorMsg('Could not get current location. You can enter coordinates manually.');
      setShowManual(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualUpdate = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      Alert.alert('Invalid Latitude', 'Latitude must be between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      Alert.alert('Invalid Longitude', 'Longitude must be between -180 and 180.');
      return;
    }

    setLatitude(lat);
    setLongitude(lng);

    // Try reverse geocoding
    try {
      const [geocoded] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocoded) {
        const parts = [
          geocoded.name,
          geocoded.street,
          geocoded.district,
          geocoded.city,
          geocoded.region,
          geocoded.postalCode,
          geocoded.country
        ].filter(Boolean);
        setAddress(parts.join(', '));
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (e) {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const handleConfirm = () => {
    if (latitude == null || longitude == null) {
      Alert.alert('No Location', 'Please select a location before confirming.');
      return;
    }
    onConfirm({
      latitude,
      longitude,
      address: address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent={true}
        />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Getting your location...</Text>
            <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Error Message */}
            {Boolean(errorMsg) && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={18} color="#C28424" style={{ marginRight: 8 }} />
                <Text style={styles.errorBoxText}>{errorMsg}</Text>
              </View>
            )}

            {/* Current Location Display */}
            {latitude != null && longitude != null && (
              <View style={styles.locationCard}>
                <View style={styles.locationIconRow}>
                  <View style={styles.locationPinCircle}>
                    <Ionicons name="location" size={22} color="#ffffff" />
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationLabel}>Selected Location</Text>
                    <Text style={styles.locationAddress} numberOfLines={3}>{address || 'Address not available'}</Text>
                    <Text style={styles.locationCoords}>
                      {latitude.toFixed(6)}, {longitude.toFixed(6)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Re-detect button */}
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={getCurrentLocation}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.refreshBtnText}>Use Current Location</Text>
            </TouchableOpacity>

            {/* Manual Coordinate Entry */}
            <TouchableOpacity
              style={styles.manualToggle}
              onPress={() => setShowManual(!showManual)}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.manualToggleText}>
                {showManual ? 'Hide manual entry' : 'Enter coordinates manually'}
              </Text>
              <Ionicons name={showManual ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {showManual && (
              <View style={styles.manualSection}>
                <View style={styles.coordRow}>
                  <View style={styles.coordInput}>
                    <Text style={styles.coordLabel}>Latitude</Text>
                    <TextInput
                      style={styles.coordField}
                      value={manualLat}
                      onChangeText={setManualLat}
                      placeholder="e.g. 26.8467"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.coordInput}>
                    <Text style={styles.coordLabel}>Longitude</Text>
                    <TextInput
                      style={styles.coordField}
                      value={manualLng}
                      onChangeText={setManualLng}
                      placeholder="e.g. 80.9462"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.updateCoordsBtn}
                  onPress={handleManualUpdate}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.updateCoordsBtnText}>Update Location</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Address override */}
            <View style={styles.addressEditGroup}>
              <Text style={styles.addressEditLabel}>Address</Text>
              <TextInput
                style={styles.addressInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter or correct address"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
              />
            </View>
          </View>
        )}

        {/* Confirm Button */}
        {!isLoading && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.confirmBtn, (latitude == null || longitude == null) && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={latitude == null || longitude == null}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 50,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? '#263321' : '#eef4ea',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16
  },
  loadingSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    backgroundColor: isDark ? '#3b3122' : '#FAF4E8',
    borderWidth: 1,
    borderColor: isDark ? '#5a4822' : '#e8d5a8',
    marginBottom: 16
  },
  errorBoxText: {
    fontSize: 13,
    color: isDark ? '#E5A84B' : '#9E6A1B',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18
  },
  locationCard: {
    backgroundColor: isDark ? '#202c1b' : '#edf4e8',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: isDark ? '#33452b' : '#cce0c2',
    marginBottom: 16
  },
  locationIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  locationPinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  locationInfo: {
    flex: 1
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 19,
    marginBottom: 2
  },
  locationCoords: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.08)' : 'rgba(104, 119, 71, 0.05)',
    marginBottom: 12
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 8
  },
  manualToggleText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    marginRight: 4
  },
  manualSection: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  coordRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  coordInput: {
    flex: 1
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4
  },
  coordField: {
    backgroundColor: isDark ? '#1e251a' : '#FAFAF6',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  updateCoordsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(163, 184, 121, 0.12)' : 'rgba(104, 119, 71, 0.08)',
    borderWidth: 1,
    borderColor: isDark ? '#3d4a34' : '#ccd9c4'
  },
  updateCoordsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  addressEditGroup: {
    marginBottom: 16
  },
  addressEditLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6
  },
  addressInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 56,
    textAlignVertical: 'top'
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  confirmBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5
  },
  confirmBtnDisabled: {
    opacity: 0.5
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff'
  }
});
