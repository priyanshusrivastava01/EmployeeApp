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

export default function AdminAnnouncementsScreen({ onBack }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Announcement Modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [banner, setBanner] = useState(null);

  const notify = (alertTitle, alertMessage) => {
    if (Platform.OS === 'web') {
      window.alert(`${alertTitle}\n\n${alertMessage}`);
    } else {
      Alert.alert(alertTitle, alertMessage);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAnnouncements(false);
      if (res && res.success && Array.isArray(res.data)) {
        setAnnouncements(res.data);
      } else {
        setAnnouncements([]);
      }
    } catch (e) {
      console.warn('[AdminAnnouncements] Error:', e);
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleOpenCreate = () => {
    setNewTitle('');
    setNewMessage('');
    setNewPriority('medium');
    setModalError(null);
    setShowModal(true);
  };

  const handleCreateAnnouncement = async () => {
    setModalError(null);
    const trimmedTitle = newTitle.trim();
    const trimmedMessage = newMessage.trim();

    if (!trimmedTitle || !trimmedMessage) {
      const msg = 'Please enter both Title and Message.';
      setModalError(msg);
      notify('Required Fields', msg);
      return;
    }

    if (trimmedTitle.length > 255) {
      const msg = 'Announcement title must not exceed 255 characters.';
      setModalError(msg);
      notify('Title Too Long', msg);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createAnnouncement({
        title: trimmedTitle,
        message: trimmedMessage,
        priority: newPriority,
        audience: 'all',
        status: 'published'
      });

      if (res && res.success) {
        setShowModal(false);
        setNewTitle('');
        setNewMessage('');
        setNewPriority('medium');
        setModalError(null);
        setBanner({ type: 'success', message: 'Announcement broadcast successfully across mobile and web.' });
        setTimeout(() => setBanner(null), 5000);
        await loadAnnouncements();
      } else {
        const errMsg = res?.error || 'Failed to post announcement.';
        setModalError(errMsg);
        notify('Broadcast Failed', errMsg);
      }
    } catch (err) {
      const errMsg = err.message || 'Unable to post announcement.';
      setModalError(errMsg);
      notify('Broadcast Failed', errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async (id) => {
    try {
      const res = await api.deleteAnnouncement(id);
      if (res && res.success) {
        setBanner({ type: 'success', message: 'Announcement deleted.' });
        setTimeout(() => setBanner(null), 4000);
        await loadAnnouncements();
      } else {
        notify('Delete Failed', res?.error || 'Unable to delete notice.');
      }
    } catch (err) {
      notify('Error', err.message);
    }
  };

  const handleDelete = async (id) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this announcement?')) {
        executeDelete(id);
      }
      return;
    }
    Alert.alert('Delete Notice', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => executeDelete(id)
      }
    ]);
  };

  const getPriorityStyle = (priority) => {
    const p = String(priority || '').toLowerCase();
    if (p === 'high' || p === 'urgent') return styles.priorityHigh;
    if (p === 'low') return styles.priorityLow;
    return styles.priorityMed;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Announcements</Text>
          <Text style={styles.headerSubtitle}>{announcements.length} Notices Posted</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadAnnouncements}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleOpenCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
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

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notices...</Text>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Announcements Available</Text>
          <Text style={styles.emptySubtitle}>Tap + above to broadcast a notice to all staff.</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleArea}>
                  <Text style={styles.annTitle}>{item.title}</Text>
                  <Text style={styles.annDate}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    {item.created_by_name ? ` • By: ${item.created_by_name}` : ''}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <View style={[styles.priorityTag, getPriorityStyle(item.priority)]}>
                    <Text style={styles.priorityText}>{item.priority?.toUpperCase() || 'MEDIUM'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.messageText}>{item.message || item.content}</Text>
            </View>
          )}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Company Announcement</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} disabled={isSubmitting}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Title *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Office Holiday Schedule"
                placeholderTextColor={colors.textSecondary}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={255}
                editable={!isSubmitting}
              />

              <Text style={styles.formLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {['low', 'medium', 'high'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.prioritySelectBtn, newPriority === p && styles.prioritySelectBtnActive]}
                    onPress={() => setNewPriority(p)}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.prioritySelectText, newPriority === p && styles.prioritySelectTextActive]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Message *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                placeholder="Write the full broadcast notice..."
                placeholderTextColor={colors.textSecondary}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                numberOfLines={4}
                maxLength={10000}
                editable={!isSubmitting}
              />

              {modalError ? (
                <View style={styles.modalErrorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{modalError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleCreateAnnouncement}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Broadcast Notice</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    refreshBtn: {
      padding: 6,
      marginRight: 6
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
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center'
    },
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40
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
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center'
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8
    },
    titleArea: {
      flex: 1,
      marginRight: 8
    },
    annTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    annDate: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    priorityTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    priorityMed: {
      backgroundColor: isDark ? '#143828' : '#e6f4ea'
    },
    priorityHigh: {
      backgroundColor: isDark ? '#4a1515' : '#fee2e2'
    },
    priorityLow: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9'
    },
    priorityText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: colors.primary
    },
    deleteBtn: {
      padding: 4
    },
    messageText: {
      fontSize: 12.5,
      color: colors.textPrimary,
      lineHeight: 18
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end'
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '85%'
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    formLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6,
      marginTop: 10
    },
    formInput: {
      backgroundColor: isDark ? '#133333' : '#F7FAF9',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 42,
      fontSize: 13,
      color: colors.textPrimary
    },
    textArea: {
      height: 95,
      textAlignVertical: 'top',
      paddingTop: 10
    },
    priorityRow: {
      flexDirection: 'row',
      gap: 8
    },
    prioritySelectBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#133333' : '#E6F3F1',
      alignItems: 'center'
    },
    prioritySelectBtnActive: {
      backgroundColor: colors.primary
    },
    prioritySelectText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary
    },
    prioritySelectTextActive: {
      color: '#ffffff'
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 46,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 10
    },
    submitBtnDisabled: {
      opacity: 0.6
    },
    submitBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
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
