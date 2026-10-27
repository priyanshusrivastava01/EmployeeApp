import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminAuditsScreen({ onBack, user }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [audits, setAudits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Audit Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [category, setCategory] = useState('Work Quality & Discipline');
  const [score, setScore] = useState(8.5);
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [auditRes, empRes] = await Promise.all([
        api.getAudits().catch(() => ({ success: false, data: [] })),
        api.getUsers().catch(() => ({ success: false, data: [] }))
      ]);

      if (auditRes.success && auditRes.data) {
        setAudits(auditRes.data);
      }
      if (empRes.success && empRes.data) {
        // Filter out admin/founder if creating audit for subordinates
        const candidates = empRes.data.filter(u => u.id !== user?.id);
        setEmployees(candidates);
        if (candidates.length > 0 && !selectedEmpId) {
          setSelectedEmpId(candidates[0].id);
        }
      }
    } catch (e) {
      console.warn('[Audits] Load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAudit = async () => {
    if (!selectedEmpId) {
      Alert.alert('Selection Required', 'Please select a team member to audit.');
      return;
    }

    const emp = employees.find(e => e.id === selectedEmpId);

    try {
      setIsSubmitting(true);
      const res = await api.submitAudit({
        employeeId: selectedEmpId,
        employeeName: emp?.name,
        category,
        score,
        strengths: strengths.trim(),
        improvements: improvements.trim(),
        actionItems: actionItems.trim(),
        remarks: remarks.trim()
      });

      if (res.success) {
        Alert.alert('Audit Saved', 'Team Leader audit record saved successfully.');
        setShowModal(false);
        setStrengths('');
        setImprovements('');
        setActionItems('');
        setRemarks('');
        loadData();
      } else {
        Alert.alert('Error', res.error || 'Failed to submit audit record.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Team Leader Audits</Text>
          <Text style={styles.headerSubtitle}>
            {audits.length} Formal Performance & Quality Reviews
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading audit records...</Text>
        </View>
      ) : audits.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="star-outline" size={54} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Audit Records Yet</Text>
          <Text style={styles.emptySubtitle}>
            Conduct a quality review for your team members using the + button above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={audits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.employeeName}>{item.employee_name || 'Team Member'}</Text>
                  <Text style={styles.categoryText}>{item.category || 'General Audit'}</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreVal}>{Number(item.score).toFixed(1)}</Text>
                  <Text style={styles.scoreMax}>/10</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  Auditor: {item.auditor_name} ({item.auditor_role?.replace('_', ' ').toUpperCase()})
                </Text>
                <Text style={styles.dotSeparator}>&bull;</Text>
                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{item.audit_date}</Text>
              </View>

              {item.strengths ? (
                <View style={styles.feedbackBlock}>
                  <Text style={styles.feedbackLabel}>Key Strengths:</Text>
                  <Text style={styles.feedbackVal}>{item.strengths}</Text>
                </View>
              ) : null}

              {item.improvements ? (
                <View style={styles.feedbackBlock}>
                  <Text style={styles.feedbackLabel}>Areas for Improvement:</Text>
                  <Text style={styles.feedbackVal}>{item.improvements}</Text>
                </View>
              ) : null}

              {item.action_items ? (
                <View style={styles.actionBlock}>
                  <Ionicons name="checkbox-outline" size={14} color={colors.primary} />
                  <Text style={styles.actionText}>{item.action_items}</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      {/* New Audit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Team Audit</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Select Team Member */}
              <Text style={styles.fieldLabel}>Select Team Member</Text>
              <View style={styles.empChipContainer}>
                {employees.map(emp => {
                  const isSelected = selectedEmpId === emp.id;
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.empChip, isSelected && styles.empChipActive]}
                      onPress={() => setSelectedEmpId(emp.id)}
                    >
                      <Text style={[styles.empChipText, isSelected && styles.empChipTextActive]}>
                        {emp.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category */}
              <Text style={styles.fieldLabel}>Audit Category</Text>
              <View style={styles.catGrid}>
                {['Work Quality & Discipline', 'Sprint Execution', 'Technical Architecture', 'Client Delivery'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, category === cat && styles.catBtnActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catText, category === cat && styles.catTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Score Stepper */}
              <View style={styles.scoreRow}>
                <View>
                  <Text style={styles.fieldLabel}>Performance Score</Text>
                  <Text style={styles.scoreSubtext}>Out of 10.0</Text>
                </View>
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setScore(prev => Math.max(1, (prev - 0.5)))}
                  >
                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.stepperVal}>{score.toFixed(1)}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setScore(prev => Math.min(10, (prev + 0.5)))}
                  >
                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Strengths */}
              <Text style={styles.fieldLabel}>Key Strengths</Text>
              <TextInput
                style={styles.textArea}
                value={strengths}
                onChangeText={setStrengths}
                placeholder="Observed accomplishments, problem-solving, work ethic..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              {/* Areas for Improvement */}
              <Text style={styles.fieldLabel}>Areas for Improvement</Text>
              <TextInput
                style={styles.textArea}
                value={improvements}
                onChangeText={setImprovements}
                placeholder="Specific guidance, code hygiene, timeline adherence..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />

              {/* Action Items */}
              <Text style={styles.fieldLabel}>Next Action Items</Text>
              <TextInput
                style={styles.input}
                value={actionItems}
                onChangeText={setActionItems}
                placeholder="e.g. Complete sprint retrospective by Friday"
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleCreateAudit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Save Audit Record</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
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
      fontSize: 12,
      color: colors.textSecondary
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center'
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6
    },
    listContent: {
      padding: 16,
      gap: 12
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.04,
      shadowRadius: 6,
      elevation: 2
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8
    },
    cardHeaderLeft: {
      flex: 1
    },
    employeeName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary
    },
    categoryText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 2
    },
    scoreBadge: {
      flexDirection: 'row',
      alignItems: 'baseline',
      backgroundColor: isDark ? '#1f2937' : '#ecfdf5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary
    },
    scoreVal: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary
    },
    scoreMax: {
      fontSize: 11,
      color: colors.textSecondary,
      marginLeft: 2
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 6
    },
    metaText: {
      fontSize: 11,
      color: colors.textSecondary
    },
    dotSeparator: {
      fontSize: 11,
      color: colors.textSecondary
    },
    feedbackBlock: {
      marginTop: 8
    },
    feedbackLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 2
    },
    feedbackVal: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18
    },
    actionBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 6
    },
    actionText: {
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '600',
      flex: 1
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end'
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
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
    modalBody: {
      paddingBottom: 24
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 6
    },
    empChipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 6
    },
    empChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background
    },
    empChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary
    },
    empChipText: {
      fontSize: 13,
      color: colors.textSecondary
    },
    empChipTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    catGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    catBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background
    },
    catBtnActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(78, 93, 73, 0.4)' : '#ecfdf5'
    },
    catText: {
      fontSize: 11,
      color: colors.textSecondary
    },
    catTextActive: {
      color: colors.primary,
      fontWeight: '700'
    },
    scoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 6
    },
    scoreSubtext: {
      fontSize: 11,
      color: colors.textSecondary
    },
    stepperWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    },
    stepperBtn: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center'
    },
    stepperVal: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.primary,
      minWidth: 40,
      textAlign: 'center'
    },
    textArea: {
      backgroundColor: colors.inputBackground || colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 13,
      color: colors.textPrimary,
      textAlignVertical: 'top',
      minHeight: 64
    },
    input: {
      backgroundColor: colors.inputBackground || colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 42,
      fontSize: 13,
      color: colors.textPrimary
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20
    },
    submitBtnDisabled: {
      opacity: 0.6
    },
    submitBtnText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700'
    }
  });
