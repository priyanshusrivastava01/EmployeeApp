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
  Alert,
  Modal,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminGeofenceScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWfh, setIsSavingWfh] = useState(false);
  const [wfhAllowed, setWfhAllowed] = useState(true);
  const [branches, setBranches] = useState([]);

  // Modal State for Add / Edit Branch
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Form Fields
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchLat, setBranchLat] = useState('');
  const [branchLng, setBranchLng] = useState('');
  const [branchRadius, setBranchRadius] = useState('150');
  const [isHq, setIsHq] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [orgRes, branchRes] = await Promise.all([
        api.getOrgSettings(),
        api.getBranches(false)
      ]);

      if (orgRes && orgRes.success && orgRes.data) {
        if (orgRes.data.wfh_allowed !== undefined) {
          setWfhAllowed(Boolean(orgRes.data.wfh_allowed));
        }
      }

      if (branchRes && branchRes.success && Array.isArray(branchRes.data)) {
        setBranches(branchRes.data);
      }
    } catch (e) {
      console.warn('[AdminGeofence] Load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleWfh = async (val) => {
    try {
      setIsSavingWfh(true);
      setWfhAllowed(val);
      const res = await api.updateOrgSettings({ wfh_allowed: val });
      if (!res.success) {
        setWfhAllowed(!val);
        Alert.alert('Error', res.error || 'Failed to update WFH setting.');
      }
    } catch (err) {
      setWfhAllowed(!val);
      Alert.alert('Error', err.message);
    } finally {
      setIsSavingWfh(false);
    }
  };

  const openAddModal = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchAddress('');
    setBranchLat('');
    setBranchLng('');
    setBranchRadius('150');
    setIsHq(branches.length === 0);
    setIsActive(true);
    setFormError(null);
    setModalVisible(true);
  };

  const openEditModal = (b) => {
    setEditingBranch(b);
    setBranchName(b.name || '');
    setBranchAddress(b.address || '');
    setBranchLat(b.latitude != null ? String(b.latitude) : '');
    setBranchLng(b.longitude != null ? String(b.longitude) : '');
    setBranchRadius(b.radius_meters ? String(b.radius_meters) : '150');
    setIsHq(Boolean(b.is_headquarters));
    setIsActive(b.is_active !== false);
    setFormError(null);
    setModalVisible(true);
  };

  const handleCaptureCurrentLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to capture current coordinates.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      if (loc && loc.coords) {
        setBranchLat(loc.coords.latitude.toFixed(6));
        setBranchLng(loc.coords.longitude.toFixed(6));
        Alert.alert('Coordinates Captured', `Lat: ${loc.coords.latitude.toFixed(6)}, Lng: ${loc.coords.longitude.toFixed(6)}`);
      }
    } catch (err) {
      Alert.alert('GPS Error', err.message || 'Could not obtain current GPS position.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleSaveBranch = async () => {
    setFormError(null);
    if (!branchName.trim()) {
      setFormError('Branch name is required.');
      return;
    }
    const latNum = parseFloat(branchLat);
    const lngNum = parseFloat(branchLng);
    const radNum = parseInt(branchRadius, 10);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setFormError('Longitude must be a valid number between -180 and 180.');
      return;
    }
    if (isNaN(radNum) || radNum <= 0 || radNum > 5000) {
      setFormError('Geofence radius must be between 1 and 5000 meters.');
      return;
    }

    try {
      setIsSavingBranch(true);
      const payload = {
        name: branchName.trim(),
        address: branchAddress.trim() || null,
        latitude: latNum,
        longitude: lngNum,
        radius_meters: radNum,
        is_headquarters: isHq,
        is_active: isActive
      };

      let res;
      if (editingBranch) {
        res = await api.updateBranch(editingBranch.id, payload);
      } else {
        res = await api.createBranch(payload);
      }

      if (res.success) {
        setModalVisible(false);
        Alert.alert(
          editingBranch ? 'Branch Updated' : 'Branch Created',
          `Office branch "${branchName.trim()}" has been saved.`
        );
        loadData();
      } else {
        setFormError(res.error || 'Failed to save branch.');
      }
    } catch (err) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleToggleBranchActive = (branch) => {
    const nextState = !branch.is_active;
    const actionWord = nextState ? 'activate' : 'deactivate';

    Alert.alert(
      `Confirm ${nextState ? 'Activation' : 'Deactivation'}`,
      `Are you sure you want to ${actionWord} "${branch.name}"?${
        !nextState && branch.assigned_employees_count > 0
          ? `\n\nWarning: ${branch.assigned_employees_count} employee(s) are currently assigned to this branch.`
          : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: nextState ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await api.updateBranch(branch.id, {
                is_active: nextState,
                force: true
              });
              if (res.success) {
                loadData();
              } else {
                Alert.alert('Action Failed', res.error || `Could not ${actionWord} branch.`);
              }
            } catch (e) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Office Branches & Geofencing</Text>
          <Text style={styles.headerSubtitle}>Multi-Campus Attendance Geofence Boundaries</Text>
        </View>
        <TouchableOpacity style={styles.addHeaderBtn} onPress={openAddModal}>
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.addHeaderBtnText}>Add Branch</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading branch geofences...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Info Banner */}
          <View style={styles.statusCard}>
            <View style={styles.statusIconWrap}>
              <Ionicons name="business" size={26} color="#ffffff" />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Branch-Specific Geofencing Active</Text>
              <Text style={styles.statusSub}>
                Each WFO employee is validated against their assigned office branch's GPS coordinates and permitted perimeter.
              </Text>
            </View>
          </View>

          {/* Org-Wide Work From Home (WFH) Policy */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Allow Work From Home (WFH)</Text>
              <Text style={styles.toggleSub}>
                When enabled, employees assigned to WFH mode can punch in/out without branch geofence boundary checks.
              </Text>
            </View>
            {isSavingWfh ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={wfhAllowed}
                onValueChange={handleToggleWfh}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor="#ffffff"
              />
            )}
          </View>

          {/* Section: Branches List */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>ORGANIZATION BRANCHES ({branches.length})</Text>
            <TouchableOpacity onPress={loadData} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {branches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="business-outline" size={44} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Branches Configured</Text>
              <Text style={styles.emptySub}>
                Add your company headquarters or regional office branches to enable GPS geofence verification for staff.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={openAddModal}>
                <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Add First Branch</Text>
              </TouchableOpacity>
            </View>
          ) : (
            branches.map((b) => {
              const active = b.is_active !== false;
              return (
                <View key={b.id} style={[styles.branchCard, !active && styles.branchCardInactive]}>
                  {/* Card Header */}
                  <View style={styles.branchCardHeader}>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={styles.branchName} numberOfLines={1}>
                          {b.name}
                        </Text>
                        {b.is_headquarters && (
                          <View style={styles.hqPill}>
                            <Text style={styles.hqPillText}>HQ</Text>
                          </View>
                        )}
                        <View style={[styles.statusPill, active ? styles.statusPillActive : styles.statusPillInactive]}>
                          <Text style={[styles.statusPillText, active ? styles.textActive : styles.textInactive]}>
                            {active ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      {Boolean(b.address) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                          <Text style={styles.branchAddress} numberOfLines={2}>
                            {b.address}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Geofence Parameters */}
                  <View style={styles.paramsGrid}>
                    <View style={styles.paramBox}>
                      <Text style={styles.paramLabel}>Coordinates</Text>
                      <Text style={styles.paramValue} numberOfLines={1}>
                        {b.latitude != null && b.longitude != null
                          ? `${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)}`
                          : 'Not set'}
                      </Text>
                    </View>
                    <View style={styles.paramBox}>
                      <Text style={styles.paramLabel}>Radius</Text>
                      <Text style={styles.paramValue}>
                        {b.radius_meters || 150} meters
                      </Text>
                    </View>
                    <View style={styles.paramBox}>
                      <Text style={styles.paramLabel}>Assigned Staff</Text>
                      <Text style={[styles.paramValue, { color: colors.primary, fontWeight: '700' }]}>
                        {b.assigned_employees_count || 0}
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionBtnOutline}
                      onPress={() => openEditModal(b)}
                    >
                      <Ionicons name="create-outline" size={15} color={colors.textPrimary} />
                      <Text style={styles.actionBtnOutlineText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionBtnToggle,
                        active ? styles.actionBtnDeactivate : styles.actionBtnActivate
                      ]}
                      onPress={() => handleToggleBranchActive(b)}
                    >
                      <Ionicons
                        name={active ? 'pause-circle-outline' : 'checkmark-circle-outline'}
                        size={15}
                        color={active ? '#b91c1c' : '#15803d'}
                      />
                      <Text
                        style={[
                          styles.actionBtnToggleText,
                          { color: active ? '#b91c1c' : '#15803d' }
                        ]}
                      >
                        {active ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add / Edit Branch Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingBranch ? 'Edit Office Branch' : 'Add Office Branch'}</Text>
                <Text style={styles.modalSubtitle}>Configure campus address, coordinates & geofence perimeter</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
              {formError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#b91c1c" />
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              )}

              {/* Branch Name */}
              <Text style={styles.inputLabel}>BRANCH NAME *</Text>
              <TextInput
                style={styles.modalInput}
                value={branchName}
                onChangeText={setBranchName}
                placeholder="e.g. Gorakhpur Head Office, Lucknow Branch"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Branch Address */}
              <Text style={styles.inputLabel}>OFFICE ADDRESS</Text>
              <TextInput
                style={[styles.modalInput, { height: 65, textAlignVertical: 'top' }]}
                value={branchAddress}
                onChangeText={setBranchAddress}
                placeholder="Complete street address, landmark, and postal code"
                placeholderTextColor={colors.textSecondary}
                multiline
              />

              {/* Coordinates Section with GPS Capture */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={styles.inputLabel}>COORDINATES (WGS84) *</Text>
                <TouchableOpacity
                  style={styles.gpsCaptureBtn}
                  onPress={handleCaptureCurrentLocation}
                  disabled={isFetchingLocation}
                >
                  {isFetchingLocation ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={14} color={colors.primary} />
                      <Text style={styles.gpsCaptureText}>Use My GPS</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.subLabel}>Latitude (-90 to 90)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={branchLat}
                    onChangeText={setBranchLat}
                    placeholder="e.g. 26.809792"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.subLabel}>Longitude (-180 to 180)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={branchLng}
                    onChangeText={setBranchLng}
                    placeholder="e.g. 83.351565"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Permitted Radius */}
              <Text style={styles.inputLabel}>PERMITTED RADIUS (METERS) *</Text>
              <TextInput
                style={styles.modalInput}
                value={branchRadius}
                onChangeText={setBranchRadius}
                placeholder="150"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              <Text style={styles.helperText}>
                Recommended: 100–250m. Employees outside this perimeter are blocked during WFO Punch In/Out.
              </Text>

              {/* Headquarters Toggle */}
              <View style={styles.modalToggleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.modalToggleLabel}>Organization Headquarters</Text>
                  <Text style={styles.modalToggleSub}>
                    Used as default campus for existing unassigned WFO employees.
                  </Text>
                </View>
                <Switch
                  value={isHq}
                  onValueChange={setIsHq}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Active Toggle */}
              <View style={styles.modalToggleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.modalToggleLabel}>Branch Active</Text>
                  <Text style={styles.modalToggleSub}>
                    Inactive branches cannot accept attendance punches or new employee assignments.
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: '#767577', true: colors.primary }}
                  thumbColor="#ffffff"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isSavingBranch}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, isSavingBranch && { opacity: 0.7 }]}
                onPress={handleSaveBranch}
                disabled={isSavingBranch}
              >
                {isSavingBranch ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveModalBtnText}>
                    {editingBranch ? 'Update Branch' : 'Create Branch'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary
    },
    addHeaderBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8
    },
    addHeaderBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700'
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24
    },
    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
      fontSize: 13
    },
    content: {
      flex: 1,
      padding: 16
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 12,
      marginBottom: 14,
      gap: 12
    },
    statusIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center'
    },
    statusInfo: {
      flex: 1
    },
    statusTitle: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 2
    },
    statusSub: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 11.5,
      lineHeight: 16
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16
    },
    toggleInfo: {
      flex: 1,
      paddingRight: 12
    },
    toggleTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2
    },
    toggleSub: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 15
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.5
    },
    emptyCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      marginTop: 8
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 10
    },
    emptySub: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 16,
      lineHeight: 17
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 8
    },
    primaryBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700'
    },
    branchCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12
    },
    branchCardInactive: {
      opacity: 0.7,
      borderColor: '#9ca3af'
    },
    branchCardHeader: {
      marginBottom: 10
    },
    branchName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    hqPill: {
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    hqPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: isDark ? '#93c5fd' : '#1e40af'
    },
    statusPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    statusPillActive: {
      backgroundColor: isDark ? '#14532d' : '#dcfce7'
    },
    statusPillInactive: {
      backgroundColor: isDark ? '#7f1d1d' : '#fee2e2'
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700'
    },
    textActive: {
      color: isDark ? '#4ade80' : '#15803d'
    },
    textInactive: {
      color: isDark ? '#f87171' : '#b91c1c'
    },
    branchAddress: {
      fontSize: 11.5,
      color: colors.textSecondary,
      flex: 1
    },
    paramsGrid: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderRadius: 8,
      padding: 8,
      gap: 8,
      marginBottom: 12
    },
    paramBox: {
      flex: 1
    },
    paramLabel: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 2
    },
    paramValue: {
      fontSize: 11.5,
      fontWeight: '600',
      color: colors.textPrimary
    },
    cardActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10
    },
    actionBtnOutline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border
    },
    actionBtnOutlineText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary
    },
    actionBtnToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6
    },
    actionBtnActivate: {
      backgroundColor: isDark ? '#14532d' : '#dcfce7'
    },
    actionBtnDeactivate: {
      backgroundColor: isDark ? '#7f1d1d' : '#fee2e2'
    },
    actionBtnToggleText: {
      fontSize: 12,
      fontWeight: '700'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16
    },
    modalContent: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 14,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary
    },
    modalSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fee2e2',
      borderWidth: 1,
      borderColor: '#fca5a5',
      borderRadius: 8,
      padding: 8,
      marginBottom: 10
    },
    errorBannerText: {
      fontSize: 11.5,
      color: '#b91c1c',
      flex: 1
    },
    inputLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      color: colors.textSecondary,
      marginBottom: 4,
      marginTop: 8,
      letterSpacing: 0.5
    },
    subLabel: {
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 4
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.textPrimary,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc'
    },
    row: {
      flexDirection: 'row',
      gap: 10
    },
    col: {
      flex: 1
    },
    gpsCaptureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9'
    },
    gpsCaptureText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary
    },
    helperText: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 14
    },
    modalToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    modalToggleLabel: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textPrimary
    },
    modalToggleSub: {
      fontSize: 10.5,
      color: colors.textSecondary,
      marginTop: 2
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12
    },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary
    },
    saveModalBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8
    },
    saveModalBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ffffff'
    }
  });