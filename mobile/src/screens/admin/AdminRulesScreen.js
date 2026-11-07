import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminRulesScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('published');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [banner, setBanner] = useState(null);

  const categories = ['General', 'Attendance', 'Geofence', 'Remote Work', 'Ethics'];

  const notify = (alertTitle, alertMessage) => {
    if (Platform.OS === 'web') {
      window.alert(`${alertTitle}\n\n${alertMessage}`);
    } else {
      Alert.alert(alertTitle, alertMessage);
    }
  };

  const loadRules = async () => {
    try {
      setIsLoading(true);
      const res = await api.getRules(false);
      if (res && res.success && Array.isArray(res.data)) {
        setRules(res.data);
      } else {
        setRules([]);
      }
    } catch (e) {
      console.warn('[AdminRules] Error loading:', e);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleOpenCreate = () => {
    setEditingRuleId(null);
    setTitle('');
    setCategory('General');
    setBody('');
    setStatus('published');
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (rule) => {
    setEditingRuleId(rule.id);
    setTitle(rule.title || '');
    setCategory(rule.category || 'General');
    setBody(rule.body || rule.summary || rule.description || '');
    setStatus(rule.status || 'published');
    setModalError(null);
    setShowModal(true);
  };

  const handleSaveRule = async () => {
    setModalError(null);
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle || !trimmedBody) {
      const msg = 'Please provide both Title and Policy Details.';
      setModalError(msg);
      notify('Required Fields', msg);
      return;
    }

    if (trimmedTitle.length > 255) {
      const msg = 'Policy title must not exceed 255 characters.';
      setModalError(msg);
      notify('Title Too Long', msg);
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingRuleId) {
        const res = await api.updateRule(editingRuleId, {
          title: trimmedTitle,
          category,
          body: trimmedBody,
          status
        });
        if (res && res.success) {
          setShowModal(false);
          setTitle('');
          setBody('');
          setCategory('General');
          setEditingRuleId(null);
          setModalError(null);
          setBanner({ type: 'success', message: 'Company policy updated successfully.' });
          setTimeout(() => setBanner(null), 5000);
          await loadRules();
        } else {
          const errMsg = res?.error || 'Failed to update company policy.';
          setModalError(errMsg);
          notify('Update Failed', errMsg);
        }
      } else {
        const res = await api.createRule({
          title: trimmedTitle,
          category,
          body: trimmedBody,
          status
        });
        if (res && res.success) {
          setShowModal(false);
          setTitle('');
          setBody('');
          setCategory('General');
          setEditingRuleId(null);
          setModalError(null);
          setBanner({ type: 'success', message: 'Company policy published to employees.' });
          setTimeout(() => setBanner(null), 5000);
          await loadRules();
        } else {
          const errMsg = res?.error || 'Failed to create company policy.';
          setModalError(errMsg);
          notify('Publish Failed', errMsg);
        }
      }
    } catch (err) {
      const errMsg = err.message || 'Unable to publish company policy.';
      setModalError(errMsg);
      notify('Publish Failed', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async (id) => {
    try {
      const res = await api.deleteRule(id);
      if (res && res.success) {
        setBanner({ type: 'success', message: 'Company policy deleted.' });
        setTimeout(() => setBanner(null), 4000);
        await loadRules();
      } else {
        notify('Delete Failed', res?.error || 'Failed to delete policy.');
      }
    } catch (e) {
      notify('Error', e.message);
    }
  };

  const handleDeleteRule = (id, ruleTitle) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove "${ruleTitle}"?`)) {
        executeDelete(id);
      }
      return;
    }
    Alert.alert(
      'Delete Policy',
      `Are you sure you want to remove "${ruleTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeDelete(id)
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Company Rules & Policies</Text>
          <Text style={styles.headerSubtitle}>Management Operating Guidelines</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadRules} activeOpacity={0.8}>
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Cross-Platform Notification Banner */}
      {banner && (
        <View style={[styles.feedbackBanner, banner.type === 'success' ? styles.feedbackBannerSuccess : styles.feedbackBannerError]}>
          <Ionicons
            name={banner.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={banner.type === 'success' ? '#10b981' : '#ef4444'}
          />
          <Text style={[styles.feedbackBannerText, { color: banner.type === 'success' ? (isDark ? '#4ade80' : '#065f46') : (isDark ? '#f87171' : '#991b1b') }]}>
            {banner.message}
          </Text>
        </View>
      )}

      {/* Primary Action Button */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.createBtn} onPress={handleOpenCreate} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.createBtnText}>New Company Policy</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading company rules...</Text>
        </View>
      ) : rules.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="shield-checkmark-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Company Policies Available</Text>
          <Text style={styles.emptySub}>There are no company policies defined yet. Tap 'New Company Policy' above to publish guidelines for your staff.</Text>
        </View>
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.category || 'General'}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'draft' ? '#fef3c7' : '#dcfce7' }]}>
                      <Text style={[styles.statusBadgeText, { color: item.status === 'draft' ? '#b45309' : '#15803d' }]}>
                        {item.status ? item.status.toUpperCase() : 'PUBLISHED'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ruleTitle}>{item.title}</Text>
                </View>
              </View>

              <Text style={styles.ruleBody}>{item.body || item.summary || item.description}</Text>

              <View style={styles.ruleActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEdit(item)}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteRule(item.id, item.title)}>
                  <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                  <Text style={[styles.actionBtnText, { color: '#b91c1c' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Create / Edit Policy Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingRuleId ? 'Edit Policy' : 'Create Company Policy'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} disabled={isSubmitting}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Policy Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Daily Attendance & Shift Timing"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={255}
                editable={!isSubmitting}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.chipRow}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive]}
                    onPress={() => setCategory(c)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Policy Content & Details *</Text>
              <TextInput
                style={[styles.textInput, { height: 120, textAlignVertical: 'top' }]}
                placeholder="Outline the operational rules, employee expectations, and compliance guidelines..."
                placeholderTextColor={colors.textSecondary}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={20000}
                editable={!isSubmitting}
              />

              {modalError ? (
                <View style={styles.modalErrorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{modalError}</Text>
                </View>
              ) : null}

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleSaveRule}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSubmitText}>{editingRuleId ? 'Update Policy' : 'Publish Policy'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getStyles(colors, isDark) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backBtn: {
      padding: 6
    },
    headerTitleWrap: {
      flex: 1,
      marginLeft: 8
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    refreshBtn: {
      padding: 8
    },
    actionBar: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6
    },
    createBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700'
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    loadingText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12
    },
    emptySub: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 18
    },
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40
    },
    ruleCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    ruleHeader: {
      marginBottom: 8
    },
    categoryBadge: {
      backgroundColor: isDark ? '#143828' : '#e6f4ea',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    categoryBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    statusBadgeText: {
      fontSize: 9,
      fontWeight: '700'
    },
    ruleTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 4
    },
    ruleBody: {
      fontSize: 12.5,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: 10
    },
    ruleActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: '600'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16
    },
    modalCard: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      maxHeight: '85%'
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 10,
      marginBottom: 5
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.textPrimary,
      backgroundColor: isDark ? '#1f2937' : '#ffffff'
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#1f2937' : '#f8fafc'
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    chipText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    chipTextActive: {
      color: '#ffffff'
    },
    modalBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 16,
      marginBottom: 6
    },
    modalCancelBtn: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border
    },
    modalCancelText: {
      fontSize: 13,
      color: colors.textSecondary
    },
    modalSubmitBtn: {
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.primary
    },
    modalSubmitText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#ffffff'
    },
    feedbackBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: 8,
      borderWidth: 1
    },
    feedbackBannerSuccess: {
      backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
      borderColor: isDark ? '#047857' : '#a7f3d0'
    },
    feedbackBannerError: {
      backgroundColor: isDark ? '#7f1d1d' : '#fef2f2',
      borderColor: isDark ? '#b91c1c' : '#fecaca'
    },
    feedbackBannerText: {
      fontSize: 12,
      fontWeight: '600',
      flex: 1
    },
    modalErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#f87171',
      marginTop: 12
    },
    modalErrorText: {
      fontSize: 12,
      color: '#ef4444',
      flex: 1,
      fontWeight: '600'
    }
  });
}
