import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminGeofenceScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [officeLat, setOfficeLat] = useState('12.9716');
  const [officeLng, setOfficeLng] = useState('77.5946');
  const [radiusMeters, setRadiusMeters] = useState('150');
  const [wfhAllowed, setWfhAllowed] = useState(true);
  const [address, setAddress] = useState('');

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const res = await api.getOrgSettings();
      if (res.success && res.data) {
        const s = res.data;
        if (s.office_lat) setOfficeLat(String(s.office_lat));
        if (s.office_lng) setOfficeLng(String(s.office_lng));
        if (s.office_radius_meters) setRadiusMeters(String(s.office_radius_meters));
        if (s.wfh_allowed !== undefined) setWfhAllowed(Boolean(s.wfh_allowed));
        if (s.address) setAddress(s.address);
      }
    } catch (e) {
      console.warn('[AdminGeofence] Load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await api.updateOrgSettings({
        office_lat: parseFloat(officeLat) || null,
        office_lng: parseFloat(officeLng) || null,
        office_radius_meters: parseInt(radiusMeters, 10) || 100,
        wfh_allowed: wfhAllowed,
        address
      });

      if (res.success) {
        Alert.alert('Saved', 'Office geofence rules updated successfully.');
      } else {
        Alert.alert('Error', res.error || 'Failed to update geofence.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Office Geofencing</Text>
          <Text style={styles.headerSubtitle}>Punch In Validation Boundary</Text>
        </View>
        <TouchableOpacity style={styles.saveHeaderBtn} onPress={handleSave} disabled={isSaving}>
          <Text style={styles.saveHeaderBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading geofence settings...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Status Card */}
          <View style={styles.statusCard}>
            <View style={styles.statusIconWrap}>
              <Ionicons name="location" size={28} color="#ffffff" />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Geofence Active</Text>
              <Text style={styles.statusSub}>
                Employees within {radiusMeters}m of office are automatically verified.
              </Text>
            </View>
          </View>

          {/* Office Address */}
          <Text style={styles.sectionLabel}>OFFICE ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. Bangalore Technology Park, Whitefield, Bengaluru"
            placeholderTextColor={colors.textSecondary}
          />

          {/* Coordinates Grid */}
          <Text style={styles.sectionLabel}>OFFICE COORDINATES (WGS84)</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.subLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={officeLat}
                onChangeText={setOfficeLat}
                placeholder="12.9716"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.col}>
              <Text style={styles.subLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={officeLng}
                onChangeText={setOfficeLng}
                placeholder="77.5946"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Radius */}
          <Text style={styles.sectionLabel}>PERMITTED RADIUS (METERS)</Text>
          <TextInput
            style={styles.input}
            value={radiusMeters}
            onChangeText={setRadiusMeters}
            placeholder="150"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>
            Recommended: 100–250m to allow for standard mobile GPS drift.
          </Text>

          {/* WFH Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Allow Work From Home (WFH)</Text>
              <Text style={styles.toggleSub}>
                When enabled, employees can choose WFH without geofence enforcement.
              </Text>
            </View>
            <Switch
              value={wfhAllowed}
              onValueChange={setWfhAllowed}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Geofence Rules</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backBtn: {
      padding: 6,
      marginRight: 8
    },
    headerTitleWrap: {
      flex: 1
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary
    },
    saveHeaderBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8
    },
    saveHeaderBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700'
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30
    },
    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: colors.textSecondary
    },
    content: {
      padding: 16,
      paddingBottom: 40
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20
    },
    statusIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14
    },
    statusInfo: {
      flex: 1
    },
    statusTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    statusSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 14
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
      fontSize: 13,
      color: colors.textPrimary
    },
    row: {
      flexDirection: 'row',
      gap: 10
    },
    col: {
      flex: 1
    },
    subLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4
    },
    helperText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 10
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 14
    },
    toggleInfo: {
      flex: 1,
      marginRight: 10
    },
    toggleTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary
    },
    toggleSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 30
    },
    saveBtnDisabled: {
      opacity: 0.6
    },
    saveBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    }
  });
