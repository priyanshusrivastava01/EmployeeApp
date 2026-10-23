import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { mockProfile, mockOfficeGeofence } from '../data/mockEmployeeData';

export default function ProfileScreen({ onLogout, onNavigate }) {
  const { colors, isDark, preference, setPreference, theme } = useTheme();
  const [appearanceModalVisible, setAppearanceModalVisible] = useState(false);

  const styles = getStyles(colors, isDark);

  const getPreferenceLabel = () => {
    if (preference === 'system') {
      return `System Default (${theme === 'dark' ? 'Dark' : 'Light'})`;
    }
    return preference === 'dark' ? 'Dark Theme' : 'Light Theme';
  };

  const appearanceOptions = [
    {
      id: 'system',
      title: 'System Default',
      subtitle: 'Automatically follow your device light/dark appearance',
      icon: 'phone-portrait-outline'
    },
    {
      id: 'light',
      title: 'Light Theme',
      subtitle: 'Warm off-white background with olive green accents',
      icon: 'sunny-outline'
    },
    {
      id: 'dark',
      title: 'Dark Theme',
      subtitle: 'Low-glare deep charcoal surface with sage olive highlights',
      icon: 'moon-outline'
    }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: mockProfile.avatar }} style={styles.avatar} />
          <View style={styles.badgeOnline} />
        </View>
        <Text style={styles.name}>{mockProfile.name}</Text>
        <Text style={styles.designation}>{mockProfile.designation}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Active Employee</Text>
        </View>
      </View>

      {/* Settings Card — Appearance & System */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="settings-outline" size={18} color={colors.primary} />
          <Text style={styles.cardHeader}>Settings & Preferences</Text>
        </View>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setAppearanceModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.iconBox}>
            <Ionicons
              name={isDark ? 'moon' : 'sunny'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.infoTexts}>
            <Text style={styles.infoLabel}>Appearance</Text>
            <Text style={styles.infoValue}>{getPreferenceLabel()}</Text>
          </View>
          <View style={styles.settingsPill}>
            <Text style={styles.settingsPillText}>Change</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="person-outline" size={18} color={colors.primary} />
          <Text style={styles.cardHeader}>Employee Information</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Ionicons name="card-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoTexts}>
            <Text style={styles.infoLabel}>Employee ID</Text>
            <Text style={styles.infoValue}>{mockProfile.employeeId}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoTexts}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{mockProfile.department}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoTexts}>
            <Text style={styles.infoLabel}>Company Email</Text>
            <Text style={styles.infoValue}>{mockProfile.email}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Ionicons name="call-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.infoTexts}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{mockProfile.phone}</Text>
          </View>
        </View>
      </View>

      {/* Biometric Security & Identity */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="scan-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.cardHeader}>Biometric Security & Identity</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.infoTexts}>
            <Text style={styles.infoLabel}>Face Biometric Verification</Text>
            <Text style={styles.infoValue}>Multi-angle registration setup</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.enrollActionBtn}
          onPress={() => onNavigate && onNavigate('face-enrollment')}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={16} color="#ffffff" />
          <Text style={styles.enrollActionText}>Face Enrollment & Consent</Text>
          <Ionicons name="chevron-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Reporting Manager Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="git-network-outline" size={18} color={colors.primary} />
          <Text style={styles.cardHeader}>Reporting Line</Text>
        </View>
        <View style={styles.managerRow}>
          <View style={styles.managerAvatarBox}>
            <Ionicons name="person" size={20} color="#ffffff" />
          </View>
          <View>
            <Text style={styles.managerName}>{mockProfile.teamLeader}</Text>
            <Text style={styles.managerRole}>Team Leader • Engineering</Text>
          </View>
        </View>
      </View>

      {/* Office Geofence Info */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="navigate-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.cardHeader}>Assigned Office Geofence</Text>
        </View>
        <Text style={styles.officeText}>{mockOfficeGeofence.name}</Text>
        <Text style={styles.officeSubtext}>
          Authorized radius: {mockOfficeGeofence.radiusMeters}m from campus center
        </Text>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={onLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out of Mobile App</Text>
      </TouchableOpacity>

      {/* Appearance Settings Modal */}
      <Modal
        visible={appearanceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
                <Text style={styles.modalTitle}>Appearance</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAppearanceModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select your preferred mobile theme. System Default reacts automatically when your phone switches appearance.
            </Text>

            <View style={styles.optionsList}>
              {appearanceOptions.map(opt => {
                const isSelected = preference === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected
                    ]}
                    onPress={() => {
                      setPreference(opt.id);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.optionIconBox, isSelected && styles.optionIconBoxSelected]}>
                      <Ionicons
                        name={opt.icon}
                        size={20}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                    </View>

                    <View style={styles.optionTextWrap}>
                      <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                        {opt.title}
                      </Text>
                      <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                    </View>

                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setAppearanceModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    content: {
      padding: 20,
      paddingBottom: 40
    },
    header: {
      alignItems: 'center',
      marginBottom: 24
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 12
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 3,
      borderColor: colors.primary
    },
    badgeOnline: {
      position: 'absolute',
      bottom: 2,
      right: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.success,
      borderWidth: 2,
      borderColor: colors.card
    },
    name: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text
    },
    designation: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2
    },
    roleBadge: {
      backgroundColor: colors.lightOlive,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 8
    },
    roleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.2 : 0.03,
      shadowRadius: 6,
      elevation: 2
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14
    },
    cardHeader: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.beige,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border
    },
    settingsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border
    },
    settingsPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.lightOlive,
      alignItems: 'center',
      justifyContent: 'center'
    },
    infoTexts: {
      flex: 1
    },
    infoLabel: {
      fontSize: 11,
      color: colors.textSecondary
    },
    infoValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 1
    },
    managerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.beige,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border
    },
    managerAvatarBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.darkOlive,
      alignItems: 'center',
      justifyContent: 'center'
    },
    managerName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text
    },
    managerRole: {
      fontSize: 12,
      color: colors.textSecondary
    },
    officeText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text
    },
    officeSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 8
    },
    logoutText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '700'
    },
    enrollActionBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10
    },
    enrollActionText: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '700',
      flex: 1,
      marginLeft: 8
    },
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6
    },
    modalTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text
    },
    modalCloseBtn: {
      padding: 4
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 18
    },
    optionsList: {
      gap: 10,
      marginBottom: 20
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.beige,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 14,
      borderRadius: 14
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? '#2C3425' : '#F0F4E9'
    },
    optionIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center'
    },
    optionIconBoxSelected: {
      backgroundColor: colors.lightOlive
    },
    optionTextWrap: {
      flex: 1
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text
    },
    optionTitleSelected: {
      color: colors.primary
    },
    optionSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2
    },
    radioCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center'
    },
    radioCircleSelected: {
      borderColor: colors.primary
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary
    },
    modalDoneBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center'
    },
    modalDoneBtnText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800'
    }
  });
