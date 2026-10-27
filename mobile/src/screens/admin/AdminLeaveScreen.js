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

export default function AdminLeaveScreen({ onBack, user, organization }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const isTeamLeader = user?.role === 'team_leader';
  const isManagement = user?.role === 'founder' || user?.role === 'admin';

  // Desk Mode: 'leaves' | 'advances' | 'bank'
  const [deskTab, setDeskTab] = useState('leaves');

  // Leaves State
  const [leaves, setLeaves] = useState([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(true);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [decisionAction, setDecisionAction] = useState(null); // 'approved' | 'rejected'
  const [decisionComment, setDecisionComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Advances State
  const [advances, setAdvances] = useState([]);
  const [isLoadingAdvances, setIsLoadingAdvances] = useState(false);
  const [advanceFilter, setAdvanceFilter] = useState('all');
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [advanceActionType, setAdvanceActionType] = useState(null); // 'approve' | 'reject' | 'payment'
  const [advanceApprovedAmount, setAdvanceApprovedAmount] = useState('');
  const [advanceRemarks, setAdvanceRemarks] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  // Bank Verifications State
  const [bankSubmissions, setBankSubmissions] = useState([]);
  const [isLoadingBank, setIsLoadingBank] = useState(false);
  const [bankFilter, setBankFilter] = useState('all');
  const [selectedBank, setSelectedBank] = useState(null);
  const [bankAction, setBankAction] = useState(null); // 'verified' | 'rejected'
  const [bankReviewNotes, setBankReviewNotes] = useState('');

  const loadLeaves = async () => {
    try {
      setIsLoadingLeaves(true);
      const res = await api.getLeaves();
      if (res.success && res.data) {
        setLeaves(res.data);
      }
    } catch (e) {
      console.warn('[AdminLeave] Error:', e);
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  const loadAdvances = async () => {
    if (!isManagement) return;
    try {
      setIsLoadingAdvances(true);
      const res = await api.getAdminSalaryAdvances();
      if (res && res.success && res.data) {
        setAdvances(res.data);
      }
    } catch (e) {
      console.warn('[AdminAdvances] Error:', e);
    } finally {
      setIsLoadingAdvances(false);
    }
  };

  const loadBankSubmissions = async () => {
    if (!isManagement) return;
    try {
      setIsLoadingBank(true);
      const res = await api.getAdminBankDetails();
      if (res && res.success && res.data) {
        setBankSubmissions(res.data);
      }
    } catch (e) {
      console.warn('[AdminBankDetails] Error:', e);
    } finally {
      setIsLoadingBank(false);
    }
  };

  useEffect(() => {
    loadLeaves();
    if (isManagement) {
      loadAdvances();
      loadBankSubmissions();
    }
  }, []);

  const handleRefresh = () => {
    if (deskTab === 'leaves') loadLeaves();
    else if (deskTab === 'advances') loadAdvances();
    else if (deskTab === 'bank') loadBankSubmissions();
  };

  // Leave Decision Handlers
  const handleOpenDecision = (leave, action) => {
    setSelectedLeave(leave);
    setDecisionAction(action);
    setDecisionComment(action === 'approved' ? 'Leave approved.' : 'Rejected due to project deadlines.');
  };

  const handleSubmitDecision = async () => {
    if (!selectedLeave || !decisionAction) return;

    try {
      setIsSubmitting(true);
      const res = await api.updateLeaveStatus(
        selectedLeave.id,
        decisionAction,
        decisionComment
      );

      if (res.success) {
        Alert.alert('Success', `Leave request ${decisionAction}.`);
        setSelectedLeave(null);
        setDecisionAction(null);
        loadLeaves();
      } else {
        Alert.alert('Error', res.error || 'Failed to update leave.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance Decision Handlers
  const handleOpenAdvanceAction = (adv, type) => {
    setSelectedAdvance(adv);
    setAdvanceActionType(type);
    if (type === 'approve') {
      setAdvanceApprovedAmount(String(adv.amount || ''));
      setAdvanceRemarks('Approved as requested.');
    } else if (type === 'reject') {
      setAdvanceRemarks('Request cannot be accommodated at this time.');
    } else if (type === 'payment') {
      setPaymentAmount(String(adv.approvedAmount || adv.amount || ''));
      setPaymentMethod('Bank Transfer (NEFT/IMPS)');
      setPaymentRef('');
      setPaymentRemarks('Paid directly to employee verified account.');
    }
  };

  const handleSubmitAdvanceAction = async () => {
    if (!selectedAdvance || !advanceActionType) return;
    try {
      setIsSubmitting(true);
      if (advanceActionType === 'approve' || advanceActionType === 'reject') {
        const status = advanceActionType === 'approve' ? 'Approved' : 'Rejected';
        const res = await api.approveSalaryAdvance(selectedAdvance.id, {
          status,
          approvedAmount: advanceActionType === 'approve' ? Number(advanceApprovedAmount) : undefined,
          remarks: advanceRemarks
        });
        if (res && res.success) {
          Alert.alert('Success', `Salary advance request ${status}.`);
          setSelectedAdvance(null);
          setAdvanceActionType(null);
          loadAdvances();
        } else {
          Alert.alert('Error', res?.error || 'Failed to process advance.');
        }
      } else if (advanceActionType === 'payment') {
        if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
          Alert.alert('Invalid Amount', 'Please specify a valid payment amount.');
          return;
        }
        const res = await api.recordAdvancePayment(selectedAdvance.id, {
          amountPaid: Number(paymentAmount),
          paymentMethod,
          transactionRef: paymentRef || undefined,
          paymentRemarks
        });
        if (res && res.success) {
          Alert.alert('Success', 'Payment record successfully created.');
          setSelectedAdvance(null);
          setAdvanceActionType(null);
          loadAdvances();
        } else {
          Alert.alert('Error', res?.error || 'Failed to record payment.');
        }
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bank Verification Handlers
  const handleOpenBankAction = (bank, action) => {
    setSelectedBank(bank);
    setBankAction(action);
    setBankReviewNotes(action === 'verified' ? 'Account verified against HR bank passbook records.' : 'Account name mismatch.');
  };

  const handleSubmitBankAction = async () => {
    if (!selectedBank || !bankAction) return;
    try {
      setIsSubmitting(true);
      const res = await api.verifyBankDetails(selectedBank.id, {
        status: bankAction,
        reviewNotes: bankReviewNotes
      });
      if (res && res.success) {
        Alert.alert('Success', `Bank details marked as ${bankAction}.`);
        setSelectedBank(null);
        setBankAction(null);
        loadBankSubmissions();
      } else {
        Alert.alert('Error', res?.error || 'Failed to update bank status.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLeaves = leaves.filter(
    (l) => leaveStatusFilter === 'all' || l.status === leaveStatusFilter
  );

  const filteredAdvances = advances.filter(
    (a) => advanceFilter === 'all' || a.status?.toLowerCase().includes(advanceFilter.toLowerCase())
  );

  const filteredBank = bankSubmissions.filter(
    (b) => bankFilter === 'all' || b.status?.toLowerCase() === bankFilter.toLowerCase()
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Approvals Desk</Text>
          <Text style={styles.headerSubtitle}>
            {deskTab === 'leaves' ? 'Leave Requests' : deskTab === 'advances' ? 'Salary Advance Requests' : 'Bank Verifications'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Top Desk Tabs for Management (Founder / Admin) */}
      {isManagement && (
        <View style={{
          flexDirection: 'row',
          backgroundColor: isDark ? '#1a2218' : '#eef2eb',
          marginHorizontal: 16,
          marginTop: 10,
          borderRadius: 10,
          padding: 4
        }}>
          {[
            { id: 'leaves', label: 'Leaves', icon: 'calendar-outline' },
            { id: 'advances', label: 'Advances', icon: 'wallet-outline' },
            { id: 'bank', label: 'Bank Details', icon: 'card-outline' }
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: deskTab === tab.id ? colors.primary : 'transparent'
              }}
              onPress={() => setDeskTab(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={deskTab === tab.id ? '#ffffff' : colors.textSecondary}
              />
              <Text style={{
                fontSize: 12,
                fontWeight: deskTab === tab.id ? '700' : '500',
                color: deskTab === tab.id ? '#ffffff' : colors.textSecondary
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ---------------- 1. LEAVES DESK ---------------- */}
      {deskTab === 'leaves' && (
        <>
          <View style={styles.filterRow}>
            {['all', 'pending', 'approved', 'rejected'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterTab, leaveStatusFilter === s && styles.filterTabActive]}
                onPress={() => setLeaveStatusFilter(s)}
              >
                <Text style={[styles.filterTabText, leaveStatusFilter === s && styles.filterTabTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoadingLeaves ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading leave requests...</Text>
            </View>
          ) : filteredLeaves.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Leave Requests</Text>
              <Text style={styles.emptySubtitle}>No requests match the selected filter.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredLeaves}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.userName}>{item.user_name || 'Employee'}</Text>
                      <Text style={styles.leaveType}>{item.leave_type} Leave</Text>
                    </View>
                    <View
                      style={[
                        styles.statusTag,
                        item.status === 'approved'
                          ? styles.statusApproved
                          : item.status === 'rejected'
                          ? styles.statusRejected
                          : styles.statusPending
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusTagText,
                          item.status === 'approved'
                            ? styles.statusTextApproved
                            : item.status === 'rejected'
                            ? styles.statusTextRejected
                            : styles.statusTextPending
                        ]}
                      >
                        {item.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.datesBox}>
                    <Ionicons name="calendar" size={14} color={colors.primary} />
                    <Text style={styles.datesText}>
                      {item.start_date} &rarr; {item.end_date} ({item.duration_days} {item.duration_days === 1 ? 'day' : 'days'})
                    </Text>
                  </View>

                  <Text style={styles.reasonText}>
                    <Text style={styles.reasonLabel}>Reason: </Text>
                    {item.reason}
                  </Text>

                  {item.decision_comment && (
                    <View style={styles.decisionCommentBox}>
                      <Text style={styles.decisionCommentLabel}>Admin Note:</Text>
                      <Text style={styles.decisionCommentText}>{item.decision_comment}</Text>
                    </View>
                  )}

                  {item.status === 'pending' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={() => handleOpenDecision(item, 'rejected')}
                      >
                        <Ionicons name="close-circle" size={16} color="#b91c1c" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={() => handleOpenDecision(item, 'approved')}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#047857" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            />
          )}
        </>
      )}

      {/* ---------------- 2. SALARY ADVANCES DESK ---------------- */}
      {deskTab === 'advances' && (
        <>
          <View style={styles.filterRow}>
            {['all', 'pending', 'approved', 'paid', 'rejected'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterTab, advanceFilter === s && styles.filterTabActive]}
                onPress={() => setAdvanceFilter(s)}
              >
                <Text style={[styles.filterTabText, advanceFilter === s && styles.filterTabTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoadingAdvances ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading salary advances...</Text>
            </View>
          ) : filteredAdvances.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="wallet-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Advances Found</Text>
              <Text style={styles.emptySubtitle}>No requests match the selected filter.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredAdvances}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isPending = item.status === 'Pending Approval';
                const isApproved = item.status === 'Approved' || item.status === 'Payment Pending';
                const isPartiallyPaid = item.status === 'Partially Paid';
                return (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.userName}>{item.employeeName || item.employee_name || 'Staff'}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </Text>
                      </View>
                      <View style={[styles.statusTag, {
                        backgroundColor: item.status === 'Approved' || item.status === 'Paid'
                          ? '#dcfce7'
                          : item.status === 'Rejected' ? '#fee2e2' : '#fef3c7'
                      }]}>
                        <Text style={[styles.statusTagText, {
                          color: item.status === 'Approved' || item.status === 'Paid'
                            ? '#15803d'
                            : item.status === 'Rejected' ? '#b91c1c' : '#b45309'
                        }]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: colors.textPrimary, marginTop: 6 }}>
                      <Text style={{ fontWeight: '600' }}>Reason: </Text>
                      {item.reasonCategory || item.reason}
                    </Text>
                    {item.reasonDescription ? (
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {item.reasonDescription}
                      </Text>
                    ) : null}

                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                      Tenure: {item.tenure} • Requested on: {item.requestedDate || item.created_at || 'Recent'}
                    </Text>

                    {item.approvedAmount && (
                      <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '600', marginTop: 4 }}>
                        Approved Amount: ₹{Number(item.approvedAmount).toLocaleString('en-IN')}
                      </Text>
                    )}
                    {item.paidAmount && (
                      <Text style={{ fontSize: 12, color: '#0f766e', fontWeight: '600', marginTop: 2 }}>
                        Paid Amount: ₹{Number(item.paidAmount).toLocaleString('en-IN')} {item.paidDate ? `(${item.paidDate})` : ''}
                      </Text>
                    )}
                    {item.transactionRef && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        UTR / Ref: <Text style={{ fontFamily: 'monospace', fontWeight: '700' }}>{item.transactionRef}</Text>
                      </Text>
                    )}

                    {/* Action Buttons */}
                    {isPending && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => handleOpenAdvanceAction(item, 'reject')}
                        >
                          <Ionicons name="close-circle" size={16} color="#b91c1c" />
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          onPress={() => handleOpenAdvanceAction(item, 'approve')}
                        >
                          <Ionicons name="checkmark-circle" size={16} color="#047857" />
                          <Text style={styles.approveBtnText}>Approve</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {(isApproved || isPartiallyPaid) && (
                      <View style={[styles.actionRow, { marginTop: 10 }]}>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
                          onPress={() => handleOpenAdvanceAction(item, 'payment')}
                        >
                          <Ionicons name="cash-outline" size={16} color="#ffffff" />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>Record Payment</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ---------------- 3. BANK DETAILS DESK ---------------- */}
      {deskTab === 'bank' && (
        <>
          <View style={styles.filterRow}>
            {['all', 'pending', 'verified', 'rejected'].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterTab, bankFilter === s && styles.filterTabActive]}
                onPress={() => setBankFilter(s)}
              >
                <Text style={[styles.filterTabText, bankFilter === s && styles.filterTabTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoadingBank ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading bank submissions...</Text>
            </View>
          ) : filteredBank.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="card-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Bank Details Found</Text>
              <Text style={styles.emptySubtitle}>No records match the selected filter.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredBank}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isPending = item.status === 'pending';
                const isVerified = item.status === 'verified';
                return (
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.userName}>{item.employeeName || item.accountHolderName}</Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                          Account Holder: {item.accountHolderName}
                        </Text>
                      </View>
                      <View style={[styles.statusTag, {
                        backgroundColor: isVerified ? '#dcfce7' : item.status === 'rejected' ? '#fee2e2' : '#fef3c7'
                      }]}>
                        <Text style={[styles.statusTagText, {
                          color: isVerified ? '#15803d' : item.status === 'rejected' ? '#b91c1c' : '#b45309'
                        }]}>
                          {item.status?.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginVertical: 8, padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1a202c' : '#f8fafc' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                        {item.bankName}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        A/C No: <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.maskedAccountNumber}</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        IFSC: <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{item.ifscCode}</Text>
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        Type: {item.accountType || 'Savings'} • Submitted: {item.submittedAt || item.created_at || 'Recent'}
                      </Text>
                    </View>

                    {item.reviewNotes ? (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 8 }}>
                        Review Note: {item.reviewNotes}
                      </Text>
                    ) : null}

                    {isPending && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.rejectBtn]}
                          onPress={() => handleOpenBankAction(item, 'rejected')}
                        >
                          <Ionicons name="close-circle" size={16} color="#b91c1c" />
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.actionBtn, styles.approveBtn]}
                          onPress={() => handleOpenBankAction(item, 'verified')}
                        >
                          <Ionicons name="checkmark-circle" size={16} color="#047857" />
                          <Text style={styles.approveBtnText}>Mark Verified</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </>
      )}

      {/* ---------------- LEAVE DECISION MODAL ---------------- */}
      <Modal visible={!!selectedLeave} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {decisionAction === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </Text>
            <Text style={styles.modalSub}>
              {selectedLeave?.user_name} &bull; {selectedLeave?.leave_type} ({selectedLeave?.duration_days} days)
            </Text>

            <Text style={styles.commentLabel}>Decision Comment / Reason</Text>
            <TextInput
              style={styles.commentInput}
              multiline
              numberOfLines={3}
              value={decisionComment}
              onChangeText={setDecisionComment}
              placeholder="Add remark for the employee..."
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedLeave(null)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  decisionAction === 'approved' ? styles.confirmApprove : styles.confirmReject
                ]}
                onPress={handleSubmitDecision}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    Confirm {decisionAction === 'approved' ? 'Approval' : 'Rejection'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- ADVANCE ACTION / PAYMENT MODAL ---------------- */}
      <Modal visible={!!selectedAdvance} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {advanceActionType === 'approve'
                ? 'Approve Salary Advance'
                : advanceActionType === 'reject'
                ? 'Reject Salary Advance'
                : 'Record Advance Payment'}
            </Text>
            <Text style={styles.modalSub}>
              {selectedAdvance?.employeeName || 'Staff Member'} &bull; Requested: ₹{Number(selectedAdvance?.amount || 0).toLocaleString('en-IN')}
            </Text>

            {advanceActionType === 'approve' && (
              <>
                <Text style={styles.commentLabel}>Approved Amount (₹)</Text>
                <TextInput
                  style={[styles.commentInput, { minHeight: 44, marginBottom: 10 }]}
                  keyboardType="numeric"
                  value={advanceApprovedAmount}
                  onChangeText={setAdvanceApprovedAmount}
                  placeholder="Enter approved amount"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.commentLabel}>Approval Remarks</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  value={advanceRemarks}
                  onChangeText={setAdvanceRemarks}
                  placeholder="Notes for payroll and employee..."
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}

            {advanceActionType === 'reject' && (
              <>
                <Text style={styles.commentLabel}>Rejection Reason (Required)</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  value={advanceRemarks}
                  onChangeText={setAdvanceRemarks}
                  placeholder="Explain why this request cannot be approved..."
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}

            {advanceActionType === 'payment' && (
              <>
                <Text style={styles.commentLabel}>Payment Amount (₹)</Text>
                <TextInput
                  style={[styles.commentInput, { minHeight: 44, marginBottom: 8 }]}
                  keyboardType="numeric"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="Amount transferred"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.commentLabel}>UTR / Transaction Reference</Text>
                <TextInput
                  style={[styles.commentInput, { minHeight: 44, marginBottom: 8 }]}
                  value={paymentRef}
                  onChangeText={setPaymentRef}
                  placeholder="e.g. UTR1234567890"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.commentLabel}>Payment Remarks</Text>
                <TextInput
                  style={styles.commentInput}
                  multiline
                  value={paymentRemarks}
                  onChangeText={setPaymentRemarks}
                  placeholder="e.g. Paid via company ICICI account"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedAdvance(null)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  advanceActionType === 'reject' ? styles.confirmReject : styles.confirmApprove
                ]}
                onPress={handleSubmitAdvanceAction}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    Confirm {advanceActionType === 'payment' ? 'Payment Record' : advanceActionType === 'approve' ? 'Approval' : 'Rejection'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- BANK VERIFICATION MODAL ---------------- */}
      <Modal visible={!!selectedBank} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {bankAction === 'verified' ? 'Verify Bank Details' : 'Reject Bank Details'}
            </Text>
            <Text style={styles.modalSub}>
              {selectedBank?.accountHolderName} &bull; {selectedBank?.bankName} ({selectedBank?.maskedAccountNumber})
            </Text>

            <Text style={styles.commentLabel}>
              {bankAction === 'verified' ? 'Verification Notes' : 'Rejection Reason (Required)'}
            </Text>
            <TextInput
              style={styles.commentInput}
              multiline
              value={bankReviewNotes}
              onChangeText={setBankReviewNotes}
              placeholder={bankAction === 'verified' ? 'e.g. Verified with cancelled cheque' : 'e.g. Account number invalid or mismatch'}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSelectedBank(null)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  bankAction === 'verified' ? styles.confirmApprove : styles.confirmReject
                ]}
                onPress={handleSubmitBankAction}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    Confirm {bankAction === 'verified' ? 'Verification' : 'Rejection'}
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
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 11,
      color: colors.textSecondary
    },
    refreshBtn: {
      padding: 6
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border
    },
    filterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    filterTabText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary
    },
    filterTabTextActive: {
      color: '#ffffff'
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
      marginTop: 4
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
      marginBottom: 10
    },
    userName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    leaveType: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 2
    },
    statusTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6
    },
    statusPending: {
      backgroundColor: '#fef3c7'
    },
    statusApproved: {
      backgroundColor: '#d1fae5'
    },
    statusRejected: {
      backgroundColor: '#fee2e2'
    },
    statusTagText: {
      fontSize: 10,
      fontWeight: '700'
    },
    statusTextPending: {
      color: '#92400e'
    },
    statusTextApproved: {
      color: '#065f46'
    },
    statusTextRejected: {
      color: '#991b1b'
    },
    datesBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? '#1a2218' : '#f0f5ee',
      padding: 8,
      borderRadius: 8,
      marginBottom: 8
    },
    datesText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary
    },
    reasonText: {
      fontSize: 12,
      color: colors.textPrimary,
      lineHeight: 18
    },
    reasonLabel: {
      fontWeight: '700',
      color: colors.textSecondary
    },
    decisionCommentBox: {
      marginTop: 8,
      backgroundColor: isDark ? '#1f2937' : '#f3f4f6',
      padding: 8,
      borderRadius: 6
    },
    decisionCommentLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary
    },
    decisionCommentText: {
      fontSize: 11,
      color: colors.textPrimary,
      marginTop: 2
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
      gap: 6
    },
    rejectBtn: {
      backgroundColor: '#fee2e2'
    },
    rejectBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#b91c1c'
    },
    approveBtn: {
      backgroundColor: '#d1fae5'
    },
    approveBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#047857'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 20
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary
    },
    modalSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
      marginBottom: 14
    },
    commentLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 6
    },
    commentInput: {
      backgroundColor: isDark ? '#1a2218' : '#f7faf5',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      fontSize: 12,
      color: colors.textPrimary,
      textAlignVertical: 'top',
      minHeight: 70
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
      alignItems: 'center'
    },
    cancelBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary
    },
    confirmBtn: {
      flex: 1.5,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center'
    },
    confirmApprove: {
      backgroundColor: '#10b981'
    },
    confirmReject: {
      backgroundColor: '#ef4444'
    },
    confirmBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#ffffff'
    }
  });
