import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme/ThemeContext';
import { mockDailyTaskSpreadsheet } from '../data/mockEmployeeData';
import api from '../services/api';

export default function TaskReportScreen({ currentUser }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  // Employee and Month selection
  const employeeName = currentUser?.name || mockDailyTaskSpreadsheet.employeeName;
  const [selectedMonth, setSelectedMonth] = useState(mockDailyTaskSpreadsheet.selectedMonth);
  const [totalWorkingDays] = useState(mockDailyTaskSpreadsheet.totalWorkingDays);

  // Today's date info (IST standard fallback)
  const defaultToday = new Date().toISOString().slice(0, 10);
  const defaultDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [currentDate, setCurrentDate] = useState(defaultToday);
  const [currentDay, setCurrentDay] = useState(defaultDay);

  // Daily task state for today
  const [tasks, setTasks] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState('Unsaved'); // 'Unsaved', 'Draft', 'Submitted'
  const [isEditingTodayReport, setIsEditingTodayReport] = useState(false);
  const [todayReportData, setTodayReportData] = useState(null);

  // Modals & History state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [historicalReports, setHistoricalReports] = useState([]);
  const [selectedHistoricalReport, setSelectedHistoricalReport] = useState(null);
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);

  // Loading & Submission states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // New task form state
  const [projectName, setProjectName] = useState('Android Mobile App');
  const [taskDescription, setTaskDescription] = useState('');
  const [newCompleted, setNewCompleted] = useState(true); // true = Completed, false = Pending

  // Inline editing existing task
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editProject, setEditProject] = useState('');

  // 6 Employee Ratings (out of 10)
  const [ratings, setRatings] = useState(mockDailyTaskSpreadsheet.ratings);

  // Team Leader Audit state (Read-Only for employee)
  const [tlAudit] = useState(mockDailyTaskSpreadsheet.tlAudit);

  // Toast feedback banner
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const showFeedback = (msg) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  /**
   * Load today's task lifecycle state & historical previous days
   */
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Today's Report & Carried-Forward Tasks
      const todayRes = await api.getTodayDailyReport();
      if (todayRes && todayRes.success) {
        if (todayRes.today) setCurrentDate(todayRes.today);
        if (todayRes.dayName) setCurrentDay(todayRes.dayName);

        if (todayRes.isSubmitted) {
          setSubmissionStatus('Submitted');
          setTodayReportData(todayRes.report);
          setTasks(todayRes.tasks || []);
        } else if (todayRes.isDraft) {
          setSubmissionStatus('Draft');
          setTodayReportData(todayRes.report);
          setTasks(todayRes.tasks || []);
        } else {
          setSubmissionStatus('Unsaved');
          // Carried-forward pending tasks or fresh sheet
          setTasks(todayRes.tasks || []);
        }

        // Restore ratings if recorded
        if (todayRes.report && todayRes.report.rating_speed != null) {
          setRatings({
            speed: Number(todayRes.report.rating_speed) || 5,
            understanding: Number(todayRes.report.rating_understanding) || 5,
            problemSolving: Number(todayRes.report.rating_problem_solving) || 5,
            talkingBehaviour: Number(todayRes.report.rating_talking_behaviour) || 5,
            workQuality: Number(todayRes.report.rating_work_quality) || 5,
            discipline: Number(todayRes.report.rating_discipline) || 5
          });
        }
      }

      // 2. Fetch Historical Previous Days Reports
      const histRes = await api.getDailyReportsHistory();
      if (histRes && histRes.success && Array.isArray(histRes.data)) {
        setHistoricalReports(histRes.data);
      }
    } catch (err) {
      console.warn('[TaskReportScreen] Load error:', err);
      // Fallback to local demo data if network unavailable
      if (tasks.length === 0) {
        setTasks(mockDailyTaskSpreadsheet.reports);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const store = api.getStore();
    if (store && store.subscribe) {
      const unsub = store.subscribe(() => {
        loadData();
      });
      return () => unsub();
    }
  }, [loadData]);

  /**
   * Calculate Average Overall out of 10, rounded to 2 decimal places
   */
  const calculateAverageOverall = () => {
    const { speed, understanding, problemSolving, talkingBehaviour, workQuality, discipline } = ratings;
    const sum = (speed || 0) + (understanding || 0) + (problemSolving || 0) +
                (talkingBehaviour || 0) + (workQuality || 0) + (discipline || 0);
    return (sum / 6).toFixed(2);
  };

  /**
   * Format date for readable carry-forward badge (e.g. 2026-10-27 -> 27 Oct 2026)
   */
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return 'previous day';
    try {
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  /**
   * Handle task status toggle with contradiction prevention
   * Completed 'Yes' <-> Pending 'No'; Completed 'No' <-> Pending 'Yes'
   */
  const handleToggleTaskStatus = (id, targetField, targetValue) => {
    const nextCompleted = targetField === 'completed' ? targetValue : (targetValue === 'Yes' ? 'No' : 'Yes');
    const nextPending = targetField === 'pending' ? targetValue : (targetValue === 'Yes' ? 'No' : 'Yes');

    setTasks(prev =>
      prev.map(task => {
        if (task.id !== id) return task;

        return {
          ...task,
          completed: nextCompleted,
          pending: nextPending
        };
      })
    );

    // Sync status change to management in real-time
    if (api.updateTaskStatus) {
      api.updateTaskStatus({
        taskId: id,
        completed: nextCompleted,
        pending: nextPending
      }).catch(() => {});
    }
  };

  /**
   * Add new task to current date sheet
   */
  const handleAddTask = () => {
    if (!taskDescription.trim()) {
      Alert.alert('Task Required', 'Please enter a description for the assigned task.');
      return;
    }

    const newTask = {
      id: 'task-entry-' + Date.now(),
      taskDate: currentDate,
      projectName: projectName.trim() || 'General Operations',
      tasksAssigned: taskDescription.trim(),
      completed: newCompleted ? 'Yes' : 'No',
      pending: newCompleted ? 'No' : 'Yes',
      isCarriedForward: false,
      carriedForwardFromDate: null,
      carriedForwardFromTaskId: null
    };

    setTasks(prev => [...prev, newTask]);
    setTaskDescription('');
    showFeedback('Task added to today\'s sheet.');
  };

  /**
   * Remove task from today's active sheet
   */
  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showFeedback('Task removed from sheet.');
  };

  /**
   * Start inline editing existing task
   */
  const handleStartEdit = (task) => {
    setEditingTaskId(task.id);
    setEditText(task.tasksAssigned);
    setEditProject(task.projectName);
  };

  const handleSaveEdit = () => {
    if (!editText.trim()) return;
    setTasks(prev =>
      prev.map(t =>
        t.id === editingTaskId
          ? { ...t, tasksAssigned: editText.trim(), projectName: editProject.trim() || t.projectName }
          : t
      )
    );
    setEditingTaskId(null);
    showFeedback('Task updated.');
  };

  /**
   * Adjust Rating stepper (1 to 10)
   */
  const handleRatingChange = (field, delta) => {
    setRatings(prev => {
      const current = prev[field] || 5;
      const updated = Math.min(10, Math.max(1, current + delta));
      return { ...prev, [field]: updated };
    });
  };

  /**
   * Save Draft action - persists to server without finalizing
   */
  const handleSaveDraft = async () => {
    if (tasks.length === 0) {
      Alert.alert('Empty Sheet', 'Please add at least one task before saving draft.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.saveDailyReportDraft({
        work_date: currentDate,
        projectName: projectName || 'General Operations',
        tasks: tasks,
        ratingSpeed: ratings.speed,
        ratingUnderstanding: ratings.understanding,
        ratingProblemSolving: ratings.problemSolving,
        ratingTalkingBehaviour: ratings.talkingBehaviour,
        ratingWorkQuality: ratings.workQuality,
        ratingDiscipline: ratings.discipline
      });

      setIsSubmitting(false);
      if (res && res.success) {
        setSubmissionStatus('Draft');
        showFeedback('Draft saved securely to server. You can resume editing anytime.');
      } else {
        showFeedback(res?.error || 'Failed to save draft.');
      }
    } catch (e) {
      setIsSubmitting(false);
      setSubmissionStatus('Draft');
      showFeedback('Draft saved locally. Offline sync pending.');
    }
  };

  /**
   * Open Submission Confirmation Modal
   */
  const handleOpenSubmitModal = () => {
    if (tasks.length === 0) {
      Alert.alert('No Tasks', 'Please add at least one task before submitting your daily report.');
      return;
    }
    setShowSubmitModal(true);
  };

  /**
   * Confirm and finalize Daily Report submission
   */
  const handleConfirmSubmitReport = async () => {
    try {
      setIsSubmitting(true);
      setShowSubmitModal(false);

      const res = await api.submitDailyReport({
        work_date: currentDate,
        projectName: projectName || 'General Operations',
        tasks: tasks,
        ratingSpeed: ratings.speed,
        ratingUnderstanding: ratings.understanding,
        ratingProblemSolving: ratings.problemSolving,
        ratingTalkingBehaviour: ratings.talkingBehaviour,
        ratingWorkQuality: ratings.workQuality,
        ratingDiscipline: ratings.discipline
      });

      setIsSubmitting(false);
      if (res && res.success) {
        setSubmissionStatus('Submitted');
        setIsEditingTodayReport(false);
        setTodayReportData(res.data);
        showFeedback('Daily Task Summary successfully synced to Management Dashboard!');
        loadData();
      } else {
        Alert.alert('Submission Error', res?.error || 'Failed to submit report.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setSubmissionStatus('Submitted');
      setIsEditingTodayReport(false);
      showFeedback('Report saved locally. Offline sync pending.');
    }
  };

  /**
   * Cancel same-day edit mode and restore saved submitted report
   */
  const handleCancelEditingToday = () => {
    setIsEditingTodayReport(false);
    loadData();
    showFeedback('Editing cancelled.');
  };

  /**
   * Open Historical Report in Read-Only Modal
   */
  const handleOpenHistoricalReport = (report) => {
    setSelectedHistoricalReport(report);
    setShowHistoricalModal(true);
  };

  /**
   * Download My Reports (Excel) action
   */
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const res = await api.exportDailyReports({ month: selectedMonth });
      if (!res || !res.success || !res.base64) {
        setIsExporting(false);
        Alert.alert('Export Notice', res?.error || 'No submitted task reports found to export.');
        return;
      }

      const filename = res.filename || `Employee_Task_Reports_${selectedMonth}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, res.base64, {
        encoding: FileSystem.EncodingType.Base64
      });

      setIsExporting(false);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Download & Share Task Reports Excel',
          UTI: 'com.microsoft.excel.xlsx'
        });
        showFeedback(`Excel export ready: ${filename}`);
      } else {
        Alert.alert('Spreadsheet Saved', `Task report Excel file saved to device:\n${fileUri}`);
      }
    } catch (err) {
      setIsExporting(false);
      Alert.alert('Export Error', err.message || 'Could not export task reports.');
    }
  };

  const averageOverall = calculateAverageOverall();
  const completedCount = tasks.filter(t => t.completed === 'Yes').length;
  const pendingCount = tasks.filter(t => t.pending === 'Yes').length;
  const carriedForwardCount = tasks.filter(t => t.isCarriedForward).length;

  const isSubmittedToday = submissionStatus === 'Submitted';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Toast Feedback */}
      {feedbackMessage && (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
        </View>
      )}

      {/* Screen Title & Export Action */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.title}>Daily Task Summary</Text>
            <Text style={styles.subtitle}>
              Standardized Excel Spreadsheet Structure & Review
            </Text>
          </View>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportExcel}
            disabled={isExporting}
            activeOpacity={0.8}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={15} color="#ffffff" />
                <Text style={styles.exportBtnText}>Download (Excel)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 1. SPREADSHEET HEADER SUMMARY CARD */}
      {/* ========================================================================= */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Employee Name</Text>
            <Text style={styles.summaryValue}>{employeeName}</Text>
          </View>
          <View style={styles.summaryColRight}>
            <Text style={styles.summaryLabel}>Total Working Days</Text>
            <View style={styles.badgeWorkingDays}>
              <Ionicons name="calendar-outline" size={13} color={colors.darkOlive} />
              <Text style={styles.workingDaysText}>{totalWorkingDays} Days</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryLabel}>Selected Month</Text>
            <View style={styles.monthSelectorRow}>
              {['October 2026', 'September 2026'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthPill, selectedMonth === m && styles.monthPillActive]}
                  onPress={() => setSelectedMonth(m)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.monthPillText, selectedMonth === m && styles.monthPillTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.summaryColRight}>
            <Text style={styles.summaryLabel}>Report Status</Text>
            <View style={[
              styles.statusPill,
              isSubmittedToday ? styles.statusPillSubmitted : styles.statusPillDraft
            ]}>
              <Ionicons
                name={isSubmittedToday ? 'checkmark-done' : 'create-outline'}
                size={13}
                color={isSubmittedToday ? colors.darkOlive : '#C28424'}
              />
              <Text style={[
                styles.statusPillText,
                isSubmittedToday ? styles.statusPillTextSubmitted : styles.statusPillTextDraft
              ]}>
                {isSubmittedToday ? 'Submitted to TL' : (submissionStatus === 'Draft' ? 'Draft (Saved)' : 'Draft (Unsaved)')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. TODAY'S TASK SECTION (SUBMITTED VIEW vs ACTIVE DRAFT ENTRY) */}
      {/* ========================================================================= */}
      {isSubmittedToday && !isEditingTodayReport ? (
        /* TODAY'S SUBMITTED REPORT CARD */
        <View style={styles.submittedReportCard}>
          <View style={styles.submittedReportHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.submittedReportTitle}>Today's Submitted Report</Text>
              </View>
              <Text style={styles.submittedReportSubtitle}>
                {currentDate} ({currentDay}) • Locked & Submitted to TL
              </Text>
            </View>
            <View style={styles.badgeSubmittedTL}>
              <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
              <Text style={styles.badgeSubmittedTLText}>Submitted to TL</Text>
            </View>
          </View>

          {/* Breakdown Pills */}
          <View style={styles.statPillsRow}>
            <View style={styles.statPillItem}>
              <Text style={styles.statPillLabel}>Total Tasks</Text>
              <Text style={styles.statPillVal}>{tasks.length}</Text>
            </View>
            <View style={[styles.statPillItem, styles.statPillGreen]}>
              <Text style={[styles.statPillLabel, { color: '#27AE60' }]}>Completed</Text>
              <Text style={[styles.statPillVal, { color: '#27AE60' }]}>{completedCount}</Text>
            </View>
            <View style={[styles.statPillItem, styles.statPillAmber]}>
              <Text style={[styles.statPillLabel, { color: '#C28424' }]}>Pending</Text>
              <Text style={[styles.statPillVal, { color: '#C28424' }]}>{pendingCount}</Text>
            </View>
          </View>

          {/* Submitted Tasks List */}
          <View style={styles.submittedTasksList}>
            {tasks.map((task, idx) => (
              <View key={task.id || idx} style={styles.submittedTaskItem}>
                <View style={styles.taskCardTop}>
                  <View style={styles.projectPill}>
                    <Ionicons name="folder-outline" size={11} color={colors.darkOlive} />
                    <Text style={styles.projectPillText}>{task.projectName}</Text>
                  </View>
                  <View style={[
                    styles.statusTag,
                    task.completed === 'Yes' ? styles.statusTagCompleted : styles.statusTagPending
                  ]}>
                    <Ionicons
                      name={task.completed === 'Yes' ? 'checkmark' : 'time-outline'}
                      size={11}
                      color={task.completed === 'Yes' ? '#27AE60' : '#C28424'}
                    />
                    <Text style={[
                      styles.statusTagText,
                      task.completed === 'Yes' ? styles.statusTagTextCompleted : styles.statusTagTextPending
                    ]}>
                      {task.completed === 'Yes' ? 'Completed' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {task.isCarriedForward && (
                  <View style={styles.carriedForwardBadge}>
                    <Ionicons name="arrow-redo" size={11} color="#9A6B1F" />
                    <Text style={styles.carriedForwardBadgeText}>
                      Carried forward from {formatDateLabel(task.carriedForwardFromDate)}
                    </Text>
                  </View>
                )}

                <Text style={styles.submittedTaskDesc}>{task.tasksAssigned}</Text>
              </View>
            ))}
          </View>

          {/* Same-Day Actions */}
          <View style={styles.submittedActionsRow}>
            <TouchableOpacity
              style={styles.btnEditToday}
              onPress={() => setIsEditingTodayReport(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil" size={15} color="#ffffff" />
              <Text style={styles.btnEditTodayText}>Edit Today's Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnAddExtraTask}
              onPress={() => {
                setIsEditingTodayReport(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={15} color={colors.text} />
              <Text style={styles.btnAddExtraTaskText}>+ Add Task</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sameDayHelpText}>
            You can make changes or append tasks to today's report throughout today.
          </Text>
        </View>
      ) : (
        /* ACTIVE TASK DRAFT & ENTRY SECTION */
        <View style={styles.section}>
          {isEditingTodayReport && (
            <View style={styles.editingModeBanner}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="create-outline" size={16} color="#ffffff" />
                  <Text style={styles.editingModeTitle}>Editing Today's Report</Text>
                </View>
                <Text style={styles.editingModeSubtitle}>
                  Make your updates below and tap "Update Submitted Report" to save.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.btnCancelEdit}
                onPress={handleCancelEditingToday}
              >
                <Text style={styles.btnCancelEditText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Daily Tasks Sheet</Text>
              <Text style={styles.sectionSubheading}>
                Date: <Text style={styles.boldWhite}>{currentDate}</Text> ({currentDay})
              </Text>
            </View>
            <View style={styles.taskCountBadge}>
              <Text style={styles.taskCountText}>{tasks.length} tasks</Text>
            </View>
          </View>

          {/* Active Tasks List */}
          {tasks.length === 0 ? (
            <View style={styles.emptyTaskCard}>
              <Ionicons name="clipboard-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyTaskTitle}>No tasks recorded for today</Text>
              <Text style={styles.emptyTaskSubtitle}>Add what you worked on using the form below.</Text>
            </View>
          ) : (
            tasks.map((task, idx) => {
              const isCompleted = task.completed === 'Yes';
              const isPending = task.pending === 'Yes';
              const isEditing = editingTaskId === task.id;

              return (
                <View key={task.id || idx} style={styles.taskCard}>
                  <View style={styles.taskCardTop}>
                    <View style={styles.projectPill}>
                      <Ionicons name="folder-outline" size={12} color={colors.darkOlive} />
                      <Text style={styles.projectPillText}>{task.projectName}</Text>
                    </View>
                    <Text style={styles.taskIndexText}>#{idx + 1}</Text>
                  </View>

                  {/* Carried Forward Badge */}
                  {task.isCarriedForward && (
                    <View style={styles.carriedForwardBadge}>
                      <Ionicons name="arrow-redo" size={12} color="#9A6B1F" />
                      <Text style={styles.carriedForwardBadgeText}>
                        Carried forward from {formatDateLabel(task.carriedForwardFromDate)}
                      </Text>
                    </View>
                  )}

                  {/* Management Assigned Badge */}
                  {Boolean(task.isManagementAssigned) && (
                    <View style={[styles.carriedForwardBadge, { backgroundColor: isDark ? '#1e2e1d' : '#eef8ed', borderColor: '#86efac' }]}>
                      <Ionicons name="shield-checkmark" size={12} color="#15803d" />
                      <Text style={[styles.carriedForwardBadgeText, { color: '#15803d', fontWeight: '700' }]}>
                        Assigned by {task.assignedBy || 'Management'}
                      </Text>
                    </View>
                  )}

                  {isEditing ? (
                    <View style={styles.editBox}>
                      <TextInput
                        style={styles.editInput}
                        value={editProject}
                        onChangeText={setEditProject}
                        placeholder="Project Name"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <TextInput
                        style={[styles.editInput, { height: 60 }]}
                        multiline
                        value={editText}
                        onChangeText={setEditText}
                        placeholder="Task description"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <View style={styles.editActionRow}>
                        <TouchableOpacity style={styles.btnSmallSave} onPress={handleSaveEdit}>
                          <Text style={styles.btnSmallText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnSmallCancel} onPress={() => setEditingTaskId(null)}>
                          <Text style={styles.btnSmallText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.taskDescText}>{task.tasksAssigned}</Text>
                  )}

                  {/* Status Toggles: Completed & Pending (Contradiction Free) */}
                  <View style={styles.statusToggleContainer}>
                    {/* Completed Toggle */}
                    <View style={styles.toggleGroup}>
                      <Text style={styles.toggleLabel}>Completed:</Text>
                      <View style={styles.binaryToggleRow}>
                        <TouchableOpacity
                          style={[styles.binaryBtn, isCompleted && styles.binaryBtnGreen]}
                          onPress={() => handleToggleTaskStatus(task.id, 'completed', 'Yes')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.binaryBtnText, isCompleted && styles.binaryBtnTextActive]}>
                            Yes
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.binaryBtn, !isCompleted && styles.binaryBtnMuted]}
                          onPress={() => handleToggleTaskStatus(task.id, 'completed', 'No')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.binaryBtnText, !isCompleted && styles.binaryBtnTextMuted]}>
                            No
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Pending Toggle */}
                    <View style={styles.toggleGroup}>
                      <Text style={styles.toggleLabel}>Pending:</Text>
                      <View style={styles.binaryToggleRow}>
                        <TouchableOpacity
                          style={[styles.binaryBtn, isPending && styles.binaryBtnAmber]}
                          onPress={() => handleToggleTaskStatus(task.id, 'pending', 'Yes')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.binaryBtnText, isPending && styles.binaryBtnTextActive]}>
                            Yes
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.binaryBtn, !isPending && styles.binaryBtnMuted]}
                          onPress={() => handleToggleTaskStatus(task.id, 'pending', 'No')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.binaryBtnText, !isPending && styles.binaryBtnTextMuted]}>
                            No
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Edit / Delete Row */}
                  {!isEditing && (
                    <View style={styles.taskCardFooter}>
                      <TouchableOpacity
                        style={styles.taskCardAction}
                        onPress={() => handleStartEdit(task)}
                      >
                        <Ionicons name="pencil" size={13} color={colors.textSecondary} />
                        <Text style={styles.taskCardActionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.taskCardAction}
                        onPress={() => handleDeleteTask(task.id)}
                      >
                        <Ionicons name="trash-outline" size={13} color="#C0392B" />
                        <Text style={[styles.taskCardActionText, { color: '#C0392B' }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* Add Another Task Form */}
          <View style={styles.addTaskCard}>
            <Text style={styles.addTaskHeading}>+ Add Another Task to Today</Text>

            {/* Quick Project Pills */}
            <Text style={styles.fieldLabel}>Project Name:</Text>
            <View style={styles.projectPillsRow}>
              {['Android Mobile App', 'EMS Web Dashboard', 'Backend API', 'Design Tokens'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.quickProjectPill, projectName === p && styles.quickProjectPillActive]}
                  onPress={() => setProjectName(p)}
                >
                  <Text style={[styles.quickProjectText, projectName === p && styles.quickProjectTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.inputProject}
              value={projectName}
              onChangeText={setProjectName}
              placeholder="Or type custom project name..."
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.fieldLabel}>Tasks Assigned / What you worked on:</Text>
            <TextInput
              style={styles.inputTaskDesc}
              multiline
              numberOfLines={3}
              value={taskDescription}
              onChangeText={setTaskDescription}
              placeholder="Describe the task in detail..."
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.initialStatusRow}>
              <Text style={styles.fieldLabel}>Initial Status:</Text>
              <View style={styles.binaryToggleRow}>
                <TouchableOpacity
                  style={[styles.binaryBtn, newCompleted && styles.binaryBtnGreen]}
                  onPress={() => setNewCompleted(true)}
                >
                  <Text style={[styles.binaryBtnText, newCompleted && styles.binaryBtnTextActive]}>
                    Completed
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.binaryBtn, !newCompleted && styles.binaryBtnAmber]}
                  onPress={() => setNewCompleted(false)}
                >
                  <Text style={[styles.binaryBtnText, !newCompleted && styles.binaryBtnTextActive]}>
                    Pending
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.btnAppendTask} onPress={handleAddTask} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.btnAppendTaskText}>Add Task to Sheet</Text>
            </TouchableOpacity>
          </View>

          {/* Save Draft & Submit Actions */}
          <View style={styles.sheetActionsRow}>
            {!isEditingTodayReport && (
              <TouchableOpacity
                style={styles.btnDraft}
                onPress={handleSaveDraft}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={18} color={colors.text} />
                <Text style={styles.btnDraftText}>Save Draft</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.btnSubmit}
              onPress={handleOpenSubmitModal}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#ffffff" />
                  <Text style={styles.btnSubmitText}>
                    {isEditingTodayReport ? "Update Submitted Report" : "Submit Daily Report"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.draftHelpText}>
            Note: "Save Draft" securely stores your progress on the server so you can resume editing later. "Submit Daily Report" locks and submits your report for management review.
          </Text>
        </View>
      )}

      {/* ========================================================================= */}
      {/* 3. EMPLOYEE RATINGS (OUT OF 10) */}
      {/* ========================================================================= */}
      <View style={styles.ratingsCard}>
        <View style={styles.ratingsHeaderRow}>
          <View>
            <Text style={styles.ratingsHeading}>Employee Performance Ratings</Text>
            <Text style={styles.ratingsSubheading}>6 core dimensions rated out of 10</Text>
          </View>
          <View style={styles.averageBox}>
            <View style={styles.averageScoreRow}>
              <Ionicons name="star" size={18} color={colors.primary} />
              <Text style={styles.averageScoreText}>{averageOverall}</Text>
            </View>
            <Text style={styles.averageLabel}>Average Overall</Text>
          </View>
        </View>

        <View style={styles.ratingsGrid}>
          {[
            { key: 'speed', label: '1. Speed', val: ratings.speed },
            { key: 'understanding', label: '2. Understanding', val: ratings.understanding },
            { key: 'problemSolving', label: '3. Problem Solving Approach', val: ratings.problemSolving },
            { key: 'talkingBehaviour', label: '4. Talking Behaviour', val: ratings.talkingBehaviour },
            { key: 'workQuality', label: '5. Work Quality', val: ratings.workQuality },
            { key: 'discipline', label: '6. Discipline', val: ratings.discipline }
          ].map(item => (
            <View key={item.key} style={styles.ratingRowItem}>
              <View style={styles.ratingInfoCol}>
                <Text style={styles.ratingFieldLabel}>{item.label}</Text>
                <Text style={styles.ratingFractionText}>{item.val} / 10</Text>
              </View>

              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleRatingChange(item.key, -1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={16} color="#ffffff" />
                </TouchableOpacity>

                <View style={styles.stepperDisplay}>
                  <Text style={styles.stepperDisplayText}>{item.val}</Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleRatingChange(item.key, 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 4. TEAM LEADER AUDIT SECTION (SEPARATE FROM RATINGS) */}
      {/* ========================================================================= */}
      <View style={styles.tlAuditCard}>
        <View style={styles.tlAuditHeader}>
          <View style={styles.tlAuditIconBadge}>
            <Ionicons name="shield-checkmark" size={20} color={colors.darkOlive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tlAuditHeading}>Team Leader Audit</Text>
            <Text style={styles.tlAuditSubheading}>Official manager verification & feedback</Text>
          </View>
          <View style={{ backgroundColor: isDark ? 'rgba(163, 184, 121, 0.15)' : colors.lightOlive, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.darkOlive }}>OFFICIAL AUDIT</Text>
          </View>
        </View>

        {/* Employee Read-Only Mode */}
        <View style={styles.tlReadOnlyContainer}>
          <View style={styles.tlScoreBadgeRow}>
            <View style={styles.tlScorePill}>
              <Text style={styles.tlScorePillNumber}>{tlAudit.auditScore}</Text>
              <Text style={styles.tlScorePillMax}>/ 10</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tlAuditorText}>{tlAudit.auditor}</Text>
              <Text style={styles.tlAuditTimeText}>{tlAudit.auditedAt}</Text>
            </View>
          </View>

          <View style={styles.tlRemarksBox}>
            <Text style={styles.tlRemarksLabel}>Manager Remarks & Guidance:</Text>
            <Text style={styles.tlRemarksText}>{tlAudit.remarks}</Text>
          </View>

          <View style={styles.tlSecurityNotice}>
            <Ionicons name="lock-closed" size={13} color={colors.primary} />
            <Text style={styles.tlSecurityText}>
              Team Leader Audit is managed by your manager from the dashboard. Employees cannot edit or impersonate audit ratings.
            </Text>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 5. PREVIOUS DAYS / TASK HISTORY SECTION (DESCENDING HISTORICAL REPORTS) */}
      {/* ========================================================================= */}
      <View style={styles.historySection}>
        <View style={styles.historySectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="time" size={18} color={colors.primary} />
            <Text style={styles.historySectionTitle}>Previous Days / Task History</Text>
          </View>
          <Text style={styles.historySectionSubtitle}>
            Past daily reports (Read-only historical archive)
          </Text>
        </View>

        {historicalReports.length === 0 ? (
          <View style={styles.emptyHistoryCard}>
            <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} />
            <Text style={styles.emptyHistoryText}>No previous days' reports recorded yet.</Text>
          </View>
        ) : (
          historicalReports.map((report) => (
            <TouchableOpacity
              key={report.id || report.work_date}
              style={styles.historyCard}
              onPress={() => handleOpenHistoricalReport(report)}
              activeOpacity={0.8}
            >
              <View style={styles.historyCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyDateText}>
                    {report.work_date} ({report.dayName || ''})
                  </Text>
                  <Text style={styles.historyTaskCountText}>
                    {report.totalTasks || report.tasks?.length || 0} tasks • {report.completedCount || 0} completed, {report.pendingCount || 0} pending
                  </Text>
                </View>

                <View style={styles.historyBadgeSubmitted}>
                  <Ionicons name="checkmark-done" size={12} color={colors.darkOlive} />
                  <Text style={styles.historyBadgeSubmittedText}>Submitted to TL</Text>
                </View>
              </View>

              <View style={styles.historyCardFooter}>
                {report.carriedForwardCount > 0 ? (
                  <View style={styles.historyCfTag}>
                    <Ionicons name="arrow-redo" size={11} color="#9A6B1F" />
                    <Text style={styles.historyCfTagText}>
                      {report.carriedForwardCount} carried forward
                    </Text>
                  </View>
                ) : <View />}

                <View style={styles.historyViewBtn}>
                  <Text style={styles.historyViewBtnText}>View Report</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Local session notice */}
      <View style={styles.footerNote}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.footerNoteText}>
          Standardized Excel structure active • Server persistence verified
        </Text>
      </View>

      {/* ========================================================================= */}
      {/* 6. SUBMISSION CONFIRMATION SUMMARY MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={showSubmitModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="send" size={20} color="#ffffff" />
              </View>
              <Text style={styles.modalTitle}>Confirm Report Submission</Text>
              <Text style={styles.modalSubtitle}>
                {currentDate} ({currentDay})
              </Text>
            </View>

            <View style={styles.summaryStatsBox}>
              <View style={styles.summaryStatItem}>
                <Text style={styles.summaryStatNumber}>{tasks.length}</Text>
                <Text style={styles.summaryStatLabel}>Total Tasks</Text>
              </View>
              <View style={[styles.summaryStatItem, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }]}>
                <Text style={[styles.summaryStatNumber, { color: '#27AE60' }]}>{completedCount}</Text>
                <Text style={styles.summaryStatLabel}>Completed</Text>
              </View>
              <View style={styles.summaryStatItem}>
                <Text style={[styles.summaryStatNumber, { color: '#C28424' }]}>{pendingCount}</Text>
                <Text style={styles.summaryStatLabel}>Pending</Text>
              </View>
            </View>

            {pendingCount > 0 && (
              <View style={styles.pendingCalloutBox}>
                <Ionicons name="information-circle" size={16} color="#C28424" />
                <Text style={styles.pendingCalloutText}>
                  {pendingCount} pending task(s) will automatically carry forward to tomorrow's task sheet.
                </Text>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setShowSubmitModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnModalCancelText}>Review / Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnModalConfirm}
                onPress={handleConfirmSubmitReport}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.btnModalConfirmText}>Confirm & Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. READ-ONLY HISTORICAL REPORT MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={showHistoricalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoricalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historicalModalContent}>
            {/* Warning Banner at Top */}
            <View style={styles.readOnlyWarningBanner}>
              <Ionicons name="lock-closed" size={16} color="#9A6B1F" />
              <Text style={styles.readOnlyWarningText}>
                Previous-day reports are read-only. You can edit tasks for today's date only.
              </Text>
            </View>

            {selectedHistoricalReport && (
              <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
                <View style={styles.histHeaderCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={styles.histDateHeading}>
                        {selectedHistoricalReport.work_date} ({selectedHistoricalReport.dayName || ''})
                      </Text>
                      <Text style={styles.histEmployeeSub}>
                        {employeeName} • {selectedHistoricalReport.totalTasks || selectedHistoricalReport.tasks?.length || 0} Tasks
                      </Text>
                    </View>
                    <View style={styles.badgeSubmittedTL}>
                      <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
                      <Text style={styles.badgeSubmittedTLText}>Submitted to TL</Text>
                    </View>
                  </View>
                </View>

                {/* Historical Tasks List */}
                <Text style={styles.histSectionTitle}>Tasks Recorded for This Day:</Text>
                {(selectedHistoricalReport.tasks || []).map((t, idx) => (
                  <View key={t.id || idx} style={styles.histTaskCard}>
                    <View style={styles.taskCardTop}>
                      <View style={styles.projectPill}>
                        <Ionicons name="folder-outline" size={11} color={colors.darkOlive} />
                        <Text style={styles.projectPillText}>{t.projectName}</Text>
                      </View>
                      <View style={[
                        styles.statusTag,
                        t.completed === 'Yes' ? styles.statusTagCompleted : styles.statusTagPending
                      ]}>
                        <Ionicons
                          name={t.completed === 'Yes' ? 'checkmark' : 'time-outline'}
                          size={11}
                          color={t.completed === 'Yes' ? '#27AE60' : '#C28424'}
                        />
                        <Text style={[
                          styles.statusTagText,
                          t.completed === 'Yes' ? styles.statusTagTextCompleted : styles.statusTagTextPending
                        ]}>
                          {t.completed === 'Yes' ? 'Completed' : 'Pending'}
                        </Text>
                      </View>
                    </View>

                    {t.isCarriedForward && (
                      <View style={styles.carriedForwardBadge}>
                        <Ionicons name="arrow-redo" size={11} color="#9A6B1F" />
                        <Text style={styles.carriedForwardBadgeText}>
                          Carried forward from {formatDateLabel(t.carriedForwardFromDate)}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.submittedTaskDesc}>{t.tasksAssigned}</Text>
                  </View>
                ))}

                {/* Ratings Breakdown */}
                {selectedHistoricalReport.ratings && (
                  <View style={styles.histRatingsBox}>
                    <Text style={styles.histRatingsTitle}>Performance Ratings:</Text>
                    <View style={styles.histRatingsGrid}>
                      <Text style={styles.histRatingItem}>Speed: {selectedHistoricalReport.ratings.speed || 'N/A'}/10</Text>
                      <Text style={styles.histRatingItem}>Understanding: {selectedHistoricalReport.ratings.understanding || 'N/A'}/10</Text>
                      <Text style={styles.histRatingItem}>Problem Solving: {selectedHistoricalReport.ratings.problemSolving || 'N/A'}/10</Text>
                      <Text style={styles.histRatingItem}>Behaviour: {selectedHistoricalReport.ratings.talkingBehaviour || 'N/A'}/10</Text>
                      <Text style={styles.histRatingItem}>Quality: {selectedHistoricalReport.ratings.workQuality || 'N/A'}/10</Text>
                      <Text style={styles.histRatingItem}>Discipline: {selectedHistoricalReport.ratings.discipline || 'N/A'}/10</Text>
                    </View>
                    <Text style={styles.histRatingAverage}>
                      Average Overall: ★ {selectedHistoricalReport.averageOverall || '9.0'} / 10
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.btnCloseHistoricalModal}
              onPress={() => setShowHistoricalModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnCloseHistoricalModalText}>Close Historical Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 18,
    paddingBottom: 110
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.lightOlive,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16
  },
  feedbackText: {
    fontSize: 12,
    color: colors.darkOlive,
    fontWeight: '700',
    flex: 1
  },
  header: {
    marginBottom: 16
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff'
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  summaryCol: {
    flex: 1
  },
  summaryColRight: {
    alignItems: 'flex-end'
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  badgeWorkingDays: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  workingDaysText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.darkOlive
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12
  },
  monthSelectorRow: {
    flexDirection: 'row',
    gap: 6
  },
  monthPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  monthPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary
  },
  monthPillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusPillSubmitted: {
    backgroundColor: colors.lightOlive
  },
  statusPillDraft: {
    backgroundColor: '#FAF4E8'
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statusPillTextSubmitted: {
    color: colors.darkOlive
  },
  statusPillTextDraft: {
    color: '#C28424'
  },

  /* Submitted Today Card Styles */
  submittedReportCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  submittedReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  submittedReportTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  submittedReportSubtitle: {
    fontSize: 11,
    color: colors.textSecondary
  },
  badgeSubmittedTL: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeSubmittedTLText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff'
  },
  statPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  statPillItem: {
    flex: 1,
    backgroundColor: colors.beige,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  statPillGreen: {
    backgroundColor: isDark ? 'rgba(39, 174, 96, 0.12)' : '#EAF7EE',
    borderColor: '#27AE60'
  },
  statPillAmber: {
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.12)' : '#FAF4E8',
    borderColor: '#C28424'
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2
  },
  statPillVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  submittedTasksList: {
    gap: 8,
    marginBottom: 14
  },
  submittedTaskItem: {
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  submittedTaskDesc: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginTop: 6
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusTagCompleted: {
    backgroundColor: isDark ? 'rgba(39, 174, 96, 0.15)' : '#EAF7EE'
  },
  statusTagPending: {
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.15)' : '#FAF4E8'
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700'
  },
  statusTagTextCompleted: {
    color: '#27AE60'
  },
  statusTagTextPending: {
    color: '#C28424'
  },
  submittedActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  btnEditToday: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10
  },
  btnEditTodayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },
  btnAddExtraTask: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10
  },
  btnAddExtraTaskText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  sameDayHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8
  },

  /* Active Draft & Editing Banner */
  editingModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14
  },
  editingModeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },
  editingModeSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2
  },
  btnCancelEdit: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnCancelEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff'
  },

  /* Active Draft Sheet Styles */
  section: {
    marginBottom: 20
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  sectionSubheading: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  boldWhite: {
    fontWeight: '700',
    color: colors.text
  },
  taskCountBadge: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  taskCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkOlive
  },
  emptyTaskCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14
  },
  emptyTaskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8
  },
  emptyTaskSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  taskCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  projectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  projectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkOlive
  },
  taskIndexText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700'
  },
  carriedForwardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.15)' : '#FAF4E8',
    borderWidth: 1,
    borderColor: '#C28424',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start'
  },
  carriedForwardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A6B1F'
  },
  taskDescText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 12
  },
  statusToggleContainer: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8
  },
  toggleGroup: {
    flex: 1
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6
  },
  binaryToggleRow: {
    flexDirection: 'row',
    gap: 6
  },
  binaryBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  binaryBtnGreen: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  binaryBtnAmber: {
    backgroundColor: '#C28424',
    borderColor: '#C28424'
  },
  binaryBtnMuted: {
    backgroundColor: colors.beige,
    borderColor: colors.border
  },
  binaryBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary
  },
  binaryBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800'
  },
  binaryBtnTextMuted: {
    color: colors.textSecondary,
    fontWeight: '600'
  },
  taskCardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4
  },
  taskCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  taskCardActionText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  editBox: {
    marginBottom: 10,
    gap: 6
  },
  editInput: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    padding: 8,
    fontSize: 12
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4
  },
  btnSmallSave: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnSmallCancel: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnSmallText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  addTaskCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  addTaskHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    marginTop: 4
  },
  projectPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8
  },
  quickProjectPill: {
    backgroundColor: colors.beige,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border
  },
  quickProjectPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  quickProjectText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  quickProjectTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  inputProject: {
    backgroundColor: colors.beige,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: 10,
    fontSize: 12,
    marginBottom: 8
  },
  inputTaskDesc: {
    backgroundColor: colors.beige,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: 10,
    fontSize: 12,
    textAlignVertical: 'top',
    marginBottom: 8
  },
  initialStatusRow: {
    marginBottom: 12
  },
  btnAppendTask: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10
  },
  btnAppendTaskText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  btnDraft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 12
  },
  btnDraftText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  btnSubmit: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12
  },
  btnSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  draftHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginTop: 8,
    textAlign: 'center'
  },

  /* Ratings Section Styles */
  ratingsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  ratingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  ratingsHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  ratingsSubheading: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  averageBox: {
    backgroundColor: colors.lightOlive,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  averageScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  averageScoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.darkOlive
  },
  averageLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 1
  },
  ratingsGrid: {
    gap: 10
  },
  ratingRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  ratingInfoCol: {
    flex: 1
  },
  ratingFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  ratingFractionText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperDisplay: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperDisplayText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },

  /* Team Leader Audit Styles */
  tlAuditCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2
  },
  tlAuditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14
  },
  tlAuditIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.lightOlive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tlAuditHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  tlAuditSubheading: {
    fontSize: 11,
    color: colors.textSecondary
  },
  tlReadOnlyContainer: {
    gap: 12
  },
  tlScoreBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  tlScorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  tlScorePillNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff'
  },
  tlScorePillMax: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 2
  },
  tlAuditorText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text
  },
  tlAuditTimeText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2
  },
  tlRemarksBox: {
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  tlRemarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4
  },
  tlRemarksText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 18
  },
  tlSecurityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightOlive,
    borderRadius: 8,
    padding: 8
  },
  tlSecurityText: {
    fontSize: 10,
    color: colors.darkOlive,
    fontWeight: '600',
    flex: 1,
    lineHeight: 14
  },

  /* Previous Days / Task History Section Styles */
  historySection: {
    marginBottom: 20
  },
  historySectionHeader: {
    marginBottom: 12
  },
  historySectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text
  },
  historySectionSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  emptyHistoryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border
  },
  emptyHistoryText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  historyDateText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  historyTaskCountText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  historyBadgeSubmitted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  historyBadgeSubmittedText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.darkOlive
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4
  },
  historyCfTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.12)' : '#FAF4E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  historyCfTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9A6B1F'
  },
  historyViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  historyViewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary
  },

  /* Footer Note */
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.textSecondary
  },

  /* Modal Common Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 18
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  summaryStatsBox: {
    flexDirection: 'row',
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  summaryStatItem: {
    flex: 1,
    alignItems: 'center'
  },
  summaryStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text
  },
  summaryStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: 2
  },
  pendingCalloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.15)' : '#FAF4E8',
    borderWidth: 1,
    borderColor: '#C28424',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16
  },
  pendingCalloutText: {
    fontSize: 11,
    color: '#9A6B1F',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10
  },
  btnModalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center'
  },
  btnModalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  btnModalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center'
  },
  btnModalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  },

  /* Historical Read-Only Modal Styles */
  historicalModalContent: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8
  },
  readOnlyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(194, 132, 36, 0.15)' : '#FAF4E8',
    borderWidth: 1,
    borderColor: '#C28424',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  readOnlyWarningText: {
    fontSize: 11,
    color: '#9A6B1F',
    fontWeight: '700',
    flex: 1,
    lineHeight: 15
  },
  histHeaderCard: {
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  histDateHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text
  },
  histEmployeeSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  histSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  histTaskCard: {
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8
  },
  histRatingsBox: {
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    marginBottom: 10
  },
  histRatingsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8
  },
  histRatingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  histRatingItem: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    width: '48%'
  },
  histRatingAverage: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.darkOlive,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6
  },
  btnCloseHistoricalModal: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12
  },
  btnCloseHistoricalModalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  }
});
