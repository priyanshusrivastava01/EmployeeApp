import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PunchScreen from './src/screens/PunchScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import TaskReportScreen from './src/screens/TaskReportScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import {
  HolidaysScreen,
  AdvancePaymentScreen,
  CoworkersScreen,
  LeaveApplicationScreen,
  TimesheetScreen,
  AnnouncementsScreen,
  CompanyRulesScreen,
  CelebrationsScreen,
  NotificationsScreen
} from './src/screens/FeatureScreens';
import FaceEnrollmentScreen from './src/screens/FaceEnrollmentScreen';
import { mockAttendanceHistory } from './src/data/mockEmployeeData';

function MainApp() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [activeSubScreen, setActiveSubScreen] = useState(null);

  // Consistent BackHandler for Android
  useEffect(() => {
    const onBackPress = () => {
      if (activeSubScreen) {
        setActiveSubScreen(null);
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSubscription.remove();
  }, [activeSubScreen, activeTab]);

  // Navigation router handling both bottom tabs and sub-screens
  const handleNavigate = (targetKey) => {
    if (['home', 'punch', 'history', 'tasks', 'profile'].includes(targetKey)) {
      setActiveTab(targetKey);
      setActiveSubScreen(null);
    } else {
      setActiveSubScreen(targetKey);
    }
  };

  // Attendance history array
  const [attendanceHistory, setAttendanceHistory] = useState(mockAttendanceHistory);

  // Active shift attendance state with punch-out memory
  const [attendanceState, setAttendanceState] = useState({
    isPunchedIn: false,
    isPunchedOut: false,
    lastPunchOutTime: null,
    mode: 'WFO',
    punchInTime: null,
    punchInDate: null,
    punchInPhotoUri: null,
    punchInCoords: null,
    punchInGeofence: null
  });

  const handleLogin = (email) => {
    setIsAuthenticated(true);
    setActiveTab('home');
    setActiveSubScreen(null);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveSubScreen(null);
  };

  /**
   * Safe punch lifecycle handler (Punch In & Punch Out)
   */
  const handlePunchSuccess = (record) => {
    if (record.action === 'Punch In') {
      setAttendanceState({
        isPunchedIn: true,
        isPunchedOut: false,
        lastPunchOutTime: null,
        mode: record.mode,
        punchInTime: record.timestamp,
        punchInDate: record.dateString,
        punchInPhotoUri: record.photoUri,
        punchInCoords: record.coords,
        punchInGeofence: record.geofenceResult
      });
      setActiveTab('home');
    } else if (record.action === 'Punch Out') {
      const completedShift = {
        id: 'h-' + Date.now(),
        date: record.dateString || 'Today',
        mode: record.mode,
        punchIn: attendanceState.punchInTime || 'Earlier',
        punchOut: record.timestamp,
        totalHours: 'Session Completed',
        status: record.geofenceResult?.statusLabel || 'Verified',
        photoUri: record.photoUri,
        isVerified: record.geofenceResult?.isInside || false
      };

      setAttendanceHistory(prev => [completedShift, ...prev]);

      setAttendanceState({
        isPunchedIn: false,
        isPunchedOut: true,
        lastPunchOutTime: record.timestamp,
        mode: record.mode,
        punchInTime: null,
        punchInDate: null,
        punchInPhotoUri: null,
        punchInCoords: null,
        punchInGeofence: null
      });

      setActiveTab('history');
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Screen View */}
      <View style={styles.screenContainer}>
        {/* Dedicated Sub-Screens */}
        {activeSubScreen === 'holidays' && <HolidaysScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'advance' && <AdvancePaymentScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'coworkers' && <CoworkersScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'leave' && <LeaveApplicationScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'timesheet' && <TimesheetScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'announcements' && <AnnouncementsScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'rules' && <CompanyRulesScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'celebrations' && <CelebrationsScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'notifications' && <NotificationsScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'face-enrollment' && <FaceEnrollmentScreen onBack={() => setActiveSubScreen(null)} />}

        {/* Primary Bottom Tab Screens - Retain state by toggling display */}
        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'home') ? 'flex' : 'none' }]}>
          <HomeScreen
            attendanceState={attendanceState}
            onNavigateToPunch={() => handleNavigate('punch')}
            onNavigate={handleNavigate}
          />
        </View>

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'punch') ? 'flex' : 'none' }]}>
          <PunchScreen
            attendanceState={attendanceState}
            onPunchSuccess={handlePunchSuccess}
          />
        </View>

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'history') ? 'flex' : 'none' }]}>
          <HistoryScreen attendanceHistory={attendanceHistory} />
        </View>

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'tasks') ? 'flex' : 'none' }]}>
          <TaskReportScreen />
        </View>

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'profile') ? 'flex' : 'none' }]}>
          <ProfileScreen onLogout={handleLogout} onNavigate={handleNavigate} />
        </View>
      </View>

      {/* Modern Bottom Tab Navigation Bar */}
      <View style={styles.bottomNav}>
        {[
          { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
          { id: 'punch', label: 'Punch', icon: 'camera-outline', iconActive: 'camera', isHighlight: true },
          { id: 'history', label: 'History', icon: 'time-outline', iconActive: 'time' },
          { id: 'tasks', label: 'Task', icon: 'document-text-outline', iconActive: 'document-text' },
          { id: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' }
        ].map(tab => {
          const isActive = !activeSubScreen && activeTab === tab.id;
          const iconName = isActive ? tab.iconActive : tab.icon;

          if (tab.isHighlight) {
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.highlightTabBtn}
                onPress={() => handleNavigate(tab.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.highlightCircle, attendanceState.isPunchedIn ? styles.highlightCircleActive : styles.highlightCircleDefault]}>
                  <Ionicons name={iconName} size={24} color="#ffffff" />
                </View>
                <Text style={[styles.tabLabel, styles.tabLabelHighlight]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabBtn}
              onPress={() => handleNavigate(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={iconName}
                size={22}
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

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  screenContainer: {
    flex: 1
  },
  tabContentContainer: {
    flex: 1
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    height: Platform.OS === 'ios' ? 84 : 70
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700'
  },
  highlightTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20
  },
  highlightCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.darkOlive,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: colors.card
  },
  highlightCircleDefault: {
    backgroundColor: colors.primary
  },
  highlightCircleActive: {
    backgroundColor: colors.success
  },
  tabLabelHighlight: {
    marginTop: 2,
    color: isDark ? colors.primary : colors.darkOlive,
    fontWeight: '700'
  }
});
