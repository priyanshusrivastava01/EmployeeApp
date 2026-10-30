import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import {
  mockHolidays,
  mockCoworkers,
  mockLeaveRequests,
  mockAdvanceRequests,
  mockTimesheets,
  mockAnnouncements,
  mockCompanyRules,
  mockCelebrations,
  mockNotifications,
  mockProfile
} from '../data/mockEmployeeData';
import { getProfilePhoto } from '../services/profilePhotoService';
import api from '../services/api';

function useScreenStyles() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  return { colors, isDark, styles };
}

// Common Sub-Screen Header with Back Navigation
export function SubScreenHeader({ title, subtitle, onBack, badge }) {
  const { colors, isDark } = useTheme();
  const headerStyles = getHeaderStyles(colors, isDark);
  return (
    <View style={headerStyles.header}>
      <TouchableOpacity style={headerStyles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={headerStyles.title}>{title}</Text>
        {subtitle && <Text style={headerStyles.subtitle}>{subtitle}</Text>}
      </View>
      {badge ? (
        <View style={headerStyles.demoBadge}>
          <Text style={headerStyles.demoBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Common Informational Banner
export function DemoBanner({ text = 'Company verified records • Live synchronized with organization server.' }) {
  const { colors, isDark } = useTheme();
  const bannerStyles = getBannerStyles(colors, isDark);
  return (
    <View style={bannerStyles.banner}>
      <Ionicons name="information-circle-outline" size={16} color={colors.darkOlive} style={{ marginTop: 1 }} />
      <Text style={bannerStyles.text}>{text}</Text>
    </View>
  );
}

// 1. PUBLIC HOLIDAYS SCREEN
export function HolidaysScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [holidays, setHolidays] = useState(mockHolidays);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getHolidays();
        if (res.success && res.data && res.data.length > 0) {
          const mapped = res.data.map((h, i) => ({
            id: h.id || `hol-${i}`,
            name: h.name,
            date: h.date || h.holiday_date,
            day: h.day || 'Holiday',
            type: h.type || 'Gazetted Public Holiday'
          }));
          setHolidays(mapped);
        }
      } catch (e) {
        // non-fatal fallback
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Public Holidays" subtitle="Official 2026 - 2027 calendar" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Company observed holidays. Shifts are not scheduled on gazetted dates." />

        <View style={styles.highlightCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={24} color={colors.darkOlive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.highlightTitle}>Next Holiday: {holidays[0]?.name || 'Diwali'}</Text>
            <Text style={styles.highlightSubtitle}>{holidays[0]?.date || 'Sunday, Nov 01, 2026'} • Official Holiday</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Upcoming Holidays ({holidays.length})</Text>
        {holidays.map((hol) => (
          <View key={hol.id} style={styles.itemCard}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeDay}>{String(hol.date).includes(' ') ? hol.date.split(' ')[1] : hol.date.slice(-2)}</Text>
              <Text style={styles.dateBadgeMonth}>{String(hol.date).includes(' ') ? hol.date.split(' ')[0] : 'Date'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardMainText}>{hol.name}</Text>
              <Text style={styles.cardSubText}>{hol.day} • {hol.type}</Text>
            </View>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 2. ADVANCE PAYMENT SCREEN
export function AdvancePaymentScreen({ onBack, currentUser }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [amount, setAmount] = useState('');
  const [reasonCategory, setReasonCategory] = useState('Medical / Emergency Expenses');
  const [reasonDescription, setReasonDescription] = useState('');
  const [tenure, setTenure] = useState('1 Month');
  const [requests, setRequests] = useState([]);
  const [userSalary, setUserSalary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const REASON_OPTIONS = [
    'Medical / Emergency Expenses',
    'Rent / Housing Expenses',
    'Education Expenses',
    'Family Emergency',
    'Personal Emergency',
    'Other'
  ];

  const loadAdvances = async () => {
    try {
      setIsLoading(true);
      const res = await api.getSalaryAdvances();
      if (res && res.success && res.data) {
        setRequests(res.data);
        if (res.monthlySalary !== undefined) {
          setUserSalary(res.monthlySalary);
        } else if (currentUser?.monthly_salary) {
          setUserSalary(currentUser.monthly_salary);
        }
      } else {
        setRequests(mockAdvanceRequests);
      }
    } catch (e) {
      console.warn('[AdvancePaymentScreen] Error loading advances:', e);
      setRequests(mockAdvanceRequests);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdvances();
    const store = api.getStore();
    const unsub = store.subscribe(() => {
      loadAdvances();
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    const cleanAmount = Number(amount.replace(/[^0-9]/g, ''));
    if (!amount.trim() || isNaN(cleanAmount) || cleanAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid numeric salary advance amount.');
      return;
    }
    if (cleanAmount > 100000) {
      Alert.alert('Limit Exceeded', 'Maximum single advance request limit is ₹1,00,000.');
      return;
    }
    if (reasonCategory === 'Other' && !reasonDescription.trim()) {
      Alert.alert('Description Required', 'Please provide a detailed explanation when selecting "Other" as the reason.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.submitSalaryAdvance({
        amount: cleanAmount,
        tenure,
        reasonCategory,
        reasonDescription: reasonDescription.trim() || undefined
      });

      if (res && res.success) {
        setAmount('');
        setReasonDescription('');
        setReasonCategory('Medical / Emergency Expenses');
        setSuccessMsg('Salary advance request submitted successfully for management approval.');
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadAdvances();
      } else {
        Alert.alert('Submission Failed', res?.error || 'Unable to submit advance request.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit salary advance request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Approved — Payment Pending':
      case 'Payment Pending':
        return { bg: isDark ? '#581c87' : '#f3e8ff', text: isDark ? '#c084fc' : '#7e22ce' };
      case 'Approved':
        return { bg: isDark ? '#14532d' : '#dcfce7', text: isDark ? '#4ade80' : '#15803d' };
      case 'Paid':
        return { bg: isDark ? '#064e3b' : '#ccfbf1', text: isDark ? '#2dd4bf' : '#0f766e' };
      case 'Partially Paid':
        return { bg: isDark ? '#7c2d12' : '#ffedd5', text: isDark ? '#fb923c' : '#c2410c' };
      case 'Rejected':
        return { bg: isDark ? '#7f1d1d' : '#fee2e2', text: isDark ? '#f87171' : '#b91c1c' };
      case 'Settled':
        return { bg: isDark ? '#1e3a8a' : '#dbeafe', text: isDark ? '#60a5fa' : '#1d4ed8' };
      case 'Pending Approval':
      default:
        return { bg: isDark ? '#78350f' : '#fef3c7', text: isDark ? '#fcd34d' : '#b45309' };
    }
  };

  // Compute financial totals across all requests
  const totalRequested = requests.reduce((sum, r) => sum + (Number(r.requested_amount || r.amount) || 0), 0);
  const totalApproved = requests.reduce((sum, r) => sum + (Number(r.approved_amount || r.approvedAmount) || 0), 0);
  const totalPaid = requests.reduce((sum, r) => sum + (Number(r.amount_paid || r.paidAmount) || 0), 0);
  const totalRepaid = requests.reduce((sum, r) => sum + (Number(r.amount_repaid) || 0), 0);
  const remainingDebt = Math.max(0, totalPaid - totalRepaid);
  const awaitingPayment = Math.max(0, totalApproved - totalPaid);

  const activeSalary = userSalary || currentUser?.monthly_salary || null;

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Advance Payment" subtitle="Salary advance & repayments" onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}>
        <View style={[styles.feedbackBanner, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderLeftColor: colors.primary }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={[styles.feedbackText, { color: colors.textPrimary, flex: 1, fontSize: 12 }]}>
            Salary advances require HR approval. Approval does NOT trigger salary deduction. Repayments begin only after finance records bank disbursement.
          </Text>
        </View>

        {successMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.feedbackText}>{successMsg}</Text>
          </View>
        )}

        {/* 1. Monthly Salary Configuration Card */}
        <View style={[styles.itemCard, { flexDirection: 'column', alignItems: 'stretch', marginBottom: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="cash" size={20} color={colors.primary} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>Official Monthly Salary</Text>
            </View>
            <View style={{
              backgroundColor: activeSalary ? (isDark ? '#14532d' : '#dcfce7') : (isDark ? '#374151' : '#f1f5f9'),
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: activeSalary ? '#15803d' : colors.textSecondary }}>
                {activeSalary ? 'Configured' : 'Pending Config'}
              </Text>
            </View>
          </View>

          {activeSalary ? (
            <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary }}>
                  ₹{Number(activeSalary).toLocaleString('en-IN')}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  Base Monthly Gross Salary
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                Currency: INR (₹)
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                Your monthly salary has not been configured yet. Please contact HR to set up official compensation records.
              </Text>
            </View>
          )}
        </View>

        {/* 2. Advance & Repayment Summary Grid */}
        <View style={[styles.itemCard, { flexDirection: 'column', alignItems: 'stretch', marginBottom: 14 }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 }}>
            Advance Summary & Balances
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>Total Disbursed (Paid)</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#10b981', marginTop: 2 }}>
                ₹{totalPaid.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>Outstanding Balance</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: remainingDebt > 0 ? '#ef4444' : colors.textPrimary, marginTop: 2 }}>
                ₹{remainingDebt.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>Total Deducted/Repaid</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 2 }}>
                ₹{totalRepaid.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: '45%', padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '600' }}>Awaiting Disbursement</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: awaitingPayment > 0 ? '#f59e0b' : colors.textSecondary, marginTop: 2 }}>
                ₹{awaitingPayment.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Request Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Request Salary Advance</Text>

          <Text style={styles.inputLabel}>Requested Amount (₹)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.inputLabel}>Repayment Period</Text>
          <View style={styles.pillRow}>
            {['1 Month', '2 Months', '3 Months'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.choicePill, tenure === t && styles.choicePillActive]}
                onPress={() => setTenure(t)}
              >
                <Text style={[styles.choicePillText, tenure === t && styles.choicePillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Reason for Advance</Text>
          <View style={{ gap: 6, marginBottom: 10 }}>
            {REASON_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => setReasonCategory(opt)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 9,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: reasonCategory === opt
                    ? (isDark ? '#2d3748' : '#e6f0eb')
                    : (isDark ? '#1a202c' : '#f8fafc'),
                  borderWidth: 1,
                  borderColor: reasonCategory === opt ? colors.primary : (isDark ? '#374151' : '#e2e8f0')
                }}
              >
                <Ionicons
                  name={reasonCategory === opt ? "radio-button-on" : "radio-button-off"}
                  size={16}
                  color={reasonCategory === opt ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <Text style={{
                  fontSize: 13,
                  fontWeight: reasonCategory === opt ? '600' : '400',
                  color: reasonCategory === opt ? colors.primary : colors.textPrimary
                }}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reasonCategory === 'Other' ? (
            <>
              <Text style={styles.inputLabel}>Detailed Justification (Required for 'Other')</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                placeholder="Explain the necessity and circumstances of the advance request..."
                placeholderTextColor={colors.textSecondary}
                multiline
                value={reasonDescription}
                onChangeText={setReasonDescription}
              />
            </>
          ) : (
            <>
              <Text style={styles.inputLabel}>Additional Notes (Optional)</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Any supplementary details for the approver..."
                placeholderTextColor={colors.textSecondary}
                multiline
                value={reasonDescription}
                onChangeText={setReasonDescription}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Submit Advance Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Month-by-Month Repayment Schedule Table */}
        {requests.some(r => r.status === 'Paid' || r.status === 'Partially Paid' || r.status === 'Settled' || Number(r.paidAmount || r.amount_paid) > 0) && (
          <View style={[styles.itemCard, { flexDirection: 'column', alignItems: 'stretch', marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                Month-by-Month Repayment Deduction Plan
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>
              Official monthly payroll deduction schedule for disbursed advances:
            </Text>

            {requests
              .filter(r => r.status === 'Paid' || r.status === 'Partially Paid' || r.status === 'Settled' || Number(r.paidAmount || r.amount_paid) > 0)
              .map(adv => {
                const tenureM = Number(adv.repayment_months) || (adv.tenure ? parseInt(adv.tenure) : 1);
                const paidV = Number(adv.paidAmount || adv.amount_paid) || 0;
                const repaidV = Number(adv.amount_repaid) || 0;
                const installmentV = Math.round(paidV / (tenureM || 1));
                const remainingV = Math.max(0, paidV - repaidV);

                return (
                  <View key={adv.id} style={{ marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        Disbursed: ₹{paidV.toLocaleString('en-IN')} ({tenureM} Mo)
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: remainingV === 0 ? '#10b981' : colors.primary }}>
                        {remainingV === 0 ? 'Settled' : `Balance: ₹${remainingV.toLocaleString('en-IN')}`}
                      </Text>
                    </View>

                    <View style={{ borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                      <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#334155' : '#e2e8f0', paddingVertical: 5, paddingHorizontal: 8 }}>
                        <Text style={{ flex: 1.2, fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>Salary Month</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' }}>Deduction</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' }}>Balance</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' }}>Status</Text>
                      </View>

                      {Array.from({ length: tenureM }).map((_, idx) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + idx);
                        const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        const monthTarget = Math.min(paidV, installmentV * (idx + 1));
                        const isRepaid = repaidV >= monthTarget;
                        const remAfter = Math.max(0, paidV - monthTarget);

                        return (
                          <View key={idx} style={{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#ffffff' }}>
                            <Text style={{ flex: 1.2, fontSize: 10, color: colors.textPrimary, fontWeight: '500' }}>{monthStr}</Text>
                            <Text style={{ flex: 1, fontSize: 10, color: colors.textPrimary, textAlign: 'right' }}>₹{installmentV.toLocaleString('en-IN')}</Text>
                            <Text style={{ flex: 1, fontSize: 10, color: colors.textSecondary, textAlign: 'right' }}>₹{remAfter.toLocaleString('en-IN')}</Text>
                            <Text style={{ flex: 1, fontSize: 10, color: isRepaid ? '#10b981' : '#f59e0b', textAlign: 'right', fontWeight: '600' }}>
                              {isRepaid ? 'Deducted' : 'Scheduled'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
          <Text style={styles.sectionHeading}>Request History</Text>
          <TouchableOpacity onPress={loadAdvances} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="refresh" size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : requests.length === 0 ? (
          <View style={[styles.itemCard, { alignItems: 'center', paddingVertical: 24 }]}>
            <Ionicons name="wallet-outline" size={36} color={colors.textSecondary} />
            <Text style={[styles.cardMainText, { marginTop: 8 }]}>No Advance Requests</Text>
            <Text style={[styles.cardSubText, { textAlign: 'center', marginTop: 4 }]}>
              You have not submitted any salary advance requests yet.
            </Text>
          </View>
        ) : (
          requests.map(req => {
            const badge = getStatusBadgeStyle(req.status);
            const formattedAmount = typeof req.amount === 'number'
              ? `₹${req.amount.toLocaleString('en-IN')}`
              : req.amount;
            const formattedApproved = req.approvedAmount
              ? `₹${Number(req.approvedAmount).toLocaleString('en-IN')}`
              : null;
            const formattedPaid = req.paidAmount
              ? `₹${Number(req.paidAmount).toLocaleString('en-IN')}`
              : null;

            return (
              <View key={req.id} style={[styles.itemCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={[styles.cardMainText, { fontSize: 17 }]}>{formattedAmount}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Requested: {req.requestedDate || req.created_at || 'Recent'}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: badge.bg,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: badge.text }}>
                      {req.status === 'Approved' ? 'Approved — Payment Pending' : req.status}
                    </Text>
                  </View>
                </View>

                {/* Reason & Category */}
                <View style={{ marginTop: 8, padding: 8, borderRadius: 6, backgroundColor: isDark ? '#1f2937' : '#f8fafc' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                    Reason: {req.reasonCategory || req.reason || 'General Need'}
                  </Text>
                  {req.reasonDescription ? (
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                      {req.reasonDescription}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                    Tenure: {req.tenure || '1 Month'}
                  </Text>
                </View>

                {/* Approvals and Financials */}
                {(formattedApproved || formattedPaid || req.approvalRemarks || req.rejectionReason) && (
                  <View style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 6,
                    backgroundColor: isDark ? '#111827' : '#f1f5f9',
                    borderLeftWidth: 3,
                    borderLeftColor: req.status === 'Rejected' ? '#ef4444' : colors.primary
                  }}>
                    {formattedApproved && (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                        Approved Amount: {formattedApproved} {req.approvedBy ? `(by ${req.approvedBy})` : ''}
                      </Text>
                    )}
                    {formattedPaid && (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#10b981', marginTop: 2 }}>
                        Paid Amount: {formattedPaid} {req.paidDate ? `on ${req.paidDate}` : ''}
                      </Text>
                    )}
                    {req.transactionRef && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        UTR / Transaction Ref: <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{req.transactionRef}</Text>
                      </Text>
                    )}
                    {req.approvalRemarks && (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' }}>
                        Note: {req.approvalRemarks}
                      </Text>
                    )}
                    {req.rejectionReason && (
                      <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>
                        Rejection Reason: {req.rejectionReason}
                      </Text>
                    )}
                  </View>
                )}

                {/* View Receipt Proof button if available */}
                {(req.receiptUrl || req.transactionRef) && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 8,
                      alignSelf: 'flex-start'
                    }}
                    onPress={() => setSelectedReceipt(req)}
                  >
                    <Ionicons name="receipt-outline" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                      View Payment Proof / UTR
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Payment Proof Modal */}
      <Modal
        visible={!!selectedReceipt}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReceipt(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20
        }}>
          <View style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderRadius: 16,
            padding: 20,
            elevation: 5
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }}>
                Payment Confirmation
              </Text>
              <TouchableOpacity onPress={() => setSelectedReceipt(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 8, paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Amount Paid:</Text>
                <Text style={{ fontWeight: 'bold', color: colors.textPrimary, fontSize: 14 }}>
                  ₹{Number(selectedReceipt?.paidAmount || selectedReceipt?.amount || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Payment Date:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  {selectedReceipt?.paidDate || 'Recorded by Accounts'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Method:</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 13 }}>
                  {selectedReceipt?.paymentMethod || 'Bank Transfer (NEFT/IMPS)'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>UTR / Ref No:</Text>
                <Text style={{ fontFamily: 'monospace', fontWeight: 'bold', color: colors.primary, fontSize: 13 }}>
                  {selectedReceipt?.transactionRef || 'N/A'}
                </Text>
              </View>
              {selectedReceipt?.receiptUrl ? (
                <View style={{ marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Payment Receipt:</Text>
                  <Image
                    source={{ uri: selectedReceipt.receiptUrl }}
                    style={{ width: '100%', height: 160, borderRadius: 8, resizeMode: 'contain', backgroundColor: '#000000' }}
                  />
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 8,
                paddingVertical: 10,
                alignItems: 'center',
                marginTop: 14
              }}
              onPress={() => setSelectedReceipt(null)}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 3. CO-WORKERS DIRECTORY SCREEN
export function CoworkersScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [userProfilePhoto, setUserProfilePhoto] = useState(null);
  const [coworkers, setCoworkers] = useState(mockCoworkers);

  useEffect(() => {
    (async () => {
      try {
        const photo = await getProfilePhoto();
        if (photo?.uri) {
          setUserProfilePhoto(photo.uri);
        }
      } catch (e) {
        // non-fatal
      }

      try {
        const res = await api.getUsers();
        if (res.success && res.data && res.data.length > 0) {
          const mapped = res.data.map(u => ({
            id: u.id,
            name: u.name,
            designation: u.designation || (u.role === 'founder' ? 'Founder' : u.role === 'admin' ? 'Admin' : u.role === 'team_leader' ? 'Team Lead' : 'Staff Member'),
            department: u.department || 'Operations',
            email: u.email,
            status: u.is_active ? 'Active' : 'Pending',
            avatar: u.profile_photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=84764B&color=fff`
          }));
          setCoworkers(mapped);
        }
      } catch (e) {
        // non-fatal fallback
      }
    })();
  }, []);

  const filtered = coworkers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.designation.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'All' || c.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Co-workers" subtitle="Company staff directory" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Company staff directory. Displaying employee profile photos (never biometric reference photos or private GPS data)." />

        {/* Search & Filter */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or role..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {['All', 'Engineering', 'Operations', 'Design', 'Marketing'].map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, deptFilter === d && styles.filterChipActive]}
              onPress={() => setDeptFilter(d)}
            >
              <Text style={[styles.filterChipText, deptFilter === d && styles.filterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionHeading}>Team Members ({filtered.length})</Text>
        {filtered.map(emp => {
          const isCurrentUser = emp.name === mockProfile.name || emp.id === 'emp-1';
          const avatarUri = isCurrentUser && userProfilePhoto ? userProfilePhoto : emp.avatar;

          return (
            <View key={emp.id} style={styles.coworkerCard}>
              <Image source={{ uri: avatarUri }} style={styles.coworkerAvatar} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.cardMainText}>{emp.name}</Text>
                    {isCurrentUser && (
                      <View style={{ backgroundColor: colors.lightOlive, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: colors.darkOlive }}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.statusTag, emp.status.includes('WFO') ? styles.tagSuccess : emp.status.includes('WFH') ? styles.tagPurple : styles.tagWarn]}>
                    {emp.status}
                  </Text>
                </View>
                <Text style={styles.cardSubText}>{emp.designation}</Text>
                <Text style={styles.metaText}>{emp.department} • {emp.email}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// 4. LEAVE APPLICATION SCREEN
export function LeaveApplicationScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState('1');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [requests, setRequests] = useState(mockLeaveRequests);
  const [successMsg, setSuccessMsg] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar Modal Picker State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [targetDateField, setTargetDateField] = useState('start'); // 'start' or 'end'
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()); // 0-11

  const loadLeaves = async () => {
    try {
      const res = await api.getLeaves();
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(l => ({
          id: l.id,
          type: l.leave_type || 'Casual Leave',
          dates: l.start_date === l.end_date ? l.start_date : `${l.start_date} — ${l.end_date}`,
          days: l.duration_days || 1,
          reason: l.reason,
          notes: l.review_remarks || 'None',
          status: l.status?.toLowerCase() === 'approved'
            ? 'Approved'
            : l.status?.toLowerCase() === 'rejected'
            ? 'Rejected'
            : 'Pending TL Approval',
          appliedOn: l.created_at ? new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Today'
        }));
        setRequests(mapped);
      }
    } catch (e) {
      // non-fatal fallback
    }
  };

  useEffect(() => {
    loadLeaves();
    const store = api.getStore();
    const unsub = store.subscribe(() => {
      loadLeaves();
    });
    return () => unsub();
  }, []);

  /**
   * Parse and validate DD/MM/YYYY date
   * Rejects impossible dates like 31/02/2026 or 31/04/2026
   */
  const parseDateDDMMYYYY = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const trimmed = dateStr.trim();
    const parts = trimmed.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (month < 1 || month > 12) return null;
    if (year < 2020 || year > 2040) return null;

    // Check maximum days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;

    const parsed = new Date(year, month - 1, day);
    // Ensure no timezone skew
    if (parsed.getDate() !== day || parsed.getMonth() !== month - 1 || parsed.getFullYear() !== year) {
      return null;
    }
    return parsed;
  };

  // Auto-calculate days when start or end date changes
  useEffect(() => {
    setValidationError(null);
    if (!startDate.trim()) {
      setDaysCount('1');
      return;
    }

    const sDate = parseDateDDMMYYYY(startDate);
    if (!sDate) {
      if (startDate.trim().length >= 10) {
        setValidationError('Invalid Start Date format or impossible calendar date. Use DD/MM/YYYY.');
      }
      return;
    }

    if (!endDate.trim()) {
      setDaysCount('1');
      return;
    }

    const eDate = parseDateDDMMYYYY(endDate);
    if (!eDate) {
      if (endDate.trim().length >= 10) {
        setValidationError('Invalid End Date format or impossible calendar date. Use DD/MM/YYYY.');
      }
      return;
    }

    if (eDate.getTime() < sDate.getTime()) {
      setValidationError('End Date cannot precede Start Date.');
      setDaysCount('1');
      return;
    }

    const diffDays = Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    setDaysCount(String(diffDays));
  }, [startDate, endDate]);

  const handleOpenCalendar = (field) => {
    setTargetDateField(field);
    const currentDate = field === 'start' ? parseDateDDMMYYYY(startDate) : parseDateDDMMYYYY(endDate);
    if (currentDate) {
      setViewYear(currentDate.getFullYear());
      setViewMonth(currentDate.getMonth());
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setCalendarVisible(true);
  };

  const handleSelectCalendarDay = (dayNum) => {
    const dStr = String(dayNum).padStart(2, '0');
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const yStr = String(viewYear);
    const formatted = `${dStr}/${mStr}/${yStr}`;

    if (targetDateField === 'start') {
      setStartDate(formatted);
    } else {
      setEndDate(formatted);
    }
    setCalendarVisible(false);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setDaysCount('1');
    setReason('');
    setNotes('');
    setValidationError(null);
  };

  const handleSubmit = async () => {
    setValidationError(null);
    if (!startDate.trim()) {
      Alert.alert('Start Date Required', 'Please enter or select a leave start date (DD/MM/YYYY).');
      return;
    }

    const parsedStart = parseDateDDMMYYYY(startDate);
    if (!parsedStart) {
      Alert.alert('Invalid Start Date', 'Please enter a valid Start Date in DD/MM/YYYY format (e.g., 28/10/2026). Impossible dates like 31/02/2026 are not accepted.');
      return;
    }

    let parsedEnd = parsedStart;
    if (endDate.trim()) {
      parsedEnd = parseDateDDMMYYYY(endDate);
      if (!parsedEnd) {
        Alert.alert('Invalid End Date', 'Please enter a valid End Date in DD/MM/YYYY format or clear the field.');
        return;
      }
      if (parsedEnd.getTime() < parsedStart.getTime()) {
        Alert.alert('Date Conflict', 'End Date cannot precede Start Date.');
        return;
      }
    }

    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a clear reason for your leave application.');
      return;
    }

    const calculatedDays = Math.round((parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const finalEndDateStr = endDate.trim() || startDate.trim();
    const dateRange = finalEndDateStr !== startDate.trim()
      ? `${startDate.trim()} — ${finalEndDateStr}`
      : startDate.trim();

    try {
      setIsSubmitting(true);
      const res = await api.submitLeave({
        leaveType,
        startDate: startDate.trim(),
        endDate: finalEndDateStr,
        durationDays: calculatedDays,
        reason: reason.trim()
      });

      if (res.success && res.data) {
        const l = res.data;
        const newLeave = {
          id: l.id,
          type: l.leave_type || leaveType,
          dates: dateRange,
          days: calculatedDays,
          reason: reason.trim(),
          notes: 'None',
          status: 'Pending TL Approval',
          appliedOn: 'Today'
        };
        setRequests(prev => [newLeave, ...prev]);
        handleReset();
        setSuccessMsg(`Leave application for ${calculatedDays} day(s) submitted for management review.`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        Alert.alert('Error', res.error || 'Failed to submit leave.');
      }
    } catch (err) {
      const newLeave = {
        id: 'lv-' + Date.now(),
        type: leaveType,
        dates: dateRange,
        days: calculatedDays,
        reason: reason.trim(),
        notes: notes.trim() || 'None',
        status: 'Pending TL Approval',
        appliedOn: 'Today'
      };
      setRequests(prev => [newLeave, ...prev]);
      handleReset();
      setSuccessMsg('Leave request recorded. Pending server sync.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calendar Month Helper
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Leave Application" subtitle="Apply & balance tracking" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Leave requests submitted here sync directly to the Management Leave Desk for Founder & Team Leader approval." />

        {successMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.feedbackText}>{successMsg}</Text>
          </View>
        )}

        {validationError && (
          <View style={[styles.feedbackBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FBEBEB', borderColor: '#EF4444' }]}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={[styles.feedbackText, { color: '#EF4444' }]}>{validationError}</Text>
          </View>
        )}

        {/* Leave Balances */}
        <View style={styles.balanceGrid}>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Casual Leave</Text>
            <Text style={styles.balanceValue}>4 Left</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Sick Leave</Text>
            <Text style={styles.balanceValue}>5 Left</Text>
          </View>
          <View style={styles.balanceBox}>
            <Text style={styles.balanceLabel}>Earned Leave</Text>
            <Text style={styles.balanceValue}>12 Left</Text>
          </View>
        </View>

        {/* Leave Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Apply for Leave</Text>

          <Text style={styles.inputLabel}>Leave Type</Text>
          <View style={styles.pillRow}>
            {['Casual Leave', 'Sick Leave', 'Earned Leave', 'Unpaid Leave'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.choicePill, leaveType === t && styles.choicePillActive]}
                onPress={() => setLeaveType(t)}
              >
                <Text style={[styles.choicePillText, leaveType === t && styles.choicePillTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Selection: Manual Typing (DD/MM/YYYY) + Calendar Picker Modal */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Start Date */}
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Start Date * (DD/MM/YYYY)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, paddingRight: 40 }]}
                  placeholder="28/10/2026"
                  placeholderTextColor={colors.textSecondary}
                  value={startDate}
                  onChangeText={setStartDate}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={{ position: 'absolute', right: 10, padding: 6 }}
                  onPress={() => handleOpenCalendar('start')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* End Date */}
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>End Date (Optional)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1, paddingRight: 40 }]}
                  placeholder="29/10/2026"
                  placeholderTextColor={colors.textSecondary}
                  value={endDate}
                  onChangeText={setEndDate}
                  keyboardType="numeric"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={{ position: 'absolute', right: 10, padding: 6 }}
                  onPress={() => handleOpenCalendar('end')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Total Days Display */}
          <View style={{ marginTop: 8 }}>
            <Text style={styles.inputLabel}>Total Leave Duration</Text>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                {daysCount} Day{Number(daysCount) > 1 ? 's' : ''} (Calculated)
              </Text>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </View>
          </View>

          <Text style={styles.inputLabel}>Reason for Leave *</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Brief reason for your absence (e.g., family function, sick recovery)..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={reason}
            onChangeText={setReason}
          />

          <Text style={styles.inputLabel}>Additional Notes / Emergency Contact (Optional)</Text>
          <TextInput
            style={[styles.input, { height: 50, textAlignVertical: 'top' }]}
            placeholder="Available on phone / emergency contact..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: colors.beige,
                borderWidth: 1,
                borderColor: colors.border
              }}
              onPress={handleReset}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Cancel / Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 2, marginTop: 0 }]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#ffffff" />
                  <Text style={styles.primaryBtnText}>Submit Application</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeading}>My Leave Requests</Text>
        {requests.map(lv => (
          <View key={lv.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.cardMainText}>{lv.type}</Text>
                <Text style={[
                  styles.statusTag,
                  lv.status === 'Approved'
                    ? styles.tagSuccess
                    : (lv.status === 'Rejected' ? styles.tagDanger : styles.tagPending)
                ]}>
                  {lv.status}
                </Text>
              </View>
              <Text style={styles.cardSubText}>{lv.dates} ({lv.days} day{lv.days > 1 ? 's' : ''})</Text>
              <Text style={styles.metaText}>Reason: {lv.reason} • Applied: {lv.appliedOn}</Text>
              {lv.rejectionReason && (
                <Text style={{ fontSize: 11, color: colors.danger, marginTop: 2 }}>Note: {lv.rejectionReason}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── CALENDAR DATE PICKER MODAL ── */}
      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.formTitle}>
                  Select {targetDateField === 'start' ? 'Start Date' : 'End Date'}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {monthNames[viewMonth]} {viewYear}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCalendarVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Month Navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11);
                    setViewYear(y => y - 1);
                  } else {
                    setViewMonth(m => m - 1);
                  }
                }}
                style={{ padding: 6, borderRadius: 6, backgroundColor: colors.beige }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
                {monthNames[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0);
                    setViewYear(y => y + 1);
                  } else {
                    setViewMonth(m => m + 1);
                  }
                }}
                style={{ padding: 6, borderRadius: 6, backgroundColor: colors.beige }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
                <Text key={idx} style={{ width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
                  {w}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <View key={`empty-${i}`} style={{ width: `${100 / 7}%`, height: 38 }} />
              ))}
              {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateCandidate = `${String(dayNum).padStart(2, '0')}/${String(viewMonth + 1).padStart(2, '0')}/${viewYear}`;
                const isSelected = targetDateField === 'start' ? startDate === dateCandidate : endDate === dateCandidate;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={{
                      width: `${100 / 7}%`,
                      height: 38,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginVertical: 2
                    }}
                    onPress={() => handleSelectCalendarDay(dayNum)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? '800' : '600',
                          color: isSelected ? '#ffffff' : colors.text
                        }}
                      >
                        {dayNum}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.modalDoneBtn, { marginTop: 14 }]}
              onPress={() => setCalendarVisible(false)}
            >
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 5. ADD TIMESHEET SCREEN
export function TimesheetScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [project, setProject] = useState('Android Mobile App');
  const [hours, setHours] = useState('8.0');
  const [activity, setActivity] = useState('');
  const [timesheets, setTimesheets] = useState(mockTimesheets);
  const [successMsg, setSuccessMsg] = useState(null);

  const loadTimesheets = async () => {
    try {
      const res = await api.getTimesheets();
      if (res.success && res.data && res.data.length > 0) {
        const mapped = res.data.map(t => ({
          id: t.id,
          date: t.work_date || 'Today',
          project: t.project_name || 'Project',
          hours: String(t.hours_spent || 8),
          activity: t.task_description || ''
        }));
        setTimesheets(mapped);
      }
    } catch (e) {
      // non-fatal fallback
    }
  };

  useEffect(() => {
    loadTimesheets();
  }, []);

  const handleAdd = async () => {
    if (!activity.trim()) {
      Alert.alert('Activity Required', 'Please enter a description of the work completed.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const parsedHours = parseFloat(hours) || 8.0;

    try {
      const res = await api.submitTimesheet({
        workDate: todayStr,
        projectName: project,
        taskDescription: activity.trim(),
        hoursSpent: parsedHours
      });

      if (res.success && res.data) {
        const newEntry = {
          id: res.data.id,
          date: res.data.work_date,
          project: res.data.project_name,
          hours: String(res.data.hours_spent),
          activity: res.data.task_description
        };
        setTimesheets(prev => [newEntry, ...prev]);
        setActivity('');
        setSuccessMsg('Timesheet entry logged & synced to server.');
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      const newEntry = {
        id: 'ts-' + Date.now(),
        date: todayStr,
        project: project,
        hours: hours.trim() || '8.0',
        activity: activity.trim()
      };
      setTimesheets(prev => [newEntry, ...prev]);
      setActivity('');
      setSuccessMsg('Timesheet entry logged locally.');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const totalWeeklyHours = timesheets.reduce((acc, t) => acc + (parseFloat(t.hours) || 0), 0);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Project Timesheet" subtitle="Effort tracking & activity log" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Purpose Explanation Card */}
        <View style={{
          backgroundColor: isDark ? 'rgba(163, 184, 121, 0.1)' : colors.lightOlive,
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>Effort Tracking • Optional</Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            Timesheets record how your working hours are allocated across client projects and development activities for effort tracking and billing. This module is optional and does NOT replace your verified attendance Punch In/Out or the Daily Task Summary spreadsheet.
          </Text>
        </View>

        {successMsg && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.feedbackText}>{successMsg}</Text>
          </View>
        )}

        {/* Weekly Meter */}
        <View style={styles.highlightCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="timer" size={24} color={colors.darkOlive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.highlightTitle}>This Week: {totalWeeklyHours.toFixed(1)} / 40.0 hrs</Text>
            <Text style={styles.highlightSubtitle}>Standard target: 8.0 hrs/day (Mon — Fri)</Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Log Project Effort</Text>

          <Text style={styles.inputLabel}>Select Project</Text>
          <View style={styles.pillRow}>
            {['Android Mobile App', 'EMS Web Dashboard', 'API Backend'].map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.choicePill, project === p && styles.choicePillActive]}
                onPress={() => setProject(p)}
              >
                <Text style={[styles.choicePillText, project === p && styles.choicePillTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Hours Spent Today</Text>
          <TextInput
            style={styles.input}
            placeholder="8.0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={hours}
            onChangeText={setHours}
          />

          <Text style={styles.inputLabel}>Activity Summary</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Details of code commits, meetings, bug fixes..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={activity}
            onChangeText={setActivity}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={16} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Log Timesheet Entry</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeading}>Logged Entries ({timesheets.length})</Text>
        {timesheets.map(t => (
          <View key={t.id} style={styles.itemCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.cardMainText}>{t.project}</Text>
                <Text style={[styles.statusTag, styles.tagSuccess]}>{t.hours} hrs</Text>
              </View>
              <Text style={styles.cardSubText}>{t.activity}</Text>
              <Text style={styles.metaText}>Date: {t.date}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 6. ANNOUNCEMENTS SCREEN (FOUNDER/ADMIN PUBLISHED)
export function AnnouncementsScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [readMap, setReadMap] = useState({});
  const [announcements, setAnnouncements] = useState(mockAnnouncements);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getAnnouncements(true);
        if (res.success && res.data && res.data.length > 0) {
          const mapped = res.data.map(a => ({
            id: a.id,
            title: a.title,
            priority: (a.priority || 'Medium').charAt(0).toUpperCase() + (a.priority || 'medium').slice(1),
            date: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            content: a.message || a.content,
            author: a.author_name || 'Founder & Operations'
          }));
          setAnnouncements(mapped);
        }
      } catch (e) {
        // non-fatal fallback
      }
    })();
  }, []);

  const toggleRead = (id) => {
    setReadMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Announcements" subtitle="Official company broadcasts" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Official broadcasts published by Founder & Operations. Tap an announcement to view full details." />

        {announcements.map(ann => {
          const isRead = !!readMap[ann.id];
          return (
            <TouchableOpacity
              key={ann.id}
              style={[
                styles.announcementCard,
                isRead && { opacity: 0.75, backgroundColor: isDark ? colors.cardSubtle : '#FAFAFA' }
              ]}
              onPress={() => setSelectedAnnouncement(ann)}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.priorityTag, ann.priority === 'High' ? styles.tagDanger : styles.tagInfo]}>
                    {ann.priority.toUpperCase()} PRIORITY
                  </Text>
                  {!isRead && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  )}
                </View>
                <Text style={styles.metaText}>{ann.date}</Text>
              </View>

              <Text style={styles.announcementTitle}>{ann.title}</Text>
              <Text style={styles.announcementBody} numberOfLines={2}>{ann.content}</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={styles.announcementAuthor}>Broadcast by: {ann.author}</Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleRead(ann.id);
                  }}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                    {isRead ? 'Mark Unread' : 'Mark Read'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Announcement Detail Modal */}
      <Modal
        visible={!!selectedAnnouncement}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAnnouncement(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedAnnouncement && (
              <>
                <View style={styles.modalHeaderRow}>
                  <Text style={[styles.priorityTag, selectedAnnouncement.priority === 'High' ? styles.tagDanger : styles.tagInfo]}>
                    {selectedAnnouncement.priority.toUpperCase()} PRIORITY
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedAnnouncement(null)} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.announcementTitle, { fontSize: 17, marginTop: 8 }]}>
                  {selectedAnnouncement.title}
                </Text>
                <Text style={styles.metaText}>
                  Published: {selectedAnnouncement.date} • By: {selectedAnnouncement.author}
                </Text>

                <View style={{ marginVertical: 14, padding: 12, backgroundColor: colors.beige, borderRadius: 10 }}>
                  <Text style={[styles.announcementBody, { fontSize: 13, lineHeight: 20 }]}>
                    {selectedAnnouncement.content}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => {
                    if (selectedAnnouncement) {
                      setReadMap(prev => ({ ...prev, [selectedAnnouncement.id]: true }));
                    }
                    setSelectedAnnouncement(null);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalDoneBtnText}>Close Announcement</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 7. NOTES & RULES SCREEN (ORGANIZED INTO CATEGORIES)
export function CompanyRulesScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [rules, setRules] = useState(mockCompanyRules);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getRules(true);
        if (res.success && res.data && res.data.length > 0) {
          const mapped = res.data.map(r => ({
            id: r.id,
            category: r.category || 'General',
            summary: r.title ? `${r.title}: ${r.summary || r.description || ''}` : (r.summary || r.description),
            icon: r.category?.toLowerCase().includes('geofence') ? 'navigate-outline' :
                  r.category?.toLowerCase().includes('remote') ? 'home-outline' :
                  r.category?.toLowerCase().includes('ethic') ? 'shield-outline' : 'book-outline'
          }));
          setRules(mapped);
        }
      } catch (e) {
        // non-fatal fallback
      }
    })();
  }, []);

  const categories = ['All', 'Attendance', 'Geofence', 'Remote Work', 'Ethics'];

  const filteredRules = rules.filter(r => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Attendance') return r.category.toLowerCase().includes('attendance') || r.category.toLowerCase().includes('punch');
    if (selectedCategory === 'Geofence') return r.category.toLowerCase().includes('geofence') || r.category.toLowerCase().includes('radius');
    if (selectedCategory === 'Remote Work') return r.category.toLowerCase().includes('remote') || r.category.toLowerCase().includes('wfh');
    if (selectedCategory === 'Ethics') return r.category.toLowerCase().includes('ethic') || r.category.toLowerCase().includes('conduct');
    return true;
  });

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Notes & Rules" subtitle="Company policies & guidelines" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Official EMS guidelines published by Founder & Management. All employees are required to adhere to these operating principles." />

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionHeading}>Official Policies ({filteredRules.length})</Text>
        {filteredRules.map(rule => (
          <View key={rule.id} style={styles.ruleCard}>
            <View style={styles.iconCircle}>
              <Ionicons name={rule.icon || 'book-outline'} size={22} color={colors.darkOlive} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <Text style={styles.ruleCategory}>{rule.category}</Text>
                <View style={{ backgroundColor: colors.lightOlive, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: colors.darkOlive }}>EFFECTIVE 2026</Text>
                </View>
              </View>
              <Text style={styles.ruleSummary}>{rule.summary}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 8. CELEBRATIONS SCREEN
export function CelebrationsScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [wished, setWished] = useState({});

  const handleSendWish = (id, name) => {
    setWished(prev => ({ ...prev, [id]: true }));
    Alert.alert('Wish Sent!', `Your celebration wishes have been shared with ${name}.`);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Celebrations" subtitle="Birthdays & work anniversaries" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <DemoBanner text="Monthly milestones for team members in October and November." />
        {mockCelebrations.map(cel => (
          <View key={cel.id} style={styles.coworkerCard}>
            <Image source={{ uri: cel.avatar }} style={styles.coworkerAvatar} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardMainText}>{cel.name}</Text>
                <Text style={[styles.statusTag, cel.type === 'Birthday' ? styles.tagPink : styles.tagPurple]}>
                  {cel.type}
                </Text>
              </View>
              <Text style={styles.cardSubText}>{cel.note} • {cel.date}</Text>
            </View>
            <TouchableOpacity
              style={[styles.wishBtn, wished[cel.id] && styles.wishBtnDone]}
              onPress={() => handleSendWish(cel.id, cel.name)}
              disabled={wished[cel.id]}
            >
              <Ionicons name={wished[cel.id] ? 'checkmark' : 'gift-outline'} size={15} color="#ffffff" />
              <Text style={styles.wishBtnText}>{wished[cel.id] ? 'Wished' : 'Wish'}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// 9. NOTIFICATIONS SCREEN
export function NotificationsScreen({ onBack }) {
  const { colors, isDark, styles } = useScreenStyles();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await api.getNotifications();
      if (res && res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
      } else {
        setNotifications(mockNotifications);
      }
    } catch (e) {
      setNotifications(mockNotifications);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const store = api.getStore();
    const unsub = store.subscribe(() => {
      loadNotifications();
    });
    return () => unsub();
  }, []);

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleNotificationPress = async (notif) => {
    if (notif.unread) {
      await api.markNotificationRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
    }
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Notifications" subtitle="System alerts & updates" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionHeading}>Recent Updates</Text>
          {notifications.some(n => n.unread) && (
            <TouchableOpacity onPress={handleMarkAllRead}>
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>Loading alerts...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={42} color={colors.textSecondary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10 }}>You're all caught up</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>No notifications found.</Text>
          </View>
        ) : (
          notifications.map(notif => (
            <TouchableOpacity
              key={notif.id}
              activeOpacity={0.7}
              onPress={() => handleNotificationPress(notif)}
              style={[styles.itemCard, notif.unread && { borderColor: colors.primary, backgroundColor: isDark ? '#1a2218' : '#f0f4eb' }]}
            >
              <Ionicons
                name={notif.unread ? 'ellipse' : 'checkmark-done'}
                size={14}
                color={notif.unread ? colors.primary : colors.textSecondary}
                style={{ marginTop: 4 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardMainText, notif.unread && { fontWeight: '800' }]}>{notif.title}</Text>
                <Text style={styles.cardSubText}>{notif.text || notif.message}</Text>
                <Text style={styles.metaText}>{notif.time || 'Recent'}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const getHeaderStyles = (colors, isDark) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary
  },
  demoBadge: {
    backgroundColor: colors.lightOlive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.darkOlive
  }
});

const getBannerStyles = (colors, isDark) => StyleSheet.create({
  banner: {
    backgroundColor: colors.lightOlive,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: colors.darkOlive,
    lineHeight: 16
  }
});

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36
  },
  highlightCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.lightOlive,
    alignItems: 'center',
    justifyContent: 'center'
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  highlightSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  dateBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dateBadgeDay: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.darkOlive
  },
  dateBadgeMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase'
  },
  cardMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  cardSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  metaText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  tagSuccess: {
    backgroundColor: colors.lightOlive,
    color: colors.darkOlive
  },
  tagPending: {
    backgroundColor: '#FAF4E8',
    color: '#C28424'
  },
  tagPurple: {
    backgroundColor: colors.lightOlive,
    color: colors.darkOlive
  },
  tagPink: {
    backgroundColor: colors.lightOlive,
    color: colors.primary
  },
  tagWarn: {
    backgroundColor: '#FBEBEB',
    color: '#C0392B'
  },
  priorityTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  tagDanger: {
    backgroundColor: '#FBEBEB',
    color: '#C0392B'
  },
  tagInfo: {
    backgroundColor: colors.lightOlive,
    color: colors.darkOlive
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  balanceBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.textSecondary
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    marginTop: 8
  },
  input: {
    backgroundColor: colors.beige,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  choicePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  choicePillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  choicePillTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13
  },
  feedbackBanner: {
    backgroundColor: colors.lightOlive,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14
  },
  feedbackText: {
    color: colors.darkOlive,
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: 8,
    fontSize: 13
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  coworkerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  coworkerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.beige
  },
  wishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  wishBtnDone: {
    backgroundColor: colors.beige,
    borderWidth: 1,
    borderColor: colors.border
  },
  wishBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  announcementCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6
  },
  announcementBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: 8
  },
  announcementAuthor: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600'
  },
  ruleCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  ruleCategory: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  ruleSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalCloseBtn: {
    padding: 4
  },
  modalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  },
  modalDoneBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff'
  }
});
