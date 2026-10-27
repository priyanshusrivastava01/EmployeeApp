import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useSafeAppInsets } from '../../utils/safeAreaHelper';

import AdminHomeScreen from './AdminHomeScreen';
import AdminEmployeesScreen from './AdminEmployeesScreen';
import AdminAttendanceScreen from './AdminAttendanceScreen';
import AdminLeaveScreen from './AdminLeaveScreen';
import AdminReportsScreen from './AdminReportsScreen';
import AdminAnnouncementsScreen from './AdminAnnouncementsScreen';
import AdminGeofenceScreen from './AdminGeofenceScreen';
import AdminSettingsScreen from './AdminSettingsScreen';
import AdminAuditsScreen from './AdminAuditsScreen';

export default function AdminDashboard({ user, organization, onLogout }) {
  const { colors, isDark } = useTheme();
  const safeInsets = useSafeAppInsets();
  const styles = getStyles(colors, isDark);

  const [activeScreen, setActiveScreen] = useState('home');

  const isTeamLeader = user?.role === 'team_leader';
  const roleDisplay = user?.role === 'founder'
    ? 'FOUNDER'
    : user?.role === 'admin'
    ? 'ADMIN'
    : 'TEAM LEADER';

  const renderScreen = () => {
    switch (activeScreen) {
      case 'employees':
        return <AdminEmployeesScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'attendance':
        return <AdminAttendanceScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'leaves':
        return <AdminLeaveScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'reports':
        return <AdminReportsScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'audits':
        return <AdminAuditsScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'announcements':
        return <AdminAnnouncementsScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'geofence':
        return <AdminGeofenceScreen onBack={() => setActiveScreen('home')} user={user} organization={organization} />;
      case 'settings':
        return <AdminSettingsScreen onBack={() => setActiveScreen('home')} onLogout={onLogout} user={user} organization={organization} />;
      case 'home':
      default:
        return (
          <AdminHomeScreen
            onNavigate={(screenKey) => setActiveScreen(screenKey)}
            user={user}
            organization={organization}
          />
        );
    }
  };

  // Role-scoped bottom tabs
  const bottomTabs = isTeamLeader
    ? [
        { id: 'home', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
        { id: 'employees', label: 'My Team', icon: 'people-outline', activeIcon: 'people' },
        { id: 'attendance', label: 'Shifts', icon: 'time-outline', activeIcon: 'time' },
        { id: 'leaves', label: 'Leaves', icon: 'calendar-outline', activeIcon: 'calendar' },
        { id: 'audits', label: 'Audits', icon: 'star-outline', activeIcon: 'star' }
      ]
    : [
        { id: 'home', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
        { id: 'employees', label: 'Staff', icon: 'people-outline', activeIcon: 'people' },
        { id: 'attendance', label: 'Shifts', icon: 'time-outline', activeIcon: 'time' },
        { id: 'leaves', label: 'Leaves', icon: 'calendar-outline', activeIcon: 'calendar' },
        { id: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' }
      ];

  return (
    <View style={styles.container}>
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Top Bar for Admin */}
      <View style={[styles.topBar, { paddingTop: safeInsets.top + 8 }]}>
        <View style={styles.topBarLeft}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#ffffff" />
          </View>
          <View>
            <Text style={styles.topBarOrg}>{organization?.name || 'Organization Management'}</Text>
            <Text style={styles.topBarUser}>{user?.name} &bull; {roleDisplay}</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          {!isTeamLeader && (
            <TouchableOpacity
              style={styles.settingsIconBtn}
              onPress={() => setActiveScreen(activeScreen === 'settings' ? 'home' : 'settings')}
            >
              <Ionicons
                name={activeScreen === 'settings' ? 'close-circle' : 'settings-outline'}
                size={22}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutIconBtn} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.body}>{renderScreen()}</View>

      {/* Bottom Tabs for Management Experience */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(safeInsets.bottom, 14) }]}>
        {bottomTabs.map((tab) => {
          const isActive = activeScreen === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabBtn}
              onPress={() => setActiveScreen(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={20}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10
    },
    logoBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center'
    },
    topBarOrg: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary
    },
    topBarUser: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1
    },
    topBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    },
    settingsIconBtn: {
      padding: 4
    },
    logoutIconBtn: {
      padding: 4
    },
    body: {
      flex: 1
    },
    bottomBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 8,
      paddingBottom: 14
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '700'
    }
  });
