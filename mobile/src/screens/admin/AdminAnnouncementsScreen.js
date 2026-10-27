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
  Alert
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

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAnnouncements(false);
      if (res.success && res.data) {
        setAnnouncements(res.data);
      }
    } catch (e) {
      console.warn('[AdminAnnouncements] Error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newMessage.trim()) {
      Alert.alert('Required', 'Please enter Title and Message.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createAnnouncement({
        title: newTitle.trim(),
        message: newMessage.trim(),
        priority: newPriority,
        audience: 'all'
      });

      if (res.success) {
        Alert.alert('Published', 'Announcement is now live across mobile and web.');
        setShowModal(false);
        setNewTitle('');
        setNewMessage('');
        loadAnnouncements();
      } else {
        Alert.alert('Error', res.error || 'Failed to post announcement.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Delete Notice', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.deleteAnnouncement(id);
            if (res.success) {
              loadAnnouncements();
            }
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        }
      }
    ]);
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
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notices...</Text>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="megaphone-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Announcements</Text>
          <Text style={styles.emptySubtitle}>Tap + above to broadcast a notice to all staff.</Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.titleArea}>
                  <Text style={styles.annTitle}>{item.title}</Text>
                  <Text style={styles.annDate}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Draft'}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  <View
                    style={[
                      styles.priorityTag,
                      item.priority === 'high' ? styles.priorityHigh : styles.priorityMed
                    ]}
                  >
                    <Text style={styles.priorityText}>{item.priority?.toUpperCase() || 'INFO'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.messageText}>{item.message}</Text>
            </View>
          )}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Company Announcement</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Title *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="e.g. Office Holiday Schedule"
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.formLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {['low', 'medium', 'high'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.prioritySelectBtn, newPriority === p && styles.prioritySelectBtnActive]}
                  onPress={() => setNewPriority(p)}
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
            />

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleCreateAnnouncement}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Broadcast Notice</Text>
              )}
            </TouchableOpacity>
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
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    priorityMed: {
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee'
    },
    priorityHigh: {
      backgroundColor: '#fee2e2'
    },
    priorityText: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.primary
    },
    deleteBtn: {
      padding: 4
    },
    messageText: {
      fontSize: 12,
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
      padding: 20
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
      backgroundColor: isDark ? '#1a2218' : '#f7faf5',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 42,
      fontSize: 13,
      color: colors.textPrimary
    },
    textArea: {
      height: 90,
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
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee',
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
      marginTop: 20
    },
    submitBtnDisabled: {
      opacity: 0.6
    },
    submitBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    }
  });
