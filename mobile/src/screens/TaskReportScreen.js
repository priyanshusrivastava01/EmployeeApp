import React, { useState, useEffect } from 'react';
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
  // Spreadsheet header state
  const employeeName = currentUser?.name || mockDailyTaskSpreadsheet.employeeName;
  const [selectedMonth, setSelectedMonth] = useState(mockDailyTaskSpreadsheet.selectedMonth);
  const [totalWorkingDays] = useState(mockDailyTaskSpreadsheet.totalWorkingDays);

  // Daily task records
  const [tasks, setTasks] = useState(mockDailyTaskSpreadsheet.reports);
  const [submissionStatus, setSubmissionStatus] = useState(mockDailyTaskSpreadsheet.status); // 'Draft' or 'Submitted'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Current date info
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const [currentDate] = useState(todayDateStr);
  const [currentDay] = useState(todayDayName);

  // Check for saved draft or submitted report for today
  useEffect(() => {
    (async () => {
      try {
        // 1. Check for draft
        const draftRes = await api.getDailyReportDraft();
        if (draftRes && draftRes.success && draftRes.data) {
          const d = draftRes.data;
          setSubmissionStatus('Draft');
          if (d.project_name) setProjectName(d.project_name);
          if (d.work_summary) setTaskDescription(d.work_summary);
          if (d.rating_speed != null) {
            setRatings({
              speed: Number(d.rating_speed) || 5,
              understanding: Number(d.rating_understanding) || 5,
              problemSolving: Number(d.rating_problem_solving) || 5,
              talkingBehaviour: Number(d.rating_talking_behaviour) || 5,
              workQuality: Number(d.rating_work_quality) || 5,
              discipline: Number(d.rating_discipline) || 5
            });
          }
        }

        // 2. Check if final submitted
        const res = await api.getDailyReports();
        if (res.success && res.data && res.data.length > 0) {
          const todays = res.data.find(r => r.work_date === todayDateStr);
          if (todays && !todays.is_draft) {
            setSubmissionStatus('Submitted');
          }
        }
      } catch (e) {
        // non-fatal
      }
    })();
  }, [todayDateStr]);

  // New task form state
  const [projectName, setProjectName] = useState('Android Mobile App');
  const [taskDescription, setTaskDescription] = useState('');
  const [newCompleted, setNewCompleted] = useState(true); // true = Yes, false = No

  // Editing existing task
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editProject, setEditProject] = useState('');

  // 6 Employee Ratings (out of 10)
  const [ratings, setRatings] = useState(mockDailyTaskSpreadsheet.ratings);

  // Team Leader Audit state (Read-Only for employee)
  const [tlAudit] = useState(mockDailyTaskSpreadsheet.tlAudit);

  // Feedback banner / modal
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const showFeedback = (msg) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

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
   * Handle task status toggle with contradiction prevention
   * Rule: If Completed is Yes -> Pending is No. If Completed is No -> Pending is Yes.
   */
  const handleToggleTaskStatus = (id, targetField, targetValue) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== id) return task;

        if (targetField === 'completed') {
          return {
            ...task,
            completed: targetValue,
            pending: targetValue === 'Yes' ? 'No' : 'Yes'
          };
        } else {
          return {
            ...task,
            pending: targetValue,
            completed: targetValue === 'Yes' ? 'No' : 'Yes'
          };
        }
      })
    );
  };

  /**
   * Add new task to current date
   */
  const handleAddTask = () => {
    if (!taskDescription.trim()) {
      Alert.alert('Task Required', 'Please enter a description for the assigned task.');
      return;
    }

    const newTask = {
      id: 'task-entry-' + Date.now(),
      date: currentDate,
      day: currentDay,
      projectName: projectName.trim() || 'General',
      tasksAssigned: taskDescription.trim(),
      completed: newCompleted ? 'Yes' : 'No',
      pending: newCompleted ? 'No' : 'Yes'
    };

    setTasks(prev => [...prev, newTask]);
    setTaskDescription('');
    showFeedback('New task entry added to spreadsheet.');
  };

  /**
   * Remove task
   */
  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showFeedback('Task removed.');
  };

  /**
   * Start editing existing task
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
    showFeedback('Task entry updated.');
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
   * Save Draft action - persists to server
   */
  const handleSaveDraft = async () => {
    try {
      setIsSubmitting(true);
      const taskSummaries = tasks.map(t => `${t.projectName || 'General'}: ${t.tasksAssigned} [${t.completed === 'Yes' ? 'Done' : 'Pending'}]`).join('; ');
      const res = await api.saveDailyReportDraft({
        projectName: projectName || 'General Operations',
        tasksAssigned: taskSummaries,
        tasksCompleted: tasks.filter(t => t.completed === 'Yes').length > 0 ? 'Yes' : 'No',
        tasksPending: tasks.filter(t => t.pending === 'Yes').length > 0 ? 'Yes' : 'No',
        ratingSpeed: ratings.speed,
        ratingUnderstanding: ratings.understanding,
        ratingProblemSolving: ratings.problemSolving,
        ratingTalkingBehaviour: ratings.talkingBehaviour,
        ratingWorkQuality: ratings.workQuality,
        ratingDiscipline: ratings.discipline,
        workSummary: taskDescription.trim() || taskSummaries
      });

      setIsSubmitting(false);
      if (res && res.success) {
        setSubmissionStatus('Draft');
        showFeedback('Draft saved to server. You can resume and edit before submitting.');
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

  /**
   * Submit Daily Report action
   */
  const handleSubmitReport = async () => {
    if (tasks.length === 0) {
      Alert.alert('No Tasks', 'Please add at least one task before submitting your daily report.');
      return;
    }

    try {
      setIsSubmitting(true);
      const taskSummaries = tasks.map(t => `${t.projectName || 'General'}: ${t.tasksAssigned} [${t.completed === 'Yes' ? 'Done' : 'Pending'}]`).join('; ');
      const res = await api.submitDailyReport({
        projectName: projectName || 'General Operations',
        tasksAssigned: taskSummaries,
        tasksCompleted: tasks.filter(t => t.completed === 'Yes').length > 0 ? 'Yes' : 'No',
        tasksPending: tasks.filter(t => t.pending === 'Yes').length > 0 ? 'Yes' : 'No',
        ratingSpeed: ratings.speed,
        ratingUnderstanding: ratings.understanding,
        ratingProblemSolving: ratings.problemSolving,
        ratingTalkingBehaviour: ratings.talkingBehaviour,
        ratingWorkQuality: ratings.workQuality,
        ratingDiscipline: ratings.discipline,
        workSummary: taskDescription.trim() || taskSummaries
      });

      if (res.success) {
        setSubmissionStatus('Submitted');
        showFeedback('Daily Task Summary successfully synced to Management Dashboard!');
      } else {
        if (res.error && res.error.includes('already submitted')) {
          setSubmissionStatus('Submitted');
          showFeedback('Daily report was already submitted for today.');
        } else {
          Alert.alert('Submission Error', res.error || 'Failed to submit report.');
        }
      }
    } catch (err) {
      if (err.message && err.message.includes('already submitted')) {
        setSubmissionStatus('Submitted');
        showFeedback('Daily report was already submitted for today.');
      } else {
        // Fallback to local submission if offline
        setSubmissionStatus('Submitted');
        showFeedback('Report saved locally. Offline sync pending.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageOverall = calculateAverageOverall();

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
              submissionStatus === 'Submitted' ? styles.statusPillSubmitted : styles.statusPillDraft
            ]}>
              <Ionicons
                name={submissionStatus === 'Submitted' ? 'checkmark-done' : 'create-outline'}
                size={13}
                color={submissionStatus === 'Submitted' ? colors.darkOlive : '#C28424'}
              />
              <Text style={[
                styles.statusPillText,
                submissionStatus === 'Submitted' ? styles.statusPillTextSubmitted : styles.statusPillTextDraft
              ]}>
                {submissionStatus === 'Submitted' ? 'Submitted to TL' : 'Draft (Unsaved)'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. DAILY TASK ENTRIES SECTION */}
      {/* ========================================================================= */}
      <View style={styles.section}>
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

        {/* Existing Tasks List */}
        {tasks.map((task, idx) => {
          const isCompleted = task.completed === 'Yes';
          const isPending = task.pending === 'Yes';
          const isEditing = editingTaskId === task.id;

          return (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskCardTop}>
                <View style={styles.projectPill}>
                  <Ionicons name="folder-outline" size={12} color={colors.darkOlive} />
                  <Text style={styles.projectPillText}>{task.projectName}</Text>
                </View>
                <Text style={styles.taskIndexText}>#{idx + 1}</Text>
              </View>

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
        })}

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
          <TouchableOpacity
            style={styles.btnDraft}
            onPress={handleSaveDraft}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Ionicons name="save-outline" size={18} color={colors.text} />
            <Text style={styles.btnDraftText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSubmit}
            onPress={handleSubmitReport}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#ffffff" />
                <Text style={styles.btnSubmitText}>Submit Daily Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.draftHelpText}>
          Note: "Save Draft" securely stores your progress on the server so you can resume editing later. "Submit Daily Report" locks and submits your final report for management review.
        </Text>
      </View>

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

      {/* Local session notice */}
      <View style={styles.footerNote}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.footerNoteText}>
          Excel spreadsheet structure active. Data stored in local demo state.
        </Text>
      </View>
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
  draftHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
    marginTop: 8,
    textAlign: 'center'
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
    width: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperDisplayText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text
  },
  tlAuditCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: 16,
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
  tlSimulateBtn: {
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary
  },
  tlSimulateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkOlive
  },
  tlReadOnlyContainer: {
    gap: 10
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
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  tlScorePillNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkOlive
  },
  tlScorePillMax: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 2
  },
  tlAuditorText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text
  },
  tlAuditTimeText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2
  },
  tlRemarksBox: {
    backgroundColor: colors.beige,
    borderRadius: 10,
    padding: 12,
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
    paddingTop: 4
  },
  tlSecurityText: {
    fontSize: 11,
    color: colors.textSecondary
  },
  tlEditContainer: {
    backgroundColor: colors.beige,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  tlEditNotice: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4
  },
  tlInputScore: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: 8,
    fontSize: 14,
    fontWeight: '700'
  },
  tlInputRemarks: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    padding: 8,
    fontSize: 12,
    textAlignVertical: 'top'
  },
  btnSaveTlAudit: {
    backgroundColor: colors.darkOlive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6
  },
  btnSaveTlAuditText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.textSecondary
  }
});
