import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

/**
 * AdminReportsScreen — Management Task Reports & Employee-Wise Excel System
 * 
 * Workflow:
 *  1. Management opens Task Reports -> Sees list of employees belonging to its organization.
 *  2. Search & Filter: Search by name, employee ID, department, designation; Filter by status, department, and sort order.
 *  3. Management selects an employee -> Selected employee's task report history opens (newest date first).
 *  4. Employee Header displays summary metrics (total reports, latest date, completed/pending tasks).
 *  5. Two clearly distinguishable actions on the selected employee's screen:
 *     - [Download Excel]: Generates & downloads employee-specific Excel workbook (.xlsx / .csv).
 *     - [View Spreadsheet]: Opens in-app horizontally scrollable spreadsheet viewer for this employee.
 *  6. Historical dates are strictly read-only with 6-factor performance ratings breakdown.
 *  7. Current day's report shows completed/pending tasks and [+ Add Task] assignment workflow.
 *  8. In-app notification dispatched to the assigned employee.
 *  9. Real-time bidirectional status synchronization between Employee and Management.
 */
export default function AdminReportsScreen({ onBack, user, organization }) {
  const { colors, isDark } = useTheme();
  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    insets = useSafeAreaInsets();
  } catch (e) {}

  const styles = getStyles(colors, isDark, insets);

  // Screen View Mode: 'employees' | 'employee_profile' | 'date_detail'
  const [viewMode, setViewMode] = useState('employees');

  // Selected State
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedReportDate, setSelectedReportDate] = useState(null);
  const [employeeProfileData, setEmployeeProfileData] = useState(null);

  // Employee List, Search, Filter & Sort states
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'submitted' | 'not_submitted' | 'pending_tasks'
  const [deptFilter, setDeptFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest_first'); // 'name_asc' | 'latest_first' | 'pending_first'
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Today ISO Date string (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Pulse & Filter calculations
  const counts = useMemo(() => {
    let submitted = 0;
    let pending = 0;
    let notSubmitted = 0;
    (employees || []).forEach((e) => {
      const isSub = e.todayReportStatus?.toLowerCase() === 'submitted';
      if (isSub) submitted++;
      else notSubmitted++;
      if ((e.todayPendingTasks || 0) > 0) pending++;
    });
    return {
      total: (employees || []).length,
      submitted,
      pending,
      notSubmitted
    };
  }, [employees]);

  const isFilterActive = deptFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'latest_first';
  const activeFilterCount =
    (deptFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'latest_first' ? 1 : 0);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setDeptFilter('all');
    setStatusFilter('all');
    setSortBy('latest_first');
  };

  // Modal 1: Add Task Modal (Assign task to currently selected employee)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignProject, setAssignProject] = useState('Android Mobile App');
  const [assignTaskTitle, setAssignTaskTitle] = useState('');
  const [assignTaskDesc, setAssignTaskDesc] = useState('');
  const [assignPriority, setAssignPriority] = useState('Medium'); // 'Low' | 'Medium' | 'High' | 'Urgent'
  const [assignDueTime, setAssignDueTime] = useState('EOD (18:30)');
  const [isAssigning, setIsAssigning] = useState(false);

  // Modal 2: View Spreadsheet (In-App Spreadsheet Viewer for selected employee)
  const [isViewSpreadsheetOpen, setIsViewSpreadsheetOpen] = useState(false);
  const [spreadsheetStartDate, setSpreadsheetStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [spreadsheetEndDate, setSpreadsheetEndDate] = useState(todayStr);
  const [spreadsheetData, setSpreadsheetData] = useState(null);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);

  // Modal 3: Download Excel (Date range export for selected employee)
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadStartDate, setDownloadStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [downloadEndDate, setDownloadEndDate] = useState(todayStr);
  const [isDownloading, setIsDownloading] = useState(false);

  // ---------------------------------------------------------------------------
  // DATA LOADING & LIVE SUBSCRIPTION
  // ---------------------------------------------------------------------------

  const loadEmployeeSummaries = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await api.getEmployeesWithDailyReports({
        organizationId: organization?.id || user?.organization_id || 'org-acme-1',
        date: todayStr
      });
      if (res && res.success && Array.isArray(res.data)) {
        setEmployees(res.data);
      } else {
        setFetchError(res?.error || 'Failed to load employees.');
      }
    } catch (e) {
      console.warn('[AdminReports] Fetch employees error:', e);
      setFetchError(e.message || 'Network error fetching employee summaries.');
    } finally {
      setIsLoading(false);
    }
  }, [organization, user, todayStr]);

  const loadEmployeeProfile = useCallback(
    async (empId) => {
      if (!empId) return;
      try {
        const res = await api.getEmployeeReportProfile(empId);
        if (res && res.success && res.data) {
          setEmployeeProfileData(res.data);
        }
      } catch (e) {
        console.warn('[AdminReports] Fetch employee profile error:', e);
      }
    },
    []
  );

  useEffect(() => {
    loadEmployeeSummaries();

    // Subscribe to real-time store updates
    const store = api.getStore();
    if (store && store.subscribe) {
      const unsub = store.subscribe(() => {
        loadEmployeeSummaries();
        if (selectedEmployee?.id) {
          loadEmployeeProfile(selectedEmployee.id);
        }
      });
      return () => unsub();
    }
  }, [loadEmployeeSummaries, loadEmployeeProfile, selectedEmployee]);

  // ---------------------------------------------------------------------------
  // FILTERING, SEARCHING & SORTING
  // ---------------------------------------------------------------------------

  const departments = useMemo(() => {
    const set = new Set(['Engineering', 'Operations', 'Management', 'Sales', 'Design']);
    (employees || []).forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return ['all', ...Array.from(set)];
  }, [employees]);

  const filteredAndSortedEmployees = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const selectedDeptNorm = (deptFilter || 'all').trim().toLowerCase();

    const filtered = (employees || []).filter((emp) => {
      // 1. Department Filter
      if (selectedDeptNorm !== 'all') {
        const empDept = (emp.department || '').trim().toLowerCase();
        if (empDept !== selectedDeptNorm) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'submitted') {
        if (emp.todayReportStatus?.toLowerCase() !== 'submitted') return false;
      } else if (statusFilter === 'not_submitted') {
        if (emp.todayReportStatus?.toLowerCase() === 'submitted') return false;
      } else if (statusFilter === 'pending_tasks') {
        if ((emp.todayPendingTasks || 0) <= 0) return false;
      }

      // 3. Search Filter (name, ID, email, department, designation)
      if (q) {
        const name = (emp.name || '').toLowerCase();
        const code = (emp.employee_code || '').toLowerCase();
        const email = (emp.email || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const desig = (emp.designation || '').toLowerCase();

        return (
          name.includes(q) ||
          code.includes(q) ||
          email.includes(q) ||
          dept.includes(q) ||
          desig.includes(q)
        );
      }

      return true;
    });

    // 4. Sorting
    return filtered.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'pending_first') {
        return (b.todayPendingTasks || 0) - (a.todayPendingTasks || 0);
      }
      // Default: latest_first (employees with today's submission / activity first)
      const aSubmitted = a.todayReportStatus === 'Submitted' ? 1 : 0;
      const bSubmitted = b.todayReportStatus === 'Submitted' ? 1 : 0;
      if (bSubmitted !== aSubmitted) return bSubmitted - aSubmitted;
      return (b.todayTotalTasks || 0) - (a.todayTotalTasks || 0);
    });
  }, [employees, searchQuery, statusFilter, deptFilter, sortBy]);

  // ---------------------------------------------------------------------------
  // NAVIGATION HANDLERS
  // ---------------------------------------------------------------------------

  const handleOpenEmployeeProfile = (emp) => {
    setSelectedEmployee(emp);
    loadEmployeeProfile(emp.id);
    setViewMode('employee_profile');
  };

  const handleOpenDateDetail = (dateStr) => {
    setSelectedReportDate(dateStr);
    setViewMode('date_detail');
  };

  // ---------------------------------------------------------------------------
  // TASK ASSIGNMENT WORKFLOW
  // ---------------------------------------------------------------------------

  const handleOpenAssignModal = () => {
    setAssignProject('Android Mobile App');
    setAssignTaskTitle('');
    setAssignTaskDesc('');
    setAssignPriority('Medium');
    setAssignDueTime('EOD (18:30)');
    setIsAssignModalOpen(true);
  };

  const handleSubmitTaskAssignment = async () => {
    if (!assignProject.trim()) {
      Alert.alert('Required', 'Please select or enter a Project Name.');
      return;
    }
    if (!assignTaskDesc.trim()) {
      Alert.alert('Required', 'Please enter a clear Task Description.');
      return;
    }
    if (!selectedEmployee) return;

    try {
      setIsAssigning(true);
      const res = await api.assignTaskToEmployee({
        employeeId: selectedEmployee.id,
        projectName: assignProject.trim(),
        taskTitle: assignTaskTitle.trim() || assignProject.trim(),
        taskDescription: assignTaskDesc.trim(),
        priority: assignPriority,
        dueTime: assignDueTime
      });

      if (res && res.success) {
        setIsAssignModalOpen(false);
        Alert.alert(
          'Task Assigned Successfully',
          `New task in "${assignProject}" assigned to ${selectedEmployee.name}. An in-app notification has been dispatched to the employee.`
        );
        loadEmployeeProfile(selectedEmployee.id);
        loadEmployeeSummaries();
      } else {
        Alert.alert('Assignment Failed', res?.error || 'Unable to assign task.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to assign task.');
    } finally {
      setIsAssigning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TASK STATUS TOGGLE (Management View)
  // ---------------------------------------------------------------------------

  const handleToggleTaskStatus = async (taskId, currentCompleted, currentPending) => {
    try {
      const nextCompleted = currentCompleted === 'Yes' ? 'No' : 'Yes';
      const nextPending = nextCompleted === 'Yes' ? 'No' : 'Yes';

      const res = await api.updateTaskStatus({
        taskId,
        completed: nextCompleted,
        pending: nextPending
      });

      if (res && res.success) {
        if (selectedEmployee?.id) {
          loadEmployeeProfile(selectedEmployee.id);
        }
      } else {
        Alert.alert('Notice', res?.error || 'Could not update task status.');
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // ---------------------------------------------------------------------------
  // SPREADSHEET VIEWER WORKFLOW (EMPLOYEE SPECIFIC)
  // ---------------------------------------------------------------------------

  const handleLoadSpreadsheetData = async () => {
    if (!selectedEmployee) return;
    try {
      setIsLoadingSpreadsheet(true);
      const res = await api.getEmployeeSpreadsheetData({
        employeeId: selectedEmployee.id,
        startDate: spreadsheetStartDate,
        endDate: spreadsheetEndDate
      });

      if (res && res.success) {
        setSpreadsheetData(res.data);
      } else {
        Alert.alert('Viewer Error', res?.error || 'Failed to load spreadsheet data.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  };

  const handleOpenSpreadsheetViewer = () => {
    setIsViewSpreadsheetOpen(true);
    handleLoadSpreadsheetData();
  };

  // ---------------------------------------------------------------------------
  // EXCEL DOWNLOAD WORKFLOW (EMPLOYEE SPECIFIC)
  // ---------------------------------------------------------------------------

  const handleOpenDownloadModal = () => {
    setIsDownloadModalOpen(true);
  };

  const handleDownloadExcel = async () => {
    if (!selectedEmployee) return;

    if (!downloadStartDate || !downloadEndDate) {
      Alert.alert('Invalid Range', 'Both Start Date and End Date are required.');
      return;
    }
    if (downloadStartDate > downloadEndDate) {
      Alert.alert('Invalid Range', 'Start Date cannot be later than End Date.');
      return;
    }

    try {
      setIsDownloading(true);
      const res = await api.downloadEmployeeTaskReportsExcel({
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        startDate: downloadStartDate,
        endDate: downloadEndDate
      });

      if (res && res.success) {
        setIsDownloadModalOpen(false);
        Alert.alert(
          'Excel Export Ready',
          `Task reports for ${selectedEmployee.name} (${downloadStartDate} to ${downloadEndDate}) exported successfully.\n\nFilename: ${res.filename}`
        );
      } else {
        Alert.alert('Download Error', res?.error || 'Could not download Excel workbook.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 1 — EMPLOYEE-WISE LIST (MAIN SCREEN)
  // ---------------------------------------------------------------------------

  const renderEmployeesView = () => {
    return (
      <View style={styles.contentWrap}>
        {/* Pulse Quick Stats Banner (Compact & Executive) */}
        <View style={styles.pulseContainer}>
          <View style={styles.pulseCard}>
            <Ionicons name="people" size={13} color={colors.primary} />
            <Text style={styles.pulseText}>
              <Text style={styles.pulseBold}>{counts.total}</Text> Staff
            </Text>
          </View>
          <View style={[styles.pulseCard, { backgroundColor: isDark ? '#1a2e1d' : '#ecfdf5' }]}>
            <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
            <Text style={[styles.pulseText, { color: isDark ? '#4ade80' : '#15803d' }]}>
              <Text style={styles.pulseBold}>{counts.submitted}</Text> Submitted
            </Text>
          </View>
          <View style={[styles.pulseCard, { backgroundColor: isDark ? '#2e2413' : '#fffbeb' }]}>
            <Ionicons name="time" size={13} color="#d97706" />
            <Text style={[styles.pulseText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
              <Text style={styles.pulseBold}>{counts.pending}</Text> Pending
            </Text>
          </View>
        </View>

        {/* Clean Unified Search & Filter Control Bar */}
        <View style={styles.topControlSection}>
          {/* Row 1: Search Input + Filter & Sort Button */}
          <View style={styles.unifiedActionRow}>
            <View style={styles.unifiedSearchBox}>
              <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.unifiedSearchInput}
                placeholder="Search name, ID, role, department..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {Boolean(searchQuery) && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.filterModalTrigger, isFilterActive && styles.filterModalTriggerActive]}
              onPress={() => setIsFilterModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="options-outline"
                size={16}
                color={isFilterActive ? '#ffffff' : colors.primary}
              />
              <Text style={[styles.filterTriggerText, isFilterActive && styles.filterTriggerTextActive]}>
                {isFilterActive ? `Filters (${activeFilterCount})` : 'Filters'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Clean Status Segmented Pills (Single Row) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusTabRow}
          >
            {[
              { id: 'all', label: 'All', count: counts.total },
              { id: 'submitted', label: 'Submitted', count: counts.submitted },
              { id: 'pending_tasks', label: 'Pending Tasks', count: counts.pending },
              { id: 'not_submitted', label: 'Not Submitted', count: counts.notSubmitted }
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.statusTabChip, isActive && styles.statusTabChipActive]}
                  onPress={() => setStatusFilter(tab.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.statusTabLabel, isActive && styles.statusTabLabelActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.statusTabCountBadge, isActive && styles.statusTabCountBadgeActive]}>
                    <Text style={[styles.statusTabCountText, isActive && styles.statusTabCountTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Row 3 (Conditional): Active Filter Tags with Quick Clear */}
          {(deptFilter !== 'all' || sortBy !== 'latest_first' || Boolean(searchQuery)) && (
            <View style={styles.activeFiltersRow}>
              <Text style={styles.activeFilterPrefix}>Filters:</Text>
              {deptFilter !== 'all' && (
                <TouchableOpacity style={styles.activeTag} onPress={() => setDeptFilter('all')}>
                  <Text style={styles.activeTagText}>Team: {deptFilter}</Text>
                  <Ionicons name="close" size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
              {sortBy !== 'latest_first' && (
                <TouchableOpacity style={styles.activeTag} onPress={() => setSortBy('latest_first')}>
                  <Text style={styles.activeTagText}>
                    Sort: {sortBy === 'name_asc' ? 'A-Z' : 'Pending First'}
                  </Text>
                  <Ionicons name="close" size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleResetAllFilters} style={styles.clearAllBtn}>
                <Text style={styles.clearAllLink}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Showing count text */}
          <View style={styles.countTextRow}>
            <Text style={styles.countText}>
              Showing {filteredAndSortedEmployees.length} of {employees.length} employees
            </Text>
            {sortBy !== 'latest_first' && (
              <Text style={styles.sortHintText}>
                Sorted: {sortBy === 'name_asc' ? 'Name (A-Z)' : 'Pending First'}
              </Text>
            )}
          </View>
        </View>

        {/* Employee Cards List */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading employee task summaries...</Text>
          </View>
        ) : fetchError ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={styles.emptyTitle}>Error Loading Reports</Text>
            <Text style={styles.emptySubtitle}>{fetchError}</Text>
            <TouchableOpacity style={styles.resetFilterBtn} onPress={loadEmployeeSummaries}>
              <Text style={styles.resetFilterBtnText}>Retry Loading</Text>
            </TouchableOpacity>
          </View>
        ) : filteredAndSortedEmployees.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Employees Found</Text>
            <Text style={styles.emptySubtitle}>
              No staff members match the selected search or filter criteria.
            </Text>
            {(Boolean(searchQuery) || statusFilter !== 'all' || deptFilter !== 'all') && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setDeptFilter('all');
                }}
              >
                <Text style={styles.resetFilterBtnText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredAndSortedEmployees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.employeeListContent}
            renderItem={({ item }) => {
              const isSubmitted = item.todayReportStatus?.toLowerCase() === 'submitted';
              return (
                <TouchableOpacity
                  style={styles.employeeCard}
                  onPress={() => handleOpenEmployeeProfile(item)}
                  activeOpacity={0.88}
                >
                  {/* Card Header: Avatar, Name, Role/ID */}
                  <View style={styles.empCardTop}>
                    <View style={styles.avatarWrap}>
                      <Text style={styles.avatarText}>
                        {(item.name || 'E')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.empNameText}>{item.name}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            isSubmitted ? styles.statusBadgeSubmitted : styles.statusBadgeNotSubmitted
                          ]}
                        >
                          <Ionicons
                            name={isSubmitted ? 'checkmark-circle' : 'time-outline'}
                            size={12}
                            color={isSubmitted ? '#15803d' : '#b45309'}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isSubmitted ? styles.statusTextSubmitted : styles.statusTextNotSubmitted
                            ]}
                          >
                            {isSubmitted ? 'Submitted' : 'Not Submitted'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.empCodeText}>
                        {item.employee_code} • {item.designation}
                      </Text>
                      <Text style={styles.empDeptText}>{item.department}</Text>
                    </View>
                  </View>

                  {/* Task Metrics Row */}
                  <View style={styles.metricsPillRow}>
                    <View style={styles.metricPill}>
                      <Text style={styles.metricPillVal}>{item.todayTotalTasks}</Text>
                      <Text style={styles.metricPillLbl}>Total Tasks</Text>
                    </View>
                    <View style={styles.metricPill}>
                      <Text style={[styles.metricPillVal, { color: '#15803d' }]}>
                        {item.todayCompletedTasks}
                      </Text>
                      <Text style={styles.metricPillLbl}>Completed</Text>
                    </View>
                    <View style={styles.metricPill}>
                      <Text style={[styles.metricPillVal, { color: '#b45309' }]}>
                        {item.todayPendingTasks}
                      </Text>
                      <Text style={styles.metricPillLbl}>Pending</Text>
                    </View>
                  </View>

                  {/* Card Footer: Submission info & Action button */}
                  <View style={styles.empCardFooter}>
                    <Text style={styles.submissionInfoText}>
                      {isSubmitted && item.lastSubmissionTime
                        ? `Submitted ${new Date(item.lastSubmissionTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}`
                        : item.latestReportDate
                        ? `Latest report: ${item.latestReportDate}`
                        : "Today's report not submitted"}
                    </Text>

                    <View style={styles.viewReportsAction}>
                      <Text style={styles.viewReportsActionText}>View Reports</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 2 — EMPLOYEE REPORT PROFILE (WITH EXCEL DOWNLOAD & VIEW SPREADSHEET)
  // ---------------------------------------------------------------------------

  const renderEmployeeProfileView = () => {
    if (!selectedEmployee) return null;

    const summary = employeeProfileData?.summary || {
      totalReportsSubmitted: 0,
      totalTasksRecorded: 0,
      totalCompleted: 0,
      totalPending: 0
    };

    const reports = employeeProfileData?.reports || [];
    const todayLiveTasks = employeeProfileData?.todayTasks || [];
    const hasTodayReport = reports.some((r) => r.work_date === todayStr);

    return (
      <ScrollView contentContainerStyle={styles.profileScrollContent}>
        {/* Profile Header Summary Card */}
        <View style={styles.profileSummaryCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.avatarWrap, { width: 50, height: 50, borderRadius: 25 }]}>
              <Text style={[styles.avatarText, { fontSize: 18 }]}>
                {(selectedEmployee.name || 'E')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </Text>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.profileNameText}>{selectedEmployee.name}</Text>
              <Text style={styles.profileSubText}>
                {selectedEmployee.employee_code} • {selectedEmployee.designation}
              </Text>
              <Text style={styles.profileDeptText}>{selectedEmployee.department}</Text>
            </View>
          </View>

          {/* Aggregate Metrics Grid */}
          <View style={styles.aggregateGrid}>
            <View style={styles.aggregateCard}>
              <Text style={styles.aggregateVal}>{summary.totalReportsSubmitted}</Text>
              <Text style={styles.aggregateLbl}>Reports Filed</Text>
            </View>
            <View style={styles.aggregateCard}>
              <Text style={styles.aggregateVal}>{summary.totalTasksRecorded}</Text>
              <Text style={styles.aggregateLbl}>Total Tasks</Text>
            </View>
            <View style={styles.aggregateCard}>
              <Text style={[styles.aggregateVal, { color: '#15803d' }]}>{summary.totalCompleted}</Text>
              <Text style={styles.aggregateLbl}>Completed</Text>
            </View>
            <View style={styles.aggregateCard}>
              <Text style={[styles.aggregateVal, { color: '#b45309' }]}>{summary.totalPending}</Text>
              <Text style={styles.aggregateLbl}>Pending</Text>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* TWO CLEARLY DISTINGUISHABLE ACTIONS ON SELECTED EMPLOYEE SCREEN (Section 7.1) */}
          {/* ========================================================================= */}
          <View style={styles.profileActionRow}>
            <TouchableOpacity
              style={[styles.profilePrimaryBtn, styles.downloadExcelBtn]}
              onPress={handleOpenDownloadModal}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={16} color="#ffffff" />
              <Text style={styles.profilePrimaryBtnText}>Download Excel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profilePrimaryBtn, styles.viewSpreadsheetBtn]}
              onPress={handleOpenSpreadsheetViewer}
              activeOpacity={0.85}
            >
              <Ionicons name="grid-outline" size={16} color="#ffffff" />
              <Text style={styles.profilePrimaryBtnText}>View Spreadsheet</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date-wise Timeline Header */}
        <View style={styles.timelineHeaderRow}>
          <Text style={styles.timelineHeading}>Daily Task History</Text>
          <Text style={styles.timelineSubheading}>Sorted Newest to Oldest</Text>
        </View>

        {/* TODAY'S ACTIVE CARD (Latest Date First) */}
        <View style={[styles.timelineCard, styles.timelineCardToday]}>
          <View style={styles.timelineCardHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="today" size={16} color={colors.primary} />
                <Text style={styles.timelineDateText}>{todayStr} — Today</Text>
              </View>
              <Text style={styles.timelineDayText}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                hasTodayReport ? styles.statusBadgeSubmitted : styles.statusBadgeNotSubmitted
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  hasTodayReport ? styles.statusTextSubmitted : styles.statusTextNotSubmitted
                ]}
              >
                {hasTodayReport ? 'Submitted' : 'Active / In Progress'}
              </Text>
            </View>
          </View>

          <View style={styles.timelineStatsRow}>
            <Text style={styles.timelineStatText}>
              Tasks: <Text style={{ fontWeight: '700' }}>{todayLiveTasks.length}</Text>
            </Text>
            <Text style={styles.dotSeparator}>&bull;</Text>
            <Text style={[styles.timelineStatText, { color: '#15803d' }]}>
              Completed: {todayLiveTasks.filter((t) => t.completed === 'Yes').length}
            </Text>
            <Text style={styles.dotSeparator}>&bull;</Text>
            <Text style={[styles.timelineStatText, { color: '#b45309' }]}>
              Pending: {todayLiveTasks.filter((t) => t.pending === 'Yes').length}
            </Text>
          </View>

          <View style={styles.timelineActionRow}>
            <TouchableOpacity
              style={styles.openDateDetailBtn}
              onPress={() => handleOpenDateDetail(todayStr)}
            >
              <Text style={styles.openDateDetailBtnText}>View Today's Tasks & Actions</Text>
              <Ionicons name="arrow-forward" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* HISTORICAL REPORTS (Strictly Read-Only, Descending) */}
        {reports
          .filter((r) => r.work_date !== todayStr)
          .map((rep) => {
            const tasks = rep.tasks || [];
            const completedCount = tasks.filter((t) => t.completed === 'Yes').length;
            const pendingCount = tasks.filter((t) => t.pending === 'Yes').length;

            return (
              <View key={rep.id} style={styles.timelineCard}>
                <View style={styles.timelineCardHeader}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.timelineDateText}>{rep.work_date}</Text>
                    </View>
                    <Text style={styles.timelineDayText}>{rep.day_name || 'Past Date'}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {rep.rating_average_overall && (
                      <View style={styles.scoreBadgeSmall}>
                        <Text style={styles.scoreBadgeVal}>{rep.rating_average_overall}</Text>
                        <Text style={styles.scoreBadgeMax}>/10</Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, styles.statusBadgeSubmitted]}>
                      <Text style={[styles.statusBadgeText, styles.statusTextSubmitted]}>
                        Submitted
                      </Text>
                    </View>
                  </View>
                </View>

                {rep.work_summary && (
                  <Text style={styles.repSummaryExcerpt} numberOfLines={2}>
                    {rep.work_summary}
                  </Text>
                )}

                <View style={styles.timelineStatsRow}>
                  <Text style={styles.timelineStatText}>Tasks: {tasks.length}</Text>
                  <Text style={styles.dotSeparator}>&bull;</Text>
                  <Text style={[styles.timelineStatText, { color: '#15803d' }]}>
                    Completed: {completedCount}
                  </Text>
                  <Text style={styles.dotSeparator}>&bull;</Text>
                  <Text style={[styles.timelineStatText, { color: '#b45309' }]}>
                    Pending: {pendingCount}
                  </Text>
                </View>

                <View style={styles.timelineActionRow}>
                  <TouchableOpacity
                    style={styles.openHistoricalBtn}
                    onPress={() => handleOpenDateDetail(rep.work_date)}
                  >
                    <Ionicons name="eye-outline" size={14} color={colors.primary} />
                    <Text style={styles.openHistoricalBtnText}>View Historical Report (Read-Only)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
      </ScrollView>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER: VIEW 3 — SPECIFIC DATE DETAIL (HISTORICAL OR TODAY)
  // ---------------------------------------------------------------------------

  const renderDateDetailView = () => {
    if (!selectedEmployee || !selectedReportDate) return null;

    const isToday = selectedReportDate === todayStr;
    const reports = employeeProfileData?.reports || [];
    const targetReport = reports.find((r) => r.work_date === selectedReportDate);

    // If today and no report submitted yet, show current live tasks
    const tasks = isToday
      ? targetReport?.tasks || employeeProfileData?.todayTasks || []
      : targetReport?.tasks || [];

    const completedCount = tasks.filter((t) => t.completed === 'Yes').length;
    const pendingCount = tasks.filter((t) => t.pending === 'Yes').length;

    return (
      <ScrollView contentContainerStyle={styles.detailScrollContent}>
        {/* Banner Mode Notice */}
        <View
          style={[
            styles.modeNoticeBanner,
            isToday ? styles.bannerToday : styles.bannerHistorical
          ]}
        >
          <Ionicons
            name={isToday ? 'create-outline' : 'lock-closed'}
            size={18}
            color={isToday ? '#15803d' : '#4b5563'}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text
              style={[
                styles.modeNoticeTitle,
                { color: isToday ? '#15803d' : '#1f2937' }
              ]}
            >
              {isToday ? "Today's Active Daily Tasks" : 'Historical Report — Strict Read-Only'}
            </Text>
            <Text style={styles.modeNoticeSubtitle}>
              {isToday
                ? 'Management can assign new tasks and monitor real-time completion.'
                : 'Previous daily reports are locked for audit compliance and cannot be edited.'}
            </Text>
          </View>
        </View>

        {/* Date Overview Card */}
        <View style={styles.dateOverviewCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.overviewDateText}>{selectedReportDate}</Text>
              <Text style={styles.overviewEmployeeText}>
                {selectedEmployee.name} ({selectedEmployee.employee_code})
              </Text>
            </View>

            {isToday && (
              <TouchableOpacity
                style={styles.addTaskTopBtn}
                onPress={handleOpenAssignModal}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={16} color="#ffffff" />
                <Text style={styles.addTaskTopBtnText}>+ Add Task</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Bar */}
          <View style={styles.overviewStatsRow}>
            <Text style={styles.overviewStatVal}>
              Total Tasks: <Text style={{ fontWeight: '800' }}>{tasks.length}</Text>
            </Text>
            <Text style={[styles.overviewStatVal, { color: '#15803d' }]}>
              Completed: <Text style={{ fontWeight: '800' }}>{completedCount}</Text>
            </Text>
            <Text style={[styles.overviewStatVal, { color: '#b45309' }]}>
              Pending: <Text style={{ fontWeight: '800' }}>{pendingCount}</Text>
            </Text>
          </View>

          {targetReport?.work_summary && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryBoxLabel}>Daily Work Summary:</Text>
              <Text style={styles.summaryBoxText}>{targetReport.work_summary}</Text>
            </View>
          )}

          {/* 6-Factor Rating Breakdown for Historical Reports */}
          {!isToday && targetReport && (
            <View style={styles.ratingSection}>
              <View style={styles.ratingSectionHeader}>
                <Text style={styles.ratingSectionTitle}>Evaluated Performance Ratings</Text>
                {targetReport.rating_average_overall && (
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreVal}>{targetReport.rating_average_overall}</Text>
                    <Text style={styles.scoreMax}>/10</Text>
                  </View>
                )}
              </View>

              <View style={styles.ratingGrid}>
                {[
                  { label: 'Speed', val: targetReport.rating_speed || targetReport.ratings?.speed || 9 },
                  { label: 'Understanding', val: targetReport.rating_understanding || targetReport.ratings?.understanding || 9 },
                  { label: 'Problem Solving', val: targetReport.rating_problem_solving || targetReport.ratings?.problemSolving || 9 },
                  { label: 'Communication', val: targetReport.rating_talking_behaviour || targetReport.ratings?.talkingBehaviour || 8 },
                  { label: 'Work Quality', val: targetReport.rating_work_quality || targetReport.ratings?.workQuality || 9 },
                  { label: 'Discipline', val: targetReport.rating_discipline || targetReport.ratings?.discipline || 10 }
                ].map((factor, i) => (
                  <View key={i} style={styles.ratingChip}>
                    <Text style={styles.ratingChipLabel}>{factor.label}</Text>
                    <Text style={styles.ratingChipVal}>{factor.val}/10</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Task List Section */}
        <View style={styles.taskListHeaderRow}>
          <Text style={styles.taskListSectionTitle}>Recorded Tasks ({tasks.length})</Text>
          {isToday && (
            <TouchableOpacity onPress={handleOpenAssignModal}>
              <Text style={styles.linkActionText}>+ Assign Another Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {tasks.length === 0 ? (
          <View style={styles.emptyTasksCard}>
            <Ionicons name="clipboard-outline" size={36} color={colors.textSecondary} />
            <Text style={styles.emptyTasksTitle}>No tasks recorded for this date</Text>
            {isToday && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.viewSpreadsheetBtn, { marginTop: 12 }]}
                onPress={handleOpenAssignModal}
              >
                <Text style={styles.actionBtnText}>+ Assign First Task</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          tasks.map((task, idx) => {
            const isCompleted = task.completed === 'Yes';
            const isMgmt = Boolean(task.isManagementAssigned);

            return (
              <View key={task.id || idx} style={styles.taskDetailCard}>
                <View style={styles.taskDetailTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={styles.projectTag}>
                      <Ionicons name="folder" size={11} color={colors.primary} />
                      <Text style={styles.projectTagText}>
                        {task.projectName || 'General Operations'}
                      </Text>
                    </View>

                    {/* Task Origin Badge */}
                    <View
                      style={[
                        styles.originBadge,
                        isMgmt ? styles.originMgmt : styles.originEmployee
                      ]}
                    >
                      <Ionicons
                        name={isMgmt ? 'shield-checkmark' : 'person'}
                        size={10}
                        color={isMgmt ? '#15803d' : colors.primary}
                      />
                      <Text
                        style={[
                          styles.originBadgeText,
                          { color: isMgmt ? '#15803d' : colors.primary }
                        ]}
                      >
                        {isMgmt
                          ? `Assigned by ${task.assignedBy || 'Management'}`
                          : 'Employee Reported'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.taskIndexNumber}>#{idx + 1}</Text>
                </View>

                {/* Description */}
                <Text style={styles.taskDetailDesc}>
                  {task.taskDescription || task.tasksAssigned || '—'}
                </Text>

                {/* Status Toggle Row */}
                <View style={styles.taskDetailStatusRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={[
                        styles.statusPillSmall,
                        isCompleted ? styles.statusPillCompleted : styles.statusPillPending
                      ]}
                    >
                      <Ionicons
                        name={isCompleted ? 'checkmark-circle' : 'time'}
                        size={12}
                        color={isCompleted ? '#15803d' : '#b45309'}
                      />
                      <Text
                        style={[
                          styles.statusPillSmallText,
                          { color: isCompleted ? '#15803d' : '#b45309' }
                        ]}
                      >
                        {isCompleted ? 'Completed' : 'Pending'}
                      </Text>
                    </View>

                    {task.priority && (
                      <View style={styles.priorityPill}>
                        <Text style={styles.priorityPillText}>Priority: {task.priority}</Text>
                      </View>
                    )}
                  </View>

                  {/* If today, allow Management to toggle status */}
                  {isToday ? (
                    <TouchableOpacity
                      style={styles.toggleStatusActionBtn}
                      onPress={() =>
                        handleToggleTaskStatus(task.id, task.completed, task.pending)
                      }
                    >
                      <Ionicons
                        name={isCompleted ? 'arrow-undo' : 'checkmark-done'}
                        size={14}
                        color={colors.primary}
                      />
                      <Text style={styles.toggleStatusActionText}>
                        Mark {isCompleted ? 'Pending' : 'Completed'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.readOnlyLockLabel}>Locked (Read-Only)</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ---------------------------------------------------------------------------
  // MAIN HEADER BACK NAVIGATION
  // ---------------------------------------------------------------------------

  const handleHeaderBack = () => {
    if (viewMode === 'date_detail') {
      setViewMode('employee_profile');
    } else if (viewMode === 'employee_profile') {
      setViewMode('employees');
      setSelectedEmployee(null);
    } else {
      onBack();
    }
  };

  const getHeaderTitle = () => {
    if (viewMode === 'date_detail') {
      return selectedReportDate || 'Date Report';
    }
    if (viewMode === 'employee_profile') {
      return selectedEmployee?.name || 'Employee Profile';
    }
    return 'Daily Task Reports';
  };

  const getHeaderSubtitle = () => {
    if (viewMode === 'date_detail') {
      return selectedEmployee ? `${selectedEmployee.name} • ${selectedEmployee.employee_code}` : 'Task Details';
    }
    if (viewMode === 'employee_profile') {
      return selectedEmployee?.designation || 'Employee-wise Task History';
    }
    return 'Employee-wise task activity and performance';
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleHeaderBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {getHeaderTitle()}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {getHeaderSubtitle()}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            if (viewMode === 'employees') loadEmployeeSummaries();
            if (viewMode === 'employee_profile' && selectedEmployee?.id) {
              loadEmployeeProfile(selectedEmployee.id);
            }
          }}
        >
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Main View Router */}
      {viewMode === 'employees' && renderEmployeesView()}
      {viewMode === 'employee_profile' && renderEmployeeProfileView()}
      {viewMode === 'date_detail' && renderDateDetailView()}

      {/* ========================================================================= */}
      {/* MODAL 1: ASSIGN TASK TO CURRENTLY SELECTED EMPLOYEE */}
      {/* ========================================================================= */}
      <Modal
        visible={isAssignModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAssignModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Assign Task</Text>
                <Text style={styles.modalSubtitle}>
                  To {selectedEmployee?.name || 'Staff Member'} ({selectedEmployee?.employee_code})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAssignModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Project Input */}
              <Text style={styles.inputLabel}>Project Name *</Text>
              <TextInput
                style={styles.formInput}
                value={assignProject}
                onChangeText={setAssignProject}
                placeholder="e.g. Android Mobile App, Customer Portal"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Task Title */}
              <Text style={styles.inputLabel}>Task Title</Text>
              <TextInput
                style={styles.formInput}
                value={assignTaskTitle}
                onChangeText={setAssignTaskTitle}
                placeholder="e.g. Implement Attendance Filter"
                placeholderTextColor={colors.textSecondary}
              />

              {/* Task Description */}
              <Text style={styles.inputLabel}>Task Description *</Text>
              <TextInput
                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                value={assignTaskDesc}
                onChangeText={setAssignTaskDesc}
                placeholder="Detailed instructions for the employee..."
                placeholderTextColor={colors.textSecondary}
                multiline
              />

              {/* Priority Selection */}
              <Text style={styles.inputLabel}>Priority</Text>
              <View style={styles.prioritySelectorRow}>
                {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, assignPriority === p && styles.priorityChipActive]}
                    onPress={() => setAssignPriority(p)}
                  >
                    <Text
                      style={[
                        styles.priorityChipText,
                        assignPriority === p && styles.priorityChipTextActive
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Due Time */}
              <Text style={styles.inputLabel}>Target Completion Time</Text>
              <TextInput
                style={styles.formInput}
                value={assignDueTime}
                onChangeText={setAssignDueTime}
                placeholder="e.g. EOD (18:30) or 15:00"
                placeholderTextColor={colors.textSecondary}
              />
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAssignModalOpen(false)}
                disabled={isAssigning}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, isAssigning && { opacity: 0.7 }]}
                onPress={handleSubmitTaskAssignment}
                disabled={isAssigning}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Assign Task</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: IN-APP SPREADSHEET VIEWER (SCOPED STRICTLY TO SELECTED EMPLOYEE) */}
      {/* ========================================================================= */}
      <Modal
        visible={isViewSpreadsheetOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsViewSpreadsheetOpen(false)}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Spreadsheet Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setIsViewSpreadsheetOpen(false)}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Spreadsheet — {selectedEmployee?.name}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {selectedEmployee?.employee_code} • {spreadsheetStartDate} to {spreadsheetEndDate}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.profilePrimaryBtn, styles.downloadExcelBtn, { paddingVertical: 6, paddingHorizontal: 10 }]}
              onPress={() => {
                setIsViewSpreadsheetOpen(false);
                setIsDownloadModalOpen(true);
              }}
            >
              <Ionicons name="download-outline" size={14} color="#ffffff" />
              <Text style={[styles.profilePrimaryBtnText, { fontSize: 11 }]}>Download Excel</Text>
            </TouchableOpacity>
          </View>

          {/* Viewer Summary Bar (Section 8.4) */}
          {spreadsheetData && (
            <View style={styles.viewerSummaryBar}>
              <View style={styles.viewerSummaryCard}>
                <Text style={styles.viewerSummaryVal}>{spreadsheetData.summary?.totalDays || 0}</Text>
                <Text style={styles.viewerSummaryLbl}>Report Days</Text>
              </View>
              <View style={styles.viewerSummaryCard}>
                <Text style={styles.viewerSummaryVal}>{spreadsheetData.summary?.totalTasks || 0}</Text>
                <Text style={styles.viewerSummaryLbl}>Total Tasks</Text>
              </View>
              <View style={styles.viewerSummaryCard}>
                <Text style={[styles.viewerSummaryVal, { color: '#15803d' }]}>
                  {spreadsheetData.summary?.completedTasks || 0}
                </Text>
                <Text style={styles.viewerSummaryLbl}>Completed</Text>
              </View>
              <View style={styles.viewerSummaryCard}>
                <Text style={[styles.viewerSummaryVal, { color: '#b45309' }]}>
                  {spreadsheetData.summary?.pendingTasks || 0}
                </Text>
                <Text style={styles.viewerSummaryLbl}>Pending</Text>
              </View>
            </View>
          )}

          {/* Quick Date Range Picker & Filter bar */}
          <View style={styles.previewFilterBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TextInput
                style={styles.previewDateInput}
                value={spreadsheetStartDate}
                onChangeText={setSpreadsheetStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={{ color: colors.textSecondary }}>to</Text>
              <TextInput
                style={styles.previewDateInput}
                value={spreadsheetEndDate}
                onChangeText={setSpreadsheetEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity style={styles.applyFilterBtn} onPress={handleLoadSpreadsheetData}>
                <Text style={styles.applyFilterBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <TouchableOpacity
                style={styles.quickPresetChip}
                onPress={() => {
                  setSpreadsheetStartDate(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
                  setSpreadsheetEndDate(todayStr);
                }}
              >
                <Text style={styles.quickPresetChipText}>Last 7 Days</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickPresetChip}
                onPress={() => {
                  const now = new Date();
                  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                  setSpreadsheetStartDate(firstDay);
                  setSpreadsheetEndDate(todayStr);
                }}
              >
                <Text style={styles.quickPresetChipText}>This Month</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickPresetChip}
                onPress={() => {
                  setSpreadsheetStartDate(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
                  setSpreadsheetEndDate(todayStr);
                }}
              >
                <Text style={styles.quickPresetChipText}>Last 30 Days</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickPresetChip}
                onPress={() => {
                  setSpreadsheetStartDate(todayStr);
                  setSpreadsheetEndDate(todayStr);
                }}
              >
                <Text style={styles.quickPresetChipText}>Today Only</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Spreadsheet Table Container */}
          {isLoadingSpreadsheet ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Generating spreadsheet data grid...</Text>
            </View>
          ) : !spreadsheetData || spreadsheetData.rows.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Task Records Found</Text>
              <Text style={styles.emptySubtitle}>
                No reports exist for {selectedEmployee?.name} in the selected date range.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal={true} style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }}>
                <View style={styles.spreadsheetTable}>
                  {/* Table Header Row */}
                  <View style={styles.tableHeaderRow}>
                    {[
                      { title: '#', width: 40 },
                      { title: 'Date', width: 95 },
                      { title: 'Day', width: 85 },
                      { title: 'Project', width: 140 },
                      { title: 'Task Description', width: 250 },
                      { title: 'Origin', width: 140 },
                      { title: 'Status', width: 90 },
                      { title: 'Rating', width: 70 }
                    ].map((col, idx) => (
                      <View key={idx} style={[styles.tableHeaderCell, { width: col.width }]}>
                        <Text style={styles.tableHeaderCellText}>{col.title}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Table Data Rows */}
                  {spreadsheetData.rows.map((row, rIdx) => {
                    const isEven = rIdx % 2 === 0;
                    return (
                      <View
                        key={row.rowId || rIdx}
                        style={[styles.tableDataRow, isEven && styles.tableDataRowEven]}
                      >
                        <View style={[styles.tableDataCell, { width: 40 }]}>
                          <Text style={styles.cellTextDim}>{rIdx + 1}</Text>
                        </View>
                        <View style={[styles.tableDataCell, { width: 95 }]}>
                          <Text style={styles.cellTextBold}>{row.workDate}</Text>
                        </View>
                        <View style={[styles.tableDataCell, { width: 85 }]}>
                          <Text style={styles.cellText}>{row.dayName}</Text>
                        </View>
                        <View style={[styles.tableDataCell, { width: 140 }]}>
                          <Text style={[styles.cellText, { color: colors.primary, fontWeight: '600' }]}>
                            {row.projectName}
                          </Text>
                        </View>
                        <View style={[styles.tableDataCell, { width: 250 }]}>
                          <Text style={styles.cellText} numberOfLines={2}>
                            {row.taskDescription}
                          </Text>
                        </View>
                        <View style={[styles.tableDataCell, { width: 140 }]}>
                          <Text
                            style={[
                              styles.cellTextBold,
                              {
                                color:
                                  row.taskOrigin === 'Management Assigned'
                                    ? '#15803d'
                                    : colors.primary
                              }
                            ]}
                          >
                            {row.taskOrigin}
                          </Text>
                        </View>
                        <View style={[styles.tableDataCell, { width: 90 }]}>
                          <View
                            style={[
                              styles.statusPillSmall,
                              row.taskStatus === 'Completed'
                                ? styles.statusPillCompleted
                                : styles.statusPillPending
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillSmallText,
                                {
                                  color: row.taskStatus === 'Completed' ? '#15803d' : '#b45309'
                                }
                              ]}
                            >
                              {row.taskStatus}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.tableDataCell, { width: 70 }]}>
                          <Text style={styles.cellTextBold}>
                            {row.ratingOverall !== '—' ? `${row.ratingOverall}` : '—'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: DOWNLOAD EXCEL MODAL (SCOPED STRICTLY TO SELECTED EMPLOYEE) */}
      {/* ========================================================================= */}
      <Modal
        visible={isDownloadModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDownloadModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Download Excel Report</Text>
                <Text style={styles.modalSubtitle}>
                  For {selectedEmployee?.name} ({selectedEmployee?.employee_code})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsDownloadModalOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              {/* Employee Scope Badge */}
              <View style={styles.employeeScopeBadge}>
                <Ionicons name="person" size={14} color={colors.primary} />
                <Text style={styles.employeeScopeBadgeText}>
                  {selectedEmployee?.name} • {selectedEmployee?.department}
                </Text>
              </View>

              {/* Date Inputs */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={downloadStartDate}
                    onChangeText={setDownloadStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={downloadEndDate}
                    onChangeText={setDownloadEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              {/* Quick Date Presets */}
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 8 }}>
                <TouchableOpacity
                  style={styles.quickPresetChip}
                  onPress={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                    setDownloadStartDate(firstDay);
                    setDownloadEndDate(todayStr);
                  }}
                >
                  <Text style={styles.quickPresetChipText}>This Month</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickPresetChip}
                  onPress={() => {
                    setDownloadStartDate(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
                    setDownloadEndDate(todayStr);
                  }}
                >
                  <Text style={styles.quickPresetChipText}>Last 7 Days</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickPresetChip}
                  onPress={() => {
                    setDownloadStartDate(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
                    setDownloadEndDate(todayStr);
                  }}
                >
                  <Text style={styles.quickPresetChipText}>Last 30 Days</Text>
                </TouchableOpacity>
              </View>

              {/* Export Scope Guarantee */}
              <View style={[styles.modeNoticeBanner, { marginTop: 10 }]}>
                <Ionicons name="shield-checkmark" size={16} color="#15803d" />
                <Text style={[styles.modeNoticeSubtitle, { flex: 1, marginLeft: 6 }]}>
                  The exported workbook strictly contains only {selectedEmployee?.name}'s task records across 3 sheets: Daily Summary, Task Details, and Daily Breakdown.
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsDownloadModalOpen(false)}
                disabled={isDownloading}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, styles.downloadExcelBtn, isDownloading && { opacity: 0.7 }]}
                onPress={handleDownloadExcel}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="download-outline" size={16} color="#ffffff" />
                    <Text style={styles.modalSubmitBtnText}>Download Excel (.xlsx)</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: FILTER & SORT BOTTOM SHEET MODAL (CLEAN & UNCLUTTERED UX) */}
      {/* ========================================================================= */}
      <Modal
        visible={isFilterModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.filterSheetContainer}>
            {/* Sheet Header */}
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Filter & Sort Employees</Text>
                <Text style={styles.filterSheetSubtitle}>
                  Refine staff view without crowding the screen
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {isFilterActive && (
                  <TouchableOpacity onPress={handleResetAllFilters} style={styles.filterResetBtn}>
                    <Text style={styles.resetAllBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setIsFilterModalOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Section 1: Sort Order */}
              <Text style={styles.filterSectionTitle}>Sort Order</Text>
              <View style={styles.sortOptionsWrap}>
                {[
                  { id: 'latest_first', label: 'Latest Report First (Default)', icon: 'time-outline' },
                  { id: 'name_asc', label: 'Employee Name (A to Z)', icon: 'text-outline' },
                  { id: 'pending_first', label: 'Pending Tasks First', icon: 'alert-circle-outline' }
                ].map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.sortSelectRow, sortBy === s.id && styles.sortSelectRowActive]}
                    onPress={() => setSortBy(s.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={s.icon}
                      size={17}
                      color={sortBy === s.id ? colors.primary : colors.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.sortSelectLabel, sortBy === s.id && styles.sortSelectLabelActive]}>
                      {s.label}
                    </Text>
                    {sortBy === s.id && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Section 2: Department Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: 18 }]}>Department / Team</Text>
              <View style={styles.filterChipsWrap}>
                {departments.map((dept) => {
                  const isSelected = deptFilter === dept;
                  return (
                    <TouchableOpacity
                      key={dept}
                      style={[styles.filterSheetChip, isSelected && styles.filterSheetChipActive]}
                      onPress={() => setDeptFilter(dept)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.filterSheetChipText,
                          isSelected && styles.filterSheetChipTextActive
                        ]}
                      >
                        {dept === 'all' ? 'All Departments' : dept}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Section 3: Submission Status Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: 18 }]}>Submission Status</Text>
              <View style={styles.filterChipsWrap}>
                {[
                  { id: 'all', label: 'All Statuses' },
                  { id: 'submitted', label: 'Submitted Today' },
                  { id: 'not_submitted', label: 'Not Submitted' },
                  { id: 'pending_tasks', label: 'With Pending Tasks' }
                ].map((st) => {
                  const isSelected = statusFilter === st.id;
                  return (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.filterSheetChip, isSelected && styles.filterSheetChipActive]}
                      onPress={() => setStatusFilter(st.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.filterSheetChipText,
                          isSelected && styles.filterSheetChipTextActive
                        ]}
                      >
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Apply & Close Button */}
            <TouchableOpacity
              style={styles.applyFilterBtn}
              onPress={() => setIsFilterModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.applyFilterBtnText}>
                Show {filteredAndSortedEmployees.length} Matching Employees
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------

const getStyles = (colors, isDark, insets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Math.max(insets?.top || 0, 12) + 4,
      paddingBottom: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backBtn: {
      padding: 6,
      marginRight: 6
    },
    headerTitleWrap: {
      flex: 1
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    refreshBtn: {
      padding: 6
    },
    contentWrap: {
      flex: 1
    },
    pulseContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 4,
      backgroundColor: colors.card,
      gap: 8
    },
    pulseCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#23291f' : '#f0f3eb'
    },
    pulseText: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: '500'
    },
    pulseBold: {
      fontWeight: '800',
      color: colors.textPrimary
    },
    topControlSection: {
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    unifiedActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    },
    unifiedSearchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 38
    },
    unifiedSearchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      padding: 0
    },
    filterModalTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      height: 38,
      borderRadius: 10,
      backgroundColor: isDark ? '#23291f' : '#f0f3eb',
      borderWidth: 1,
      borderColor: colors.border
    },
    filterModalTriggerActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    filterTriggerText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary
    },
    filterTriggerTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    statusTabRow: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 2
    },
    statusTabChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: isDark ? '#23291f' : '#f1f5f9',
      borderWidth: 1,
      borderColor: colors.border
    },
    statusTabChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    statusTabLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    statusTabLabelActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    statusTabCountBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 10,
      backgroundColor: isDark ? '#334027' : '#e2e8f0'
    },
    statusTabCountBadgeActive: {
      backgroundColor: 'rgba(255,255,255,0.25)'
    },
    statusTabCountText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary
    },
    statusTabCountTextActive: {
      color: '#ffffff'
    },
    activeFiltersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#293223' : '#f1f5f9'
    },
    activeFilterPrefix: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary
    },
    activeTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: isDark ? '#2e3a24' : '#eaf0e4'
    },
    activeTagText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary
    },
    clearAllBtn: {
      paddingVertical: 2,
      paddingHorizontal: 4
    },
    clearAllLink: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.danger || '#ef4444'
    },
    countTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6
    },
    countText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary
    },
    sortHintText: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.primary
    },
    employeeListContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 40
    },
    employeeCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    empCardTop: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    avatarWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? '#334027' : '#e6ede0',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary
    },
    empNameText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    empCodeText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    empDeptText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 1
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    statusBadgeSubmitted: {
      backgroundColor: '#dcfce7'
    },
    statusBadgeNotSubmitted: {
      backgroundColor: '#fef3c7'
    },
    statusBadgeText: {
      fontSize: 10,
      fontWeight: '700'
    },
    statusTextSubmitted: {
      color: '#15803d'
    },
    statusTextNotSubmitted: {
      color: '#b45309'
    },
    metricsPillRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#2c3325' : '#f0f2eb'
    },
    metricPill: {
      flex: 1,
      backgroundColor: isDark ? '#1a2016' : '#f7f9f5',
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    metricPillVal: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary
    },
    metricPillLbl: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 1
    },
    empCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10
    },
    submissionInfoText: {
      fontSize: 11,
      color: colors.textSecondary
    },
    viewReportsAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2
    },
    viewReportsActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },

    // View 2 Profile styles
    profileScrollContent: {
      padding: 16,
      paddingBottom: 50
    },
    profileSummaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16
    },
    profileNameText: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary
    },
    profileSubText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    profileDeptText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 1
    },
    aggregateGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    aggregateCard: {
      flex: 1,
      backgroundColor: isDark ? '#1e2419' : '#f8faf6',
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    aggregateVal: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary
    },
    aggregateLbl: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center'
    },

    // Two Primary Buttons on Selected Employee Profile (Section 7.1)
    profileActionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#2a3224' : '#f0f2eb'
    },
    profilePrimaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10
    },
    downloadExcelBtn: {
      backgroundColor: '#2e7d32' // Deep Excel Green
    },
    viewSpreadsheetBtn: {
      backgroundColor: colors.primary // Olive Brand Action
    },
    profilePrimaryBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700'
    },

    timelineHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10
    },
    timelineHeading: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary
    },
    timelineSubheading: {
      fontSize: 11,
      color: colors.textSecondary
    },
    timelineCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12
    },
    timelineCardToday: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      backgroundColor: isDark ? '#1e251a' : '#fbfdf9'
    },
    timelineCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    },
    timelineDateText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    timelineDayText: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    timelineStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8
    },
    timelineStatText: {
      fontSize: 12,
      color: colors.textPrimary
    },
    dotSeparator: {
      color: colors.textSecondary
    },
    timelineActionRow: {
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#2a3223' : '#f0f2eb'
    },
    openDateDetailBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8
    },
    openDateDetailBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700'
    },
    openHistoricalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary
    },
    openHistoricalBtnText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700'
    },
    scoreBadgeSmall: {
      flexDirection: 'row',
      alignItems: 'baseline',
      backgroundColor: isDark ? '#2a3622' : '#edf3e9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6
    },
    scoreBadgeVal: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary
    },
    scoreBadgeMax: {
      fontSize: 8,
      color: colors.textSecondary
    },
    repSummaryExcerpt: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
      lineHeight: 16
    },

    // View 3 Detail styles
    detailScrollContent: {
      padding: 16,
      paddingBottom: 60
    },
    modeNoticeBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 10,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1
    },
    bannerToday: {
      backgroundColor: '#f0fdf4',
      borderColor: '#bbf7d0'
    },
    bannerHistorical: {
      backgroundColor: isDark ? '#262924' : '#f3f4f6',
      borderColor: isDark ? '#3d4439' : '#e5e7eb'
    },
    modeNoticeTitle: {
      fontSize: 13,
      fontWeight: '700'
    },
    modeNoticeSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 15
    },
    dateOverviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16
    },
    overviewDateText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary
    },
    overviewEmployeeText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    addTaskTopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8
    },
    addTaskTopBtnText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700'
    },
    overviewStatsRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    overviewStatVal: {
      fontSize: 12,
      color: colors.textPrimary
    },
    summaryBox: {
      marginTop: 10,
      backgroundColor: isDark ? '#1f261b' : '#f7f9f4',
      borderRadius: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border
    },
    summaryBoxLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 4
    },
    summaryBoxText: {
      fontSize: 12,
      color: colors.textPrimary,
      lineHeight: 16
    },
    ratingSection: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    ratingSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    },
    ratingSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    scoreBadge: {
      flexDirection: 'row',
      alignItems: 'baseline',
      backgroundColor: isDark ? '#23301c' : '#eef5ea',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    scoreVal: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary
    },
    scoreMax: {
      fontSize: 10,
      color: colors.textSecondary
    },
    ratingGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    ratingChip: {
      flexBasis: '31%',
      backgroundColor: isDark ? '#1a2016' : '#f4f6f1',
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 4,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    ratingChipLabel: {
      fontSize: 9,
      color: colors.textSecondary
    },
    ratingChipVal: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 2
    },
    taskListHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    taskListSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary
    },
    linkActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    emptyTasksCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    emptyTasksTitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8
    },
    taskDetailCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10
    },
    taskDetailTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    projectTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? '#232b1e' : '#f0f4eb',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    projectTagText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary
    },
    originBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4
    },
    originMgmt: {
      backgroundColor: '#f0fdf4'
    },
    originEmployee: {
      backgroundColor: isDark ? '#283222' : '#f4f7f1'
    },
    originBadgeText: {
      fontSize: 10,
      fontWeight: '700'
    },
    taskIndexNumber: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary
    },
    taskDetailDesc: {
      fontSize: 13,
      color: colors.textPrimary,
      marginTop: 8,
      lineHeight: 18
    },
    taskDetailStatusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#2a3224' : '#f0f2eb'
    },
    statusPillSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    statusPillCompleted: {
      backgroundColor: '#dcfce7'
    },
    statusPillPending: {
      backgroundColor: '#fef3c7'
    },
    statusPillSmallText: {
      fontSize: 10,
      fontWeight: '700'
    },
    priorityPill: {
      backgroundColor: isDark ? '#2f3729' : '#eef2e7',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 4
    },
    priorityPillText: {
      fontSize: 9,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    toggleStatusActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.primary
    },
    toggleStatusActionText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary
    },
    readOnlyLockLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary
    },

    // Modal Common Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
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
    employeeScopeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#21291c' : '#f0f4ea',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border
    },
    employeeScopeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginTop: 10,
      marginBottom: 4
    },
    formInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 13,
      color: colors.textPrimary
    },
    prioritySelectorRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4
    },
    priorityChip: {
      flex: 1,
      paddingVertical: 6,
      alignItems: 'center',
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    priorityChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    priorityChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    priorityChipTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    modalActionRow: {
      flexDirection: 'row',
      padding: 14,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border
    },
    modalCancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary
    },
    modalSubmitBtn: {
      flex: 1.5,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary
    },
    modalSubmitBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ffffff'
    },

    // Spreadsheet Viewer Styles (Section 8.2 & 8.4)
    viewerSummaryBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    viewerSummaryCard: {
      flex: 1,
      backgroundColor: isDark ? '#1e2419' : '#f7f9f4',
      borderRadius: 8,
      paddingVertical: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    viewerSummaryVal: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary
    },
    viewerSummaryLbl: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 1
    },
    previewFilterBar: {
      backgroundColor: colors.card,
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    previewDateInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 11,
      color: colors.textPrimary
    },
    applyFilterBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6
    },
    applyFilterBtnText: {
      color: '#ffffff',
      fontSize: 11,
      fontWeight: '700'
    },
    quickPresetChip: {
      backgroundColor: isDark ? '#262f21' : '#f0f4eb',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginRight: 6
    },
    quickPresetChipText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.primary
    },
    spreadsheetTable: {
      backgroundColor: colors.surface
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2e3828' : '#e6ede0',
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    tableHeaderCell: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      justifyContent: 'center'
    },
    tableHeaderCellText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textPrimary
    },
    tableDataRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#283022' : '#f0f2eb'
    },
    tableDataRowEven: {
      backgroundColor: isDark ? '#1d2218' : '#fbfcf9'
    },
    tableDataCell: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRightWidth: 1,
      borderRightColor: isDark ? '#283022' : '#f0f2eb',
      justifyContent: 'center'
    },
    cellText: {
      fontSize: 11,
      color: colors.textPrimary
    },
    cellTextBold: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textPrimary
    },
    cellTextDim: {
      fontSize: 10,
      color: colors.textSecondary
    },

    // Utilities
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
    resetFilterBtn: {
      marginTop: 14,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.primary
    },
    resetFilterBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#ffffff'
    },

    // Modal 4: Filter & Sort Bottom Sheet Styles
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end'
    },
    filterSheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 32,
      maxHeight: '85%'
    },
    filterSheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    filterSheetTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.textPrimary
    },
    filterSheetSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    filterResetBtn: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: isDark ? '#334027' : '#f0f3eb'
    },
    resetAllBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    filterSectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.textSecondary,
      marginBottom: 8
    },
    sortOptionsWrap: {
      gap: 6
    },
    sortSelectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: isDark ? '#21281c' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border
    },
    sortSelectRowActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? '#2e3a24' : '#f0f5eb'
    },
    sortSelectLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary
    },
    sortSelectLabelActive: {
      color: colors.primary,
      fontWeight: '700'
    },
    filterChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6
    },
    filterSheetChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: isDark ? '#21281c' : '#f1f5f9',
      borderWidth: 1,
      borderColor: colors.border
    },
    filterSheetChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    filterSheetChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary
    },
    filterSheetChipTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    }
  });
