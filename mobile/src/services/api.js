/**
 * EMS Mobile API Service
 * Multi-Organization Backend Integration with Offline-Safe Fallback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const STORAGE_KEYS = {
  TOKEN: '@ems_auth_token',
  USER: '@ems_user_data',
  ORG: '@ems_org_data',
  SERVER_URL: '@ems_custom_server_url'
};

/**
 * Intelligent server URL resolver:
 * 1. Explicit EXPO_PUBLIC_API_URL environment variable
 * 2. Auto-detected LAN IP from Expo packager (hostUri) for physical phones on Wi-Fi
 * 3. LAN IP fallback for Android device/emulator (192.168.31.113:5000)
 * 4. Localhost for Web / iOS simulator
 */
function resolveDefaultServerUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // When running inside Expo Go on physical device, hostUri is "192.168.x.x:8081"
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // Developer host Wi-Fi LAN IP (reachable by physical phones and emulators)
  if (Platform.OS === 'android') {
    return 'http://192.168.31.113:5000';
  }

  return 'http://localhost:5000';
}

const DEFAULT_URL = resolveDefaultServerUrl();

class ApiService {
  constructor() {
    this.token = null;
    this.user = null;
    this.org = null;
    this.baseUrl = DEFAULT_URL;
  }

  async init() {
    try {
      const [savedToken, savedUser, savedOrg, customUrl] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.ORG),
        AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL)
      ]);

      if (customUrl) this.baseUrl = customUrl;
      if (savedToken) this.token = savedToken;
      if (savedUser) this.user = JSON.parse(savedUser);
      if (savedOrg) this.org = JSON.parse(savedOrg);

      return { token: this.token, user: this.user, org: this.org };
    } catch (e) {
      console.warn('[API] Init error:', e);
      return { token: null, user: null, org: null };
    }
  }

  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/$/, '');
    AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, this.baseUrl).catch(() => {});
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeoutMs = options.timeout || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // If token expired, clear session
        if (response.status === 401 && this.token) {
          await this.logout().catch(() => {});
        }
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Connection timed out after ${timeoutMs / 1000}s. Cannot reach EMS backend at ${this.baseUrl}.`);
      }
      if (err.message && (err.message.includes('Network request failed') || err.message.includes('Failed to fetch'))) {
        throw new Error(`Cannot reach EMS backend at ${this.baseUrl}. Verify that your device and computer are on the same Wi-Fi and backend is running.`);
      }
      throw err;
    }
  }

  // ── Auth ──────────────────────────────────────────────
  async login(email, password, portal = 'employee', companyId = null) {
    const body = { email, password, portal };
    if (companyId) body.companyId = companyId;

    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (data.success && data.token) {
      this.token = data.token;
      this.user = data.user;
      this.org = data.organization;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
        AsyncStorage.setItem(STORAGE_KEYS.ORG, JSON.stringify(data.organization))
      ]);
    }

    return data;
  }

  async registerCompany(payload) {
    const data = await this.request('/api/auth/register-company', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data.success && data.token) {
      this.token = data.token;
      this.user = data.user;
      this.org = data.organization;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
        AsyncStorage.setItem(STORAGE_KEYS.ORG, JSON.stringify(data.organization))
      ]);
    }

    return data;
  }

  async joinCompany(payload) {
    const data = await this.request('/api/auth/join-company', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data.success && data.token) {
      this.token = data.token;
      this.user = data.user;
      this.org = data.organization;

      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, data.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
        AsyncStorage.setItem(STORAGE_KEYS.ORG, JSON.stringify(data.organization))
      ]);
    }

    return data;
  }

  async forgotPassword(email) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(payload) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async logout() {
    this.token = null;
    this.user = null;
    this.org = null;
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.USER),
      AsyncStorage.removeItem(STORAGE_KEYS.ORG)
    ]);
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  // ── Company Verification ─────────────────────────────
  async verifyCompanyCode(companyCode) {
    return this.request('/api/companies/verify-code', {
      method: 'POST',
      body: JSON.stringify({ companyCode })
    });
  }

  async checkCompanyCodeAvailability(companyCode) {
    return this.request('/api/companies/check-code-availability', {
      method: 'POST',
      body: JSON.stringify({ companyCode })
    });
  }

  // ── Attendance ────────────────────────────────────────
  async punchIn(payload) {
    return this.request('/api/attendance/punch-in', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async punchOut(payload) {
    return this.request('/api/attendance/punch-out', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getTodayAttendance() {
    return this.request('/api/attendance/today');
  }

  async getAttendanceHistory(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/attendance${qs ? `?${qs}` : ''}`);
  }

  async getAttendanceStats() {
    return this.request('/api/attendance/stats');
  }

  // ── Users & Employees ────────────────────────────────
  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/users${qs ? `?${qs}` : ''}`);
  }

  async getUser(id) {
    return this.request(`/api/users/${id}`);
  }

  async createUser(payload) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateUser(id, payload) {
    return this.request(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  // ── Employee Invitations ──────────────────────────────
  async getInvitations() {
    return this.request('/api/invitations');
  }

  async createInvitation(payload) {
    return this.request('/api/invitations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async revokeInvitation(id) {
    return this.request(`/api/invitations/${id}/revoke`, {
      method: 'POST'
    });
  }

  // ── Daily Reports ─────────────────────────────────────
  async getDailyReports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/daily-reports${qs ? `?${qs}` : ''}`);
  }

  async getDailyReportDraft() {
    return this.request('/api/daily-reports/draft');
  }

  async saveDailyReportDraft(payload) {
    return this.request('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify({ ...payload, isDraft: true })
    });
  }

  async submitDailyReport(payload) {
    return this.request('/api/daily-reports', {
      method: 'POST',
      body: JSON.stringify({ ...payload, isDraft: false })
    });
  }

  async exportDailyReports(params = {}) {
    const qs = new URLSearchParams({ ...params, base64: 'true' }).toString();
    return this.request(`/api/daily-reports/export?${qs}`);
  }

  // ── Bank Details ──────────────────────────────────────
  async getBankDetails() {
    return this.request('/api/bank-details/me');
  }

  async submitBankDetails(payload) {
    return this.request('/api/bank-details', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getAdminBankDetails() {
    return this.request('/api/admin/bank-details');
  }

  async verifyBankDetails(id, status, rejectionReason) {
    return this.request(`/api/admin/bank-details/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason })
    });
  }

  // ── Profile Updates ───────────────────────────────────
  async getProfileUpdateRequests() {
    return this.request('/api/profile/update-requests/me');
  }

  async submitProfileUpdateRequest(fieldName, newValue, currentValue) {
    return this.request('/api/profile/update-request', {
      method: 'POST',
      body: JSON.stringify({ fieldName, newValue, currentValue })
    });
  }

  async getAdminProfileUpdateRequests() {
    return this.request('/api/admin/profile-update-requests');
  }

  async reviewProfileUpdateRequest(id, status, rejectionReason) {
    return this.request(`/api/admin/profile-update-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason })
    });
  }

  async updateProfilePhoto(photoUrl) {
    return this.request('/api/profile/photo', {
      method: 'POST',
      body: JSON.stringify({ photoUrl })
    });
  }

  // ── Salary Advances ───────────────────────────────────
  async getSalaryAdvances() {
    return this.request('/api/advances/me');
  }

  async submitSalaryAdvance(payload) {
    return this.request('/api/advances', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getAdminSalaryAdvances() {
    return this.request('/api/admin/advances');
  }

  async approveSalaryAdvance(id, action, approvedAmount, remarks) {
    return this.request(`/api/admin/advances/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ action, approvedAmount, remarks })
    });
  }

  async recordAdvancePayment(id, payload) {
    return this.request(`/api/admin/advances/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ── Leaves ────────────────────────────────────────────
  async getLeaves(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/leaves${qs ? `?${qs}` : ''}`);
  }

  async submitLeave(payload) {
    return this.request('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateLeaveStatus(id, status, decisionComment) {
    return this.request(`/api/leaves/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, decisionComment })
    });
  }

  // ── Announcements ─────────────────────────────────────
  async getAnnouncements(publishedOnly = false) {
    return this.request(`/api/announcements${publishedOnly ? '?publishedOnly=true' : ''}`);
  }

  async createAnnouncement(payload) {
    return this.request('/api/announcements', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async deleteAnnouncement(id) {
    return this.request(`/api/announcements/${id}`, {
      method: 'DELETE'
    });
  }

  // ── Company Rules ─────────────────────────────────────
  async getRules(publishedOnly = false) {
    return this.request(`/api/rules${publishedOnly ? '?publishedOnly=true' : ''}`);
  }

  async createRule(payload) {
    return this.request('/api/rules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ── Org Settings ──────────────────────────────────────
  async getOrgSettings() {
    return this.request('/api/org/settings');
  }

  async updateOrgSettings(payload) {
    return this.request('/api/org/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  // ── Holidays & Notifications ─────────────────────────
  async getHolidays() {
    return this.request('/api/holidays');
  }

  // ── Team Leader & Management Audits ──────────────────
  async getAudits(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/audits${qs ? `?${qs}` : ''}`);
  }

  // ── Timesheets ────────────────────────────────────────
  async getTimesheets() {
    return this.request('/api/timesheets');
  }

  async submitTimesheet(payload) {
    return this.request('/api/timesheets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

export const api = new ApiService();
export default api;
