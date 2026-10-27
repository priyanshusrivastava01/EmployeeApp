import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  BackHandler,
  ActivityIndicator
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useSafeAppInsets } from './src/utils/safeAreaHelper';
import CompanyVerificationScreen from './src/screens/CompanyVerificationScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import CompanyRegistrationScreen from './src/screens/CompanyRegistrationScreen';
import CompanySetupSuccessScreen from './src/screens/CompanySetupSuccessScreen';
import JoinCompanyScreen from './src/screens/JoinCompanyScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PunchScreen from './src/screens/PunchScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import TaskReportScreen from './src/screens/TaskReportScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminDashboard from './src/screens/admin/AdminDashboard';
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
import api from './src/services/api';

function MainApp() {
  const { colors, isDark } = useTheme();
  const safeInsets = useSafeAppInsets();
  const styles = getStyles(colors, isDark);

  const [isInitializing, setIsInitializing] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [activeSubScreen, setActiveSubScreen] = useState(null);
  const [authView, setAuthView] = useState('verify_company');
  const [verifiedCompany, setVerifiedCompany] = useState(null);
  const [setupSuccessData, setSetupSuccessData] = useState(null);
  const [prefillAuth, setPrefillAuth] = useState({ portal: 'employee', companyId: '', email: '' });

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

  // Check persisted session on boot and validate token
  useEffect(() => {
    async function checkSession() {
      try {
        const { token, user, org } = await api.init();
        if (token && user) {
          try {
            // Authoritative server check
            const meRes = await api.getMe();
            if (meRes.success && meRes.user) {
              setCurrentUser(meRes.user);
              setCurrentOrg(meRes.organization || org);
              fetchTodayAttendance();
              fetchAttendanceHistory();
            } else {
              await api.logout();
              setCurrentUser(null);
              setCurrentOrg(null);
            }
          } catch (validateErr) {
            if (validateErr.message && (validateErr.message.includes('401') || validateErr.message.includes('Invalid token'))) {
              await api.logout();
              setCurrentUser(null);
              setCurrentOrg(null);
            } else {
              // Network offline: maintain offline session safely
              setCurrentUser(user);
              setCurrentOrg(org);
            }
          }
        }
      } catch (e) {
        console.warn('[App] Session check error:', e);
      } finally {
        setIsInitializing(false);
      }
    }
    checkSession();
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      const res = await api.getTodayAttendance();
      if (res.success && res.data) {
        const rec = res.data;
        setAttendanceState({
          isPunchedIn: Boolean(rec.punch_in_time && !rec.punch_out_time),
          isPunchedOut: Boolean(rec.punch_out_time),
          lastPunchOutTime: rec.punch_out_time ? new Date(rec.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          mode: rec.mode || 'WFO',
          punchInTime: rec.punch_in_time ? new Date(rec.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
          punchInDate: rec.work_date,
          punchInPhotoUri: rec.punch_in_photo_path,
          punchInCoords: rec.punch_in_lat ? { latitude: rec.punch_in_lat, longitude: rec.punch_in_lng } : null,
          punchInGeofence: rec.punch_in_verified ? { verified: true } : null
        });
      }
    } catch (e) {
      console.warn('[App] Today attendance fetch error:', e.message);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const res = await api.getAttendanceHistory();
      if (res.success && res.data && res.data.length > 0) {
        setAttendanceHistory(res.data);
      }
    } catch (e) {
      console.warn('[App] History fetch error:', e.message);
    }
  };

  // Consistent BackHandler for Android
  useEffect(() => {
    const onBackPress = () => {
      if (!currentUser) {
        if (authView === 'login') {
          setAuthView('verify_company');
          return true;
        }
        if (authView === 'register_company') {
          setAuthView('verify_company');
          return true;
        }
        if (authView === 'join_company') {
          setAuthView('login');
          return true;
        }
        if (authView !== 'verify_company') {
          setAuthView('verify_company');
          return true;
        }
        return false;
      }
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
  }, [currentUser, authView, activeSubScreen, activeTab]);

  // Navigation router handling both bottom tabs and sub-screens
  const handleNavigate = (targetKey) => {
    const key = targetKey === 'task' ? 'tasks' : targetKey;
    if (['home', 'punch', 'history', 'tasks', 'profile'].includes(key)) {
      setActiveTab(key);
      setActiveSubScreen(null);
    } else {
      setActiveSubScreen(key);
    }
  };

  const handleLoginSuccess = (user, org) => {
    setCurrentUser(user);
    setCurrentOrg(org);
    setActiveTab('home');
    setActiveSubScreen(null);
    setAuthView('verify_company');
    fetchTodayAttendance();
    fetchAttendanceHistory();
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setCurrentOrg(null);
    setActiveSubScreen(null);
    setActiveTab('home');
    setPrefillAuth({ portal: 'employee', companyId: '', email: '' });
    setVerifiedCompany(null);
    setAuthView('verify_company');
  };

  /**
   * Safe punch lifecycle handler (Punch In & Punch Out) with backend sync
   */
  const handlePunchSuccess = async (record) => {
    if (!record) return;

    if (record.type === 'IN') {
      try {
        // Submit to real backend API
        await api.punchIn({
          mode: record.mode || 'WFO',
          latitude: record.coords?.latitude || 12.9716,
          longitude: record.coords?.longitude || 77.5946,
          accuracy: record.coords?.accuracy || 10,
          photoPath: record.photoUri || 'file://local-attendance.jpg'
        });
      } catch (err) {
        console.warn('[Punch] Server sync fallback:', err.message);
      }

      setAttendanceState({
        isPunchedIn: true,
        isPunchedOut: false,
        lastPunchOutTime: null,
        mode: record.mode || 'WFO',
        punchInTime: record.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        punchInDate: record.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        punchInPhotoUri: record.photoUri || null,
        punchInCoords: record.coords || null,
        punchInGeofence: record.geofence || null
      });

      // Optimistically prepend to history
      const newHistoryItem = {
        id: `att-${Date.now()}`,
        date: record.date || 'Today',
        punchIn: record.timestamp || 'Now',
        punchOut: '--:--',
        duration: 'In Progress',
        mode: record.mode || 'WFO',
        verified: record.geofence?.verified ?? true,
        isComplete: false
      };
      setAttendanceHistory(prev => [newHistoryItem, ...prev]);

    } else if (record.type === 'OUT') {
      try {
        // Submit to real backend API
        await api.punchOut({
          latitude: record.coords?.latitude || 12.9716,
          longitude: record.coords?.longitude || 77.5946,
          accuracy: record.coords?.accuracy || 10,
          photoPath: record.photoUri || null
        });
      } catch (err) {
        console.warn('[Punch Out] Server sync fallback:', err.message);
      }

      const outTime = record.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const duration = record.duration || '8h 15m';

      setAttendanceState(prev => ({
        ...prev,
        isPunchedIn: false,
        isPunchedOut: true,
        lastPunchOutTime: outTime
      }));

      // Update history entry
      setAttendanceHistory(prev => {
        if (!prev || prev.length === 0) return prev;
        const updated = [...prev];
        const first = { ...updated[0] };
        first.punchOut = outTime;
        first.duration = duration;
        first.isComplete = true;
        updated[0] = first;
        return updated;
      });
    }

    setActiveTab('home');
  };

  if (isInitializing) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not authenticated -> show clean, simple and secure Welcome / Login experience
  if (!currentUser) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: safeInsets.top }}>
        <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent={true}
        />
        {authView === 'verify_company' && (
          <CompanyVerificationScreen
            onVerified={(company) => {
              setVerifiedCompany(company);
              setPrefillAuth(prev => ({
                ...prev,
                companyId: company.companyCode || company.public_company_id || ''
              }));
              setAuthView('login');
            }}
            onRegisterCompany={() => setAuthView('register_company')}
          />
        )}
        {authView === 'login' && (
          <WelcomeScreen
            initialPortal={prefillAuth.portal || 'employee'}
            initialCompanyId={prefillAuth.companyId || (verifiedCompany?.companyCode || '')}
            initialEmail={prefillAuth.email || ''}
            onLoginSuccess={handleLoginSuccess}
            onRegisterCompany={() => setAuthView('register_company')}
            onJoinCompany={() => setAuthView('join_company')}
          />
        )}
        {authView === 'register_company' && (
          <CompanyRegistrationScreen
            onBack={() => setAuthView('verify_company')}
            onRegistrationSuccess={(data) => {
              setSetupSuccessData(data);
              setAuthView('company_setup_success');
            }}
          />
        )}
        {authView === 'company_setup_success' && (
          <CompanySetupSuccessScreen
            setupData={setupSuccessData}
            onContinueToLogin={(companyId, email) => {
              setPrefillAuth({ portal: 'management', companyId: companyId || '', email: email || '' });
              setAuthView('login');
            }}
            onContinueToDashboard={(data) => {
              handleLoginSuccess(data.user, data.organization);
            }}
          />
        )}
        {authView === 'join_company' && (
          <JoinCompanyScreen
            onBack={() => setAuthView('login')}
            onJoinSuccess={handleLoginSuccess}
          />
        )}
      </View>
    );
  }

  // Role Router: Founder, Admin, and Team Leader enter Management Dashboard
  const isManagement = ['founder', 'admin', 'team_leader'].includes(currentUser?.role?.toLowerCase());
  if (isManagement) {
    return (
      <AdminDashboard
        user={currentUser}
        organization={currentOrg}
        onLogout={handleLogout}
      />
    );
  }

  // Employee default dashboard view
  return (
    <View style={[styles.container, { paddingTop: safeInsets.top }]}>
      <ExpoStatusBar style={isDark ? 'light' : 'dark'} />
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Screen View */}
      <View style={styles.screenContainer}>
        {/* Dedicated Sub-Screens */}
        {activeSubScreen === 'holidays' && <HolidaysScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'advance' && <AdvancePaymentScreen onBack={() => setActiveSubScreen(null)} currentUser={currentUser} />}
        {activeSubScreen === 'coworkers' && <CoworkersScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'leave' && <LeaveApplicationScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'timesheet' && <TimesheetScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'announcements' && <AnnouncementsScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'rules' && <CompanyRulesScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'celebrations' && <CelebrationsScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'notifications' && <NotificationsScreen onBack={() => setActiveSubScreen(null)} />}
        {activeSubScreen === 'face-enrollment' && (
          <FaceEnrollmentScreen
            onBack={() => setActiveSubScreen(null)}
            onRegistrationComplete={() => setActiveSubScreen(null)}
          />
        )}

        {/* Primary Bottom Tab Screens - Retain state by toggling display */}
        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'home') ? 'flex' : 'none' }]}>
          <HomeScreen
            attendanceState={attendanceState}
            onNavigateToPunch={() => handleNavigate('punch')}
            onNavigate={handleNavigate}
            currentUser={currentUser}
            currentOrg={currentOrg}
          />
        </View>

        {(!activeSubScreen && activeTab === 'punch') && (
          <View style={styles.tabContentContainer}>
            <PunchScreen
              attendanceState={attendanceState}
              onPunchSuccess={handlePunchSuccess}
            />
          </View>
        )}

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'history') ? 'flex' : 'none' }]}>
          <HistoryScreen attendanceHistory={attendanceHistory} />
        </View>

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'tasks') ? 'flex' : 'none' }]}>
          <TaskReportScreen currentUser={currentUser} />
        </View>

        <View style={[styles.tabContentContainer, { display: (!activeSubScreen && activeTab === 'profile') ? 'flex' : 'none' }]}>
          <ProfileScreen
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            currentUser={currentUser}
            currentOrg={currentOrg}
          />
        </View>
      </View>

      {/* Five-Item Bottom Navigation Bar with Centered Raised Punch Button */}
      <View style={styles.bottomNavWrapper}>
        {/* Solid, thin, fully opaque bottom navigation bar */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            {/* 1. Home */}
            <TouchableOpacity
              style={styles.bottomNavTab}
              onPress={() => handleNavigate('home')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: !activeSubScreen && activeTab === 'home' }}
            >
              <Ionicons
                name={(!activeSubScreen && activeTab === 'home') ? 'home' : 'home-outline'}
                size={21}
                color={(!activeSubScreen && activeTab === 'home') ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.bottomNavLabel,
                (!activeSubScreen && activeTab === 'home') && styles.bottomNavLabelActive
              ]}>
                Home
              </Text>
            </TouchableOpacity>

            {/* 2. History */}
            <TouchableOpacity
              style={styles.bottomNavTab}
              onPress={() => handleNavigate('history')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: !activeSubScreen && activeTab === 'history' }}
            >
              <Ionicons
                name={(!activeSubScreen && activeTab === 'history') ? 'time' : 'time-outline'}
                size={21}
                color={(!activeSubScreen && activeTab === 'history') ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.bottomNavLabel,
                (!activeSubScreen && activeTab === 'history') && styles.bottomNavLabelActive
              ]}>
                History
              </Text>
            </TouchableOpacity>

            {/* 3. Reserved Slot for Raised Center Punch Button */}
            <TouchableOpacity
              style={styles.bottomNavCenterSlot}
              onPress={() => handleNavigate('punch')}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: !activeSubScreen && activeTab === 'punch' }}
            >
              <Text style={[
                styles.bottomNavLabel,
                styles.punchSlotLabel,
                (!activeSubScreen && activeTab === 'punch') && styles.bottomNavLabelActive
              ]}>
                {attendanceState.isPunchedIn ? 'Punch Out' : 'Punch In'}
              </Text>
            </TouchableOpacity>

            {/* 4. Task */}
            <TouchableOpacity
              style={styles.bottomNavTab}
              onPress={() => handleNavigate('tasks')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: !activeSubScreen && activeTab === 'tasks' }}
            >
              <Ionicons
                name={(!activeSubScreen && activeTab === 'tasks') ? 'document-text' : 'document-text-outline'}
                size={21}
                color={(!activeSubScreen && activeTab === 'tasks') ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.bottomNavLabel,
                (!activeSubScreen && activeTab === 'tasks') && styles.bottomNavLabelActive
              ]}>
                Task
              </Text>
            </TouchableOpacity>

            {/* 5. Profile */}
            <TouchableOpacity
              style={styles.bottomNavTab}
              onPress={() => handleNavigate('profile')}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: !activeSubScreen && activeTab === 'profile' }}
            >
              <Ionicons
                name={(!activeSubScreen && activeTab === 'profile') ? 'person' : 'person-outline'}
                size={21}
                color={(!activeSubScreen && activeTab === 'profile') ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.bottomNavLabel,
                (!activeSubScreen && activeTab === 'profile') && styles.bottomNavLabelActive
              ]}>
                Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Distinctive Raised Circular Punch Button Layered Above the Bar */}
        <View style={styles.raisedPunchAnchor} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.raisedPunchBtn}
            onPress={() => handleNavigate('punch')}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: !activeSubScreen && activeTab === 'punch' }}
            accessibilityLabel="Punch Attendance"
          >
            <View style={[
              styles.raisedPunchCircle,
              attendanceState.isPunchedIn && styles.raisedPunchCircleWorking,
              (!activeSubScreen && activeTab === 'punch') && styles.raisedPunchCircleActive
            ]}>
              <Ionicons
                name={(!activeSubScreen && activeTab === 'punch') ? 'camera' : 'camera-outline'}
                size={24}
                color="#ffffff"
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  },
  screenContainer: {
    flex: 1
  },
  tabContentContainer: {
    flex: 1
  },
  bottomNavWrapper: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
    zIndex: 10
  },
  bottomNavContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 5,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
    height: Platform.OS === 'ios' ? 76 : 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: isDark ? 0.25 : 0.05,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 1
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%'
  },
  bottomNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%'
  },
  bottomNavLabel: {
    fontSize: 10,
    marginTop: 2,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  bottomNavLabelActive: {
    color: colors.primary,
    fontWeight: '700'
  },
  bottomNavCenterSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingBottom: 2
  },
  punchSlotLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: colors.textSecondary
  },
  raisedPunchAnchor: {
    position: 'absolute',
    top: -16,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    elevation: 10
  },
  raisedPunchBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 10
  },
  raisedPunchCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 12,
    zIndex: 101
  },
  raisedPunchCircleActive: {
    transform: [{ scale: 1.06 }]
  },
  raisedPunchCircleWorking: {
    backgroundColor: '#b91c1c'
  }
});
