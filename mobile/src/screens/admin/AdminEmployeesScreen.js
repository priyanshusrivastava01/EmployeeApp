import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import api from '../../services/api';

export default function AdminEmployeesScreen({ onBack, user }) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const isTeamLeader = user?.role === 'team_leader';
  const isFounder = user?.role === 'founder';

  const [activeTab, setActiveTab] = useState('staff'); // 'staff' | 'invitations'
  const [employees, setEmployees] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [orgSettings, setOrgSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [newDepartment, setNewDepartment] = useState('Engineering');
  const [newDesignation, setNewDesignation] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Invitation Result Modal
  const [createdInviteResult, setCreatedInviteResult] = useState(null);

  // Selected Employee Detail Modal
  const [selectedUser, setSelectedUser] = useState(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [usersRes, orgRes] = await Promise.all([
        api.getUsers(),
        api.getOrgSettings().catch(() => null)
      ]);

      if (usersRes.success && usersRes.data) {
        setEmployees(usersRes.data);
      }
      if (orgRes && orgRes.success && orgRes.data) {
        setOrgSettings(orgRes.data);
      }

      if (!isTeamLeader) {
        const invRes = await api.getInvitations().catch(() => null);
        if (invRes && invRes.success && invRes.data) {
          setInvitations(invRes.data);
        }
      }
    } catch (e) {
      console.warn('[AdminEmployees] Fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInvitation = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      Alert.alert('Required Fields', 'Please enter Name and Work Email.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createInvitation({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        department: newDepartment.trim() || 'Operations',
        designation: newDesignation.trim() || (newRole === 'team_leader' ? 'Team Lead' : 'Staff Member'),
        phone: newPhone.trim() || null
      });

      if (res.success && res.invitation) {
        setShowInviteModal(false);
        setNewName('');
        setNewEmail('');
        setNewDesignation('');
        setNewPhone('');
        setCreatedInviteResult(res.invitation);
        loadData();
      } else {
        Alert.alert('Error', res.error || 'Failed to create employee invitation.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvitation = (invitationId, email) => {
    Alert.alert(
      'Revoke Invitation',
      `Are you sure you want to revoke the invitation for ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.revokeInvitation(invitationId);
              if (res.success) {
                Alert.alert('Revoked', 'Invitation has been revoked.');
                loadData();
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const handleToggleStatus = async (targetUser) => {
    const nextStatus = !targetUser.isActive;
    Alert.alert(
      'Confirm Status Change',
      `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} ${targetUser.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const res = await api.updateUser(targetUser.id, { isActive: nextStatus });
              if (res.success) {
                loadData();
                if (selectedUser) setSelectedUser({ ...selectedUser, isActive: nextStatus });
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const copyToClipboard = async (text, message = 'Copied to clipboard') => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copied', message);
      } else {
        await Share.share({ message: text });
      }
    } catch (e) {
      Alert.alert('Notice', text);
    }
  };

  const departments = ['all', 'Engineering', 'Operations', 'Management', 'Sales', 'Design'];

  const filteredEmployees = employees.filter((emp) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      emp.name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q) ||
      emp.designation?.toLowerCase().includes(q) ||
      emp.employeeId?.toLowerCase().includes(q);

    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const companyId = orgSettings?.public_company_id || orgSettings?.companyId || 'CMP-XXXXXXXX';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{isTeamLeader ? 'Assigned Team' : 'Staff & Employees'}</Text>
          <Text style={styles.headerSubtitle}>
            {employees.length} {isTeamLeader ? 'Team Members' : 'Active Members'}
          </Text>
        </View>
        {!isTeamLeader && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowInviteModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add" size={18} color="#ffffff" />
            <Text style={styles.addBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Company ID Quick Banner for Founder/Admin */}
      {!isTeamLeader && (
        <View style={styles.companyIdBanner}>
          <View style={styles.companyIdLeft}>
            <Text style={styles.companyIdLabel}>COMPANY ID</Text>
            <Text style={styles.companyIdVal}>{companyId}</Text>
          </View>
          <TouchableOpacity
            style={styles.companyIdCopyBtn}
            onPress={() => copyToClipboard(companyId, `Company ID ${companyId} copied!`)}
          >
            <Ionicons name="copy-outline" size={14} color={colors.primary} />
            <Text style={styles.companyIdCopyText}>Copy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Primary Tab Switcher: Staff Directory vs Pending Invitations */}
      {!isTeamLeader && (
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'staff' && styles.tabBtnActive]}
            onPress={() => setActiveTab('staff')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'staff' && styles.tabBtnTextActive]}>
              Staff Directory ({employees.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'invitations' && styles.tabBtnActive]}
            onPress={() => setActiveTab('invitations')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'invitations' && styles.tabBtnTextActive]}>
              Invitations ({invitations.filter(i => i.status === 'pending').length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'staff' ? (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, email, Employee ID..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Department Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {departments.map((dept) => {
              const isSelected = departmentFilter === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setDepartmentFilter(dept)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {dept === 'all' ? 'All Teams' : dept}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Employee List */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading staff directory...</Text>
            </View>
          ) : filteredEmployees.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Employees Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredEmployees}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.employeeCard}
                  onPress={() => setSelectedUser(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.empInfo}>
                    <View style={styles.empNameRow}>
                      <Text style={styles.empName}>{item.name}</Text>
                      <View
                        style={[
                          styles.roleBadge,
                          item.role === 'founder'
                            ? styles.roleFounder
                            : item.role === 'admin'
                            ? styles.roleAdmin
                            : item.role === 'team_leader'
                            ? styles.roleTL
                            : styles.roleEmp
                        ]}
                      >
                        <Text style={styles.roleText}>{item.role?.replace('_', ' ').toUpperCase()}</Text>
                      </View>
                    </View>

                    {/* Employee ID Badge */}
                    {Boolean(item.employeeId) && (
                      <View style={styles.empIdBadge}>
                        <Ionicons name="id-card-outline" size={12} color={colors.primary} />
                        <Text style={styles.empIdBadgeText}>{item.employeeId}</Text>
                      </View>
                    )}

                    <Text style={styles.empDesignation}>{item.designation || 'Staff Member'}</Text>
                    <Text style={styles.empDept}>{item.department || 'Operations'}</Text>
                  </View>
                  <View style={styles.statusIndicator}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: item.isActive !== false ? '#10b981' : '#9ca3af' }
                      ]}
                    />
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        /* Invitations List */
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="mail-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Invitations Issued</Text>
              <Text style={styles.emptySubtitle}>Use the "+ Invite" button above to onboard team members.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.inviteCard}>
              <View style={styles.inviteCardHeader}>
                <View>
                  <Text style={styles.inviteEmail}>{item.email}</Text>
                  <Text style={styles.inviteRole}>
                    ID: {item.employeeId || 'Pending'} • Role: {item.role?.toUpperCase()}
                  </Text>
                </View>
                <View style={[
                  styles.inviteStatusBadge,
                  item.status === 'accepted' ? styles.statusAccepted :
                  item.status === 'revoked' ? styles.statusRevoked :
                  styles.statusPending
                ]}>
                  <Text style={styles.inviteStatusText}>{item.status.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.inviteExpiry}>
                Expires: {new Date(item.expiresAt).toLocaleDateString()}
              </Text>

              {item.status === 'pending' && (
                <View style={styles.inviteActionRow}>
                  <TouchableOpacity
                    style={styles.revokeBtn}
                    onPress={() => handleRevokeInvitation(item.id, item.email)}
                  >
                    <Text style={styles.revokeBtnText}>Revoke Invite</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* ── Invite Employee Modal ── */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Team Member</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Full Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Aarav Sharma"
                placeholderTextColor={colors.textSecondary}
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.formLabel}>Work Email Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="aarav@company.com"
                placeholderTextColor={colors.textSecondary}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Role Assignment</Text>
              <View style={styles.rolePickerRow}>
                {['employee', 'team_leader', ...(isFounder ? ['admin'] : [])].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleSelectBtn, newRole === r && styles.roleSelectBtnActive]}
                    onPress={() => setNewRole(r)}
                  >
                    <Text
                      style={[
                        styles.roleSelectText,
                        newRole === r && styles.roleSelectTextActive
                      ]}
                    >
                      {r.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>Department</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Engineering, Design, Operations..."
                placeholderTextColor={colors.textSecondary}
                value={newDepartment}
                onChangeText={setNewDepartment}
              />

              <Text style={styles.formLabel}>Designation</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Senior Frontend Engineer"
                placeholderTextColor={colors.textSecondary}
                value={newDesignation}
                onChangeText={setNewDesignation}
              />

              <Text style={styles.formLabel}>Mobile Phone (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+91 98765 43210"
                placeholderTextColor={colors.textSecondary}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleCreateInvitation}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Generate Invitation & Employee ID</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Invitation Created Result Modal ── */}
      <Modal visible={!!createdInviteResult} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.successIconTop}>
              <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            </View>
            <Text style={styles.inviteSuccessTitle}>Invitation Ready to Share</Text>
            <Text style={styles.inviteSuccessSubtitle}>
              Give these details to your employee to activate their account via "Join an Existing Company":
            </Text>

            {createdInviteResult && (
              <View style={styles.codeShareBox}>
                <View style={styles.codeRow}>
                  <Text style={styles.codeLabel}>Company ID:</Text>
                  <Text style={styles.codeVal}>{createdInviteResult.companyId}</Text>
                </View>
                <View style={styles.codeRow}>
                  <Text style={styles.codeLabel}>Employee ID:</Text>
                  <Text style={styles.codeVal}>{createdInviteResult.employeeId}</Text>
                </View>
                <View style={styles.codeRow}>
                  <Text style={styles.codeLabel}>Email:</Text>
                  <Text style={styles.codeVal}>{createdInviteResult.email}</Text>
                </View>
                <View style={[styles.codeRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.codeLabel}>Invitation Code:</Text>
                  <Text style={[styles.codeVal, { color: colors.primary, fontSize: 16, fontWeight: '800' }]}>
                    {createdInviteResult.invitationCode}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.shareCopyBtn}
              onPress={() => {
                const text = `Join ${createdInviteResult?.companyName || 'our company'} on EMS:\nCompany ID: ${createdInviteResult?.companyId}\nEmployee ID: ${createdInviteResult?.employeeId}\nInvite Code: ${createdInviteResult?.invitationCode}\nOpen the app and select 'Join an Existing Company'.`;
                copyToClipboard(text, 'Full invitation details copied to clipboard!');
              }}
            >
              <Ionicons name="copy-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.shareCopyBtnText}>Copy Invitation Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => setCreatedInviteResult(null)}
            >
              <Text style={styles.dismissBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Employee Detail Modal ── */}
      <Modal visible={!!selectedUser} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Staff Details</Text>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedUser && (
              <View style={styles.detailBody}>
                <View style={styles.detailAvatarWrap}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>
                      {selectedUser.name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.detailName}>{selectedUser.name}</Text>
                  {Boolean(selectedUser.employeeId) && (
                    <Text style={styles.detailEmpId}>ID: {selectedUser.employeeId}</Text>
                  )}
                  <Text style={styles.detailSub}>{selectedUser.designation}</Text>
                </View>

                <View style={styles.detailInfoRow}>
                  <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailInfoText}>{selectedUser.email || 'Restricted'}</Text>
                </View>

                <View style={styles.detailInfoRow}>
                  <Ionicons name="briefcase-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailInfoText}>{selectedUser.department}</Text>
                </View>

                <View style={styles.detailInfoRow}>
                  <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.detailInfoText}>
                    Role: {selectedUser.role?.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.detailInfoRow}>
                  <Ionicons name="radio-button-on" size={16} color={selectedUser.isActive !== false ? '#10b981' : '#9ca3af'} />
                  <Text style={styles.detailInfoText}>
                    Status: {selectedUser.isActive !== false ? 'Active' : 'Deactivated'}
                  </Text>
                </View>

                {selectedUser.role !== 'founder' && (
                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      { backgroundColor: selectedUser.isActive !== false ? '#fee2e2' : '#d1fae5' }
                    ]}
                    onPress={() => handleToggleStatus(selectedUser)}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        { color: selectedUser.isActive !== false ? '#b91c1c' : '#047857' }
                      ]}
                    >
                      {selectedUser.isActive !== false ? 'Deactivate Account' : 'Reactivate Account'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
      marginRight: 10
    },
    headerTitleWrap: {
      flex: 1
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textSecondary
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 10,
      gap: 4
    },
    addBtnText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700'
    },
    companyIdBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#23321d' : '#edf5ea',
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#384d2b' : '#cce2c3'
    },
    companyIdLeft: {
      flex: 1
    },
    companyIdLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5
    },
    companyIdVal: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary
    },
    companyIdCopyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: isDark ? '#2e3e26' : '#e0eed6',
      gap: 4
    },
    companyIdCopyText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    tabSwitcher: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 10,
      backgroundColor: isDark ? '#1f2937' : '#e5e7eb',
      borderRadius: 10,
      padding: 3
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 8
    },
    tabBtnActive: {
      backgroundColor: colors.surface,
      elevation: 2
    },
    tabBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary
    },
    tabBtnTextActive: {
      color: colors.textPrimary,
      fontWeight: '700'
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground || (isDark ? '#1f2937' : '#f9fafb'),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      height: 42
    },
    searchIcon: {
      marginRight: 8
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.textPrimary,
      height: '100%'
    },
    chipRow: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    chipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600'
    },
    chipTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textSecondary
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center'
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24
    },
    employeeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      elevation: 1
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12
    },
    avatarText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '800'
    },
    empInfo: {
      flex: 1
    },
    empNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 2
    },
    empName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary
    },
    roleBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6
    },
    roleFounder: {
      backgroundColor: '#fef3c7'
    },
    roleAdmin: {
      backgroundColor: '#fee2e2'
    },
    roleTL: {
      backgroundColor: '#dbeafe'
    },
    roleEmp: {
      backgroundColor: '#f3f4f6'
    },
    roleText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#1f2937'
    },
    empIdBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 2,
      gap: 4
    },
    empIdBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary
    },
    empDesignation: {
      fontSize: 12,
      color: colors.textSecondary
    },
    empDept: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4
    },
    // Invitations Styles
    inviteCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border
    },
    inviteCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8
    },
    inviteEmail: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary
    },
    inviteRole: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    inviteStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6
    },
    statusPending: {
      backgroundColor: '#fef3c7'
    },
    statusAccepted: {
      backgroundColor: '#d1fae5'
    },
    statusRevoked: {
      backgroundColor: '#fee2e2'
    },
    inviteStatusText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#1f2937'
    },
    inviteExpiry: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 8
    },
    inviteActionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8
    },
    revokeBtn: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: '#fee2e2'
    },
    revokeBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#b91c1c'
    },
    // Modals
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
      maxHeight: '85%'
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary
    },
    modalForm: {
      marginBottom: 16
    },
    formLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 6,
      marginTop: 10
    },
    formInput: {
      backgroundColor: colors.inputBackground || (isDark ? '#1f2937' : '#f9fafb'),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 44,
      fontSize: 14,
      color: colors.textPrimary
    },
    rolePickerRow: {
      flexDirection: 'row',
      gap: 8
    },
    roleSelectBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      alignItems: 'center'
    },
    roleSelectBtnActive: {
      backgroundColor: colors.primary
    },
    roleSelectText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'capitalize'
    },
    roleSelectTextActive: {
      color: '#ffffff',
      fontWeight: '700'
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center'
    },
    submitBtnDisabled: {
      opacity: 0.6
    },
    submitBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 22
    },
    successIconTop: {
      alignItems: 'center',
      marginBottom: 10
    },
    inviteSuccessTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6
    },
    inviteSuccessSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 14,
      lineHeight: 18
    },
    codeShareBox: {
      backgroundColor: isDark ? '#1f2d1b' : '#edf5ea',
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: isDark ? '#384d2b' : '#cce2c3',
      marginBottom: 16
    },
    codeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#2e3e26' : '#d8ebd0'
    },
    codeLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary
    },
    codeVal: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary
    },
    shareCopyBtn: {
      flexDirection: 'row',
      backgroundColor: colors.primary,
      borderRadius: 12,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10
    },
    shareCopyBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '700'
    },
    dismissBtn: {
      height: 40,
      alignItems: 'center',
      justifyContent: 'center'
    },
    dismissBtnText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600'
    },
    detailBody: {
      alignItems: 'center'
    },
    detailAvatarWrap: {
      alignItems: 'center',
      marginBottom: 16
    },
    largeAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10
    },
    largeAvatarText: {
      color: '#ffffff',
      fontSize: 24,
      fontWeight: '800'
    },
    detailName: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary
    },
    detailEmpId: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 2
    },
    detailSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2
    },
    detailInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: 8,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    detailInfoText: {
      fontSize: 13,
      color: colors.textPrimary
    },
    statusToggleBtn: {
      marginTop: 18,
      width: '100%',
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center'
    },
    statusToggleText: {
      fontSize: 13,
      fontWeight: '700'
    }
  });
