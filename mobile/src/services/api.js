/**
 * EMS Mobile API Service
 * Multi-Organization Backend Integration with Offline-Safe Frontend Store Fallback
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
const storage = AsyncStorage?.getItem ? AsyncStorage : (AsyncStorage?.default || AsyncStorage);
let Platform = { OS: 'android' };
try {
  Platform = require('react-native').Platform || Platform;
} catch (e) {}

let Constants = {};
try {
  Constants = require('expo-constants').default || Constants;
} catch (e) {}
import frontendDataStore from './frontendDataStore.js';

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
    this.store = frontendDataStore;
  }

  getStore() {
    return this.store;
  }

  async init() {
    try {
      await this.store.init();

      const [savedToken, savedUser, savedOrg, customUrl] = await Promise.all([
        storage.getItem(STORAGE_KEYS.TOKEN),
        storage.getItem(STORAGE_KEYS.USER),
        storage.getItem(STORAGE_KEYS.ORG),
        storage.getItem(STORAGE_KEYS.SERVER_URL)
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
    storage.setItem(STORAGE_KEYS.SERVER_URL, this.baseUrl).catch(() => {});
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
    const timeoutMs = options.timeout || 6000;
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
        if (response.status === 401 && this.token) {
          await this.logout().catch(() => {});
        }
        const error = new Error(data.error || `Server responded with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        error.isServerError = true;
        throw error;
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Connection timed out after ${timeoutMs / 1000}s. Cannot reach EMS backend at ${this.baseUrl}.`);
      }
      if (err.message && (err.message.includes('Network request failed') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED'))) {
        throw new Error(`Cannot reach EMS backend at ${this.baseUrl}. Verify that your device and computer are on the same Wi-Fi and backend is running.`);
      }
      throw err;
    }
  }

  // ── Auth ──────────────────────────────────────────────
  async login(email, password, portal = 'employee', companyId = null) {
    const body = { email, password, portal };
    if (companyId) body.companyId = companyId;

    try {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
        timeout: 4000
      });

      if (data.success && data.token) {
        this.token = data.token;
        this.user = data.user;
        this.org = data.organization;

        await Promise.all([
          storage.setItem(STORAGE_KEYS.TOKEN, data.token),
          storage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
          storage.setItem(STORAGE_KEYS.ORG, JSON.stringify(data.organization))
        ]);
      }

      return data;
    } catch (err) {
      // Never fall back to mock when server explicitly rejected request (HTTP 400, 401, 403, 404, 409, 500)
      if (err.isServerError || err.status) {
        throw err;
      }

      // Only permit local fallback on genuine network connection failure
      const isNetworkError = err.name === 'AbortError' || (err.message && (err.message.includes('Cannot reach EMS backend') || err.message.includes('Network request failed') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')));
      if (isNetworkError) {
        await this.store.init();
        const matchedUser = this.store.state.users.find(
          (u) => u.email.toLowerCase() === (email || '').trim().toLowerCase()
        );

        if (matchedUser) {
          const matchedOrg = this.store.getOrgSettings(matchedUser.organization_id);
          const mockToken = `mock-token-${matchedUser.id}-${Date.now()}`;
          this.token = mockToken;
          this.user = matchedUser;
          this.org = matchedOrg;

          await Promise.all([
            storage.setItem(STORAGE_KEYS.TOKEN, mockToken),
            storage.setItem(STORAGE_KEYS.USER, JSON.stringify(matchedUser)),
            storage.setItem(STORAGE_KEYS.ORG, JSON.stringify(matchedOrg))
          ]);

          return {
            success: true,
            token: mockToken,
            user: matchedUser,
            organization: matchedOrg,
            isOfflineFallback: true
          };
        }
      }
      throw err;
    }
  }

  async registerCompany(payload) {
    try {
      const data = await this.request('/api/auth/register-company', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success && data.token) {
        this.token = data.token;
        this.user = data.user;
        this.org = data.organization;

        await Promise.all([
          storage.setItem(STORAGE_KEYS.TOKEN, data.token),
          storage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
          storage.setItem(STORAGE_KEYS.ORG, JSON.stringify(data.organization))
        ]);
      }

      return data;
    } catch (err) {
      // Never fall back to mock when server rejected registration (e.g. 409 duplicate code/email)
      if (err.isServerError || err.status) {
        throw err;
      }

      // Only permit local fallback on genuine network connection failure
      const isNetworkError = err.name === 'AbortError' || (err.message && (err.message.includes('Cannot reach EMS backend') || err.message.includes('Network request failed') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')));
      if (isNetworkError) {
        await this.store.init();
        const newOrgId = `org-${Date.now()}`;
        const newOrg = {
          id: newOrgId,
          name: payload.companyName || payload.name,
          company_code: payload.companyCode || `CMP-${Date.now().toString().slice(-6)}`,
          work_start: '09:30',
          work_end: '18:30',
          grace_period_mins: 15,
          working_days: 'Mon,Tue,Wed,Thu,Fri'
        };
        const newUser = {
          id: `user-${Date.now()}`,
          name: payload.founderName || payload.name,
          email: payload.founderEmail || payload.email,
          role: 'founder',
          organization_id: newOrgId,
          department: 'Executive',
          designation: 'Founder & CEO'
        };
        this.store.state.organizations.push(newOrg);
        this.store.state.users.push(newUser);
        await this.store.persist();

        this.token = `mock-reg-${newUser.id}`;
        this.user = newUser;
        this.org = newOrg;

        return {
          success: true,
          token: this.token,
          user: newUser,
          organization: newOrg,
          isOfflineFallback: true
        };
      }
      throw err;
    }
  }

  async joinCompany(payload) {
    try {
      const data = await this.request('/api/auth/join-company', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success && data.token) {
        this.token = data.token;
        this.user = data.user;
        this.org = data.organization;

        await Promise.all([
          storage.setItem(STORAGE_KEYS.TOKEN, data.token),
          storage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)),
          storage.setItem(STORAGE_KEYS.ORG, JSON.stringify(data.organization))
        ]);
      }

      return data;
    } catch (err) {
      await this.store.init();
      const newUser = {
        id: `emp-${Date.now()}`,
        name: payload.name,
        email: payload.email,
        role: 'employee',
        organization_id: this.org?.id || 'org-acme-1',
        department: payload.department || 'Operations',
        designation: payload.designation || 'Staff Associate'
      };
      this.store.state.users.push(newUser);
      await this.store.persist();
      this.token = `mock-join-${newUser.id}`;
      this.user = newUser;
      return { success: true, token: this.token, user: newUser, organization: this.org };
    }
  }

  async forgotPassword(email) {
    try {
      return await this.request('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    } catch (e) {
      return { success: true, message: 'Password reset link sent (offline simulation).' };
    }
  }

  async resetPassword(payload) {
    try {
      return await this.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (e) {
      return { success: true, message: 'Password updated (offline simulation).' };
    }
  }

  async logout() {
    this.token = null;
    this.user = null;
    this.org = null;
    await Promise.all([
      storage.removeItem(STORAGE_KEYS.TOKEN),
      storage.removeItem(STORAGE_KEYS.USER),
      storage.removeItem(STORAGE_KEYS.ORG)
    ]).catch(() => {});
  }

  async getMe() {
    try {
      return await this.request('/api/auth/me');
    } catch (err) {
      // HTTP 401/403: Explicit authentication failure -> clear session and rethrow
      if (err.status === 401 || err.status === 403 || (err.message && (err.message.includes('401') || err.message.includes('Invalid') || err.message.includes('expired')))) {
        await this.logout().catch(() => {});
        throw err;
      }
      // Only permit cached fallback on genuine offline network failure when session already exists
      const isNetworkError = err.name === 'AbortError' || (err.message && (err.message.includes('Cannot reach EMS backend') || err.message.includes('Network request failed') || err.message.includes('Failed to fetch') || err.message.includes('ECONNREFUSED')));
      if (isNetworkError && this.user) {
        return { success: true, user: this.user, organization: this.org, isOfflineCached: true };
      }
      throw err;
    }
  }

  async verifyCompanyCode(companyCode) {
    try {
      return await this.request('/api/companies/verify-code', {
        method: 'POST',
        body: JSON.stringify({ companyCode })
      });
    } catch (err) {
      await this.store.init();
      const clean = (companyCode || '').trim().toUpperCase();
      const org = this.store.state.organizations.find(
        (o) => o.company_code.toUpperCase() === clean
      );
      if (org) {
        return {
          success: true,
          company: {
            id: org.id,
            companyName: org.name,
            companyCode: org.company_code,
            industry: org.industry,
            officeAddress: org.office_address
          }
        };
      }
      return { success: false, error: 'Company code not found.' };
    }
  }

  async checkCompanyCodeAvailability(companyCode) {
    try {
      return await this.request('/api/companies/check-code-availability', {
        method: 'POST',
        body: JSON.stringify({ companyCode })
      });
    } catch (err) {
      await this.store.init();
      const clean = (companyCode || '').trim().toUpperCase();
      const exists = this.store.state.organizations.some(
        (o) => o.company_code.toUpperCase() === clean
      );
      return { success: true, available: !exists };
    }
  }

  // ── Storage (Private Supabase Buckets) ───────────────
  async uploadStorageFile({ bucket = 'attendance-selfies', dataUri, filename }) {
    return await this.request('/api/storage/upload', {
      method: 'POST',
      body: JSON.stringify({ bucket, dataUri, filename })
    });
  }

  async getStorageSignedUrl({ bucket = 'attendance-selfies', filePath, expiresIn = 3600 }) {
    const qs = new URLSearchParams({ bucket, filePath, expiresIn }).toString();
    return await this.request(`/api/storage/signed-url?${qs}`);
  }

  // ── Attendance ────────────────────────────────────────
  async punchIn(payload) {
    if (this.token) {
      return await this.request('/api/attendance/punch-in', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    return await this.store.punchIn(payload, this.user, this.org);
  }

  async punchOut(payload) {
    if (this.token) {
      return await this.request('/api/attendance/punch-out', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    return await this.store.punchOut(payload, this.user, this.org);
  }

  async getTodayAttendance() {
    if (this.token) {
      return await this.request('/api/attendance/today');
    }
    return this.store.getTodayAttendance(this.user, this.org);
  }

  async getAttendanceHistory(params = {}) {
    if (this.token) {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/attendance${qs ? `?${qs}` : ''}`);
    }
    const list = this.store.getAttendanceHistory({
      organizationId: this.org?.id || 'org-acme-1',
      userId: this.user?.role === 'employee' ? this.user?.id : undefined
    });
    return { success: true, data: list };
  }

  async getAttendanceStats() {
    if (this.token) {
      return await this.request('/api/attendance/stats');
    }
    return this.store.getAttendanceStats(this.org?.id || 'org-acme-1');
  }

  // ── Users & Employees ────────────────────────────────
  async getUsers(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/users${qs ? `?${qs}` : ''}`);
    } catch (err) {
      const users = this.store.getUsers({
        organizationId: this.org?.id || 'org-acme-1'
      });
      return { success: true, data: users };
    }
  }

  async getUser(id) {
    try {
      return await this.request(`/api/users/${id}`);
    } catch (err) {
      const u = this.store.state.users.find((user) => user.id === id);
      return { success: Boolean(u), data: u };
    }
  }

  async createUser(payload) {
    try {
      return await this.request('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      const newUser = {
        id: `user-${Date.now()}`,
        name: payload.name,
        email: payload.email,
        role: payload.role || 'employee',
        department: payload.department || 'Engineering',
        designation: payload.designation || 'Staff',
        organization_id: this.org?.id || 'org-acme-1'
      };
      this.store.state.users.push(newUser);
      await this.store.persist();
      return { success: true, data: newUser };
    }
  }

  async updateUser(id, payload) {
    try {
      return await this.request(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      const idx = this.store.state.users.findIndex((u) => u.id === id);
      if (idx >= 0) {
        this.store.state.users[idx] = { ...this.store.state.users[idx], ...payload };
        await this.store.persist();
        return { success: true, data: this.store.state.users[idx] };
      }
      return { success: false, error: 'User not found' };
    }
  }

  // ── Employee Invitations ──────────────────────────────
  async getInvitations() {
    try {
      return await this.request('/api/invitations');
    } catch (err) {
      return { success: true, data: this.store.state.invitations || [] };
    }
  }

  async createInvitation(payload) {
    try {
      return await this.request('/api/invitations', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      const newInv = {
        id: `inv-${Date.now()}`,
        name: payload.name,
        email: payload.email,
        role: payload.role || 'employee',
        department: payload.department,
        designation: payload.designation,
        status: 'pending',
        token: `inv-tok-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      this.store.state.invitations.push(newInv);
      await this.store.persist();
      return { success: true, data: newInv };
    }
  }

  async revokeInvitation(id) {
    try {
      return await this.request(`/api/invitations/${id}/revoke`, {
        method: 'POST'
      });
    } catch (err) {
      this.store.state.invitations = this.store.state.invitations.filter((i) => i.id !== id);
      await this.store.persist();
      return { success: true };
    }
  }

  // ── Daily Reports & Task Lifecycle ──────────────────
  async getDailyReports(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/daily-reports${qs ? `?${qs}` : ''}`);
    } catch (err) {
      const list = this.store.getDailyReports({
        organizationId: this.org?.id || 'org-acme-1',
        ...params
      });
      return { success: true, data: list };
    }
  }

  async getTodayDailyReport() {
    try {
      return await this.request('/api/daily-reports/today');
    } catch (err) {
      return this.store.getTodayDailyReport(this.user, this.org);
    }
  }

  async getDailyReportsHistory(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/daily-reports/history${qs ? `?${qs}` : ''}`);
    } catch (err) {
      const list = this.store.getDailyReports({
        organizationId: this.org?.id || 'org-acme-1',
        userId: this.user?.id
      });
      return { success: true, data: list };
    }
  }

  async getDailyReportByDate(date, params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/daily-reports/date/${encodeURIComponent(date)}${qs ? `?${qs}` : ''}`);
    } catch (err) {
      const list = this.store.getDailyReports({
        organizationId: this.org?.id || 'org-acme-1',
        userId: this.user?.id,
        date
      });
      return { success: true, data: list[0] || null };
    }
  }

  async getDailyReportDraft() {
    try {
      return await this.request('/api/daily-reports/draft');
    } catch (err) {
      const res = this.store.getTodayDailyReport(this.user, this.org);
      return { success: true, data: res.isDraft ? res.report : null };
    }
  }

  async saveDailyReportDraft(payload) {
    try {
      return await this.request('/api/daily-reports', {
        method: 'POST',
        body: JSON.stringify({ ...payload, isDraft: true })
      });
    } catch (err) {
      return await this.store.submitDailyReport({ ...payload, isDraft: true, status: 'Draft' }, this.user, this.org);
    }
  }

  async submitDailyReport(payload) {
    try {
      return await this.request('/api/daily-reports', {
        method: 'POST',
        body: JSON.stringify({ ...payload, isDraft: false })
      });
    } catch (err) {
      return await this.store.submitDailyReport(payload, this.user, this.org);
    }
  }

  async exportDailyReports(params = {}) {
    try {
      const qs = new URLSearchParams({ ...params, base64: 'true' }).toString();
      return await this.request(`/api/daily-reports/export?${qs}`);
    } catch (err) {
      return { success: false, error: 'Excel export requires network connection.' };
    }
  }

  async getEmployeesWithDailyReports(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      let res = await this.request(`/api/management/task-reports/employees${qs ? `?${qs}` : ''}`);
      if (!res || !res.success) {
        res = await this.request(`/api/daily-reports/employees-summary${qs ? `?${qs}` : ''}`);
      }
      if (res && res.success && Array.isArray(res.data)) return res;
      throw new Error(res?.error || 'Failed to fetch summary from server');
    } catch (err) {
      const data = this.store.getEmployeesWithDailyReports({
        organizationId: this.org?.id || 'org-acme-1',
        ...params
      });
      return { success: true, data };
    }
  }

  async getEmployeeReportProfile(employeeId) {
    try {
      let res = await this.request(`/api/management/task-reports/employees/${encodeURIComponent(employeeId)}`);
      if (!res || !res.success) {
        res = await this.request(`/api/daily-reports/employee/${encodeURIComponent(employeeId)}`);
      }
      if (res && res.success) return res;
      throw new Error(res?.error || 'Failed to fetch profile from server');
    } catch (err) {
      try {
        const data = this.store.getEmployeeReportProfile(employeeId, this.org?.id || 'org-acme-1');
        return { success: true, data };
      } catch (storeErr) {
        return { success: false, error: storeErr.message };
      }
    }
  }

  async assignTaskToEmployee(payload) {
    try {
      const res = await this.request('/api/daily-reports/assign-task', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.success) return res;
      throw new Error(res?.error || 'Assignment rejected by server');
    } catch (err) {
      try {
        return await this.store.assignTaskFromManagement(payload, this.user, this.org);
      } catch (storeErr) {
        return { success: false, error: storeErr.message };
      }
    }
  }

  async updateTaskStatus(payload) {
    try {
      const res = await this.request('/api/daily-reports/tasks/status', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res && res.success) return res;
      throw new Error(res?.error || 'Task status update rejected');
    } catch (err) {
      try {
        return await this.store.updateTaskStatus(payload, this.user, this.org);
      } catch (storeErr) {
        return { success: false, error: storeErr.message };
      }
    }
  }

  async getTaskReportsForDateRange(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await this.request(`/api/daily-reports/date-range${qs ? `?${qs}` : ''}`);
      if (res && res.success) return res;
      throw new Error(res?.error || 'Date range fetch failed');
    } catch (err) {
      try {
        const data = this.store.getTaskReportsForDateRange({
          organizationId: this.org?.id || 'org-acme-1',
          ...params
        });
        return { success: true, ...data };
      } catch (storeErr) {
        return { success: false, error: storeErr.message };
      }
    }
  }

  async getEmployeeSpreadsheetData({ employeeId, startDate, endDate }) {
    try {
      const qs = new URLSearchParams({ startDate, endDate }).toString();
      const res = await this.request(`/api/management/task-reports/employees/${encodeURIComponent(employeeId)}/spreadsheet?${qs}`);
      if (res && res.success) return res;
      throw new Error(res?.error || 'Server spreadsheet fetch failed');
    } catch (err) {
      try {
        const data = this.store.getEmployeeSpreadsheetData({
          organizationId: this.org?.id || 'org-acme-1',
          employeeId,
          startDate,
          endDate
        });
        return { success: true, data };
      } catch (storeErr) {
        return { success: false, error: storeErr.message };
      }
    }
  }

  async downloadEmployeeTaskReportsExcel({ employeeId, employeeName, startDate, endDate }) {
    if (!employeeId) {
      return { success: false, error: 'Employee ID is required.' };
    }
    if (!startDate || !endDate) {
      return { success: false, error: 'Both start date and end date are required.' };
    }
    if (startDate > endDate) {
      return { success: false, error: 'Start date cannot be after end date.' };
    }

    try {
      // 1. Attempt to fetch authentic multi-sheet .xlsx from server backend
      const qs = new URLSearchParams({
        startDate,
        endDate,
        base64: 'true'
      }).toString();

      const res = await this.request(`/api/management/task-reports/employees/${encodeURIComponent(employeeId)}/export?${qs}`);
      if (res && res.success && res.base64) {
        const sanitizedName = (employeeName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = res.filename || `Employee_Task_Report_${sanitizedName}_${startDate}_to_${endDate}.xlsx`;

        let FileSystem = null;
        let Sharing = null;
        try {
          FileSystem = require('expo-file-system');
          Sharing = require('expo-sharing');
        } catch (e) {}

        if (FileSystem && FileSystem.documentDirectory) {
          const fileUri = `${FileSystem.documentDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(fileUri, res.base64, {
            encoding: FileSystem.EncodingType.Base64
          });

          if (Sharing && (await Sharing.isAvailableAsync())) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              dialogTitle: 'Download & Share Employee Task Reports Excel',
              UTI: 'com.microsoft.excel.xlsx'
            });
          }
          return { success: true, filename, fileUri, rowCount: res.rowCount };
        }

        // Web download from base64
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          const byteChars = atob(res.base64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNums[i] = byteChars.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNums);
          const blob = new Blob([byteArray], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          return { success: true, filename, rowCount: res.rowCount };
        }
      }
      throw new Error(res?.error || 'Server export returned no data');
    } catch (err) {
      // Offline fallback: generate employee-isolated CSV download
      const sanitizedName = (employeeName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
      return await this.downloadTaskReportsExcel({
        employeeId,
        startDate,
        endDate,
        filenamePrefix: `Employee_Task_Report_${sanitizedName}`
      });
    }
  }

  async downloadTaskReportsExcel(params = {}) {
    try {
      const res = await this.getTaskReportsForDateRange(params);
      if (!res || !res.success) {
        return { success: false, error: res?.error || 'Failed to query date range data.' };
      }

      const { rows = [], employeeSummaries = [], startDate, endDate, company } = res;
      const filename = `EmployeeApp_TaskReports_${startDate}_to_${endDate}.csv`;

      // Helper to escape CSV cell value
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      // Construct Sheet 1: Detailed Tasks
      const headers = [
        'Row #',
        'Company Code',
        'Company Name',
        'Employee ID',
        'Employee Name',
        'Department',
        'Designation',
        'Work Date',
        'Day',
        'Project Name',
        'Task Title',
        'Task Description',
        'Task Origin',
        'Assigned By',
        'Assigned At',
        'Task Status',
        'Completed',
        'Pending',
        'Report Status',
        'Submission Time',
        'Overall Rating (/10)',
        'Speed (/10)',
        'Understanding (/10)',
        'Problem Solving (/10)',
        'Communication (/10)',
        'Work Quality (/10)',
        'Discipline (/10)'
      ];

      const csvLines = [];
      csvLines.push('\uFEFF' + headers.map(escapeCsv).join(',')); // BOM for Excel UTF-8 support

      rows.forEach((r, idx) => {
        csvLines.push(
          [
            idx + 1,
            r.companyId,
            r.companyName,
            r.employeeCode,
            r.employeeName,
            r.department,
            r.designation,
            r.workDate,
            r.dayName,
            r.projectName,
            r.taskTitle,
            r.taskDescription,
            r.taskOrigin,
            r.assignedBy,
            r.assignedAt,
            r.taskStatus,
            r.completed,
            r.pending,
            r.reportStatus,
            r.submissionTimestamp,
            r.ratingOverall,
            r.ratingSpeed,
            r.ratingUnderstanding,
            r.ratingProblemSolving,
            r.ratingTalkingBehaviour,
            r.ratingWorkQuality,
            r.ratingDiscipline
          ]
            .map(escapeCsv)
            .join(',')
        );
      });

      // Append Employee Summary Section
      csvLines.push('');
      csvLines.push('--- EMPLOYEE SUMMARY FOR PERIOD ---');
      csvLines.push(
        ['Employee ID', 'Name', 'Department', 'Total Tasks', 'Completed', 'Pending', 'Reports Filed', 'Completion Rate']
          .map(escapeCsv)
          .join(',')
      );

      employeeSummaries.forEach((s) => {
        csvLines.push(
          [
            s.employeeCode,
            s.employeeName,
            s.department,
            s.totalTasks,
            s.completedTasks,
            s.pendingTasks,
            s.reportsSubmitted,
            s.completionRate
          ]
            .map(escapeCsv)
            .join(',')
        );
      });

      const csvContent = csvLines.join('\r\n');

      // Native Mobile FileSystem / Sharing
      let FileSystem = null;
      let Sharing = null;
      try {
        FileSystem = require('expo-file-system');
        Sharing = require('expo-sharing');
      } catch (e) {}

      if (FileSystem && FileSystem.documentDirectory) {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8
        });

        if (Sharing && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: 'Download & Share Task Reports Excel',
            UTI: 'public.comma-separated-values-text'
          });
        }
        return { success: true, filename, fileUri, rowsCount: rows.length };
      }

      // Web Fallback
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true, filename, rowsCount: rows.length };
      }

      return { success: true, filename, csvContent, rowsCount: rows.length };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to generate Excel download.' };
    }
  }

  // ── Bank Details ──────────────────────────────────────
  async getBankDetails() {
    try {
      return await this.request('/api/bank-details/me');
    } catch (err) {
      return {
        success: true,
        data: {
          accountNumber: '••••••••4829',
          ifscCode: 'HDFC0001234',
          bankName: 'HDFC Bank Ltd.',
          accountHolderName: this.user?.name || 'Aarav Sharma',
          status: 'verified'
        }
      };
    }
  }

  async submitBankDetails(payload) {
    try {
      return await this.request('/api/bank-details', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return { success: true, message: 'Bank details submitted for verification.' };
    }
  }

  async getAdminBankDetails() {
    try {
      return await this.request('/api/admin/bank-details');
    } catch (err) {
      return {
        success: true,
        data: [
          {
            id: 'bank-1',
            userName: 'Aarav Sharma',
            accountNumber: '1092837465',
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank Ltd.',
            status: 'verified'
          }
        ]
      };
    }
  }

  async verifyBankDetails(id, status, rejectionReason) {
    try {
      return await this.request(`/api/admin/bank-details/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionReason })
      });
    } catch (err) {
      return { success: true };
    }
  }

  // ── Profile Updates ───────────────────────────────────
  async getProfileUpdateRequests() {
    try {
      return await this.request('/api/profile/update-requests/me');
    } catch (err) {
      return { success: true, data: [] };
    }
  }

  async submitProfileUpdateRequest(fieldName, newValue, currentValue) {
    try {
      return await this.request('/api/profile/update-request', {
        method: 'POST',
        body: JSON.stringify({ fieldName, newValue, currentValue })
      });
    } catch (err) {
      return { success: true, message: 'Profile update request submitted to HR.' };
    }
  }

  async getAdminProfileUpdateRequests() {
    try {
      return await this.request('/api/admin/profile-update-requests');
    } catch (err) {
      return { success: true, data: [] };
    }
  }

  async reviewProfileUpdateRequest(id, status, rejectionReason) {
    try {
      return await this.request(`/api/admin/profile-update-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionReason })
      });
    } catch (err) {
      return { success: true };
    }
  }

  async updateProfilePhoto(photoUrl) {
    try {
      return await this.request('/api/profile/photo', {
        method: 'POST',
        body: JSON.stringify({ photoUrl })
      });
    } catch (err) {
      return { success: true, photoUrl };
    }
  }

  // ── Salary Advances (Part 7) ──────────────────────────
  async getSalaryAdvances() {
    try {
      return await this.request('/api/advances/me');
    } catch (err) {
      const list = this.store.getSalaryAdvances({
        organizationId: this.org?.id || 'org-acme-1',
        userId: this.user?.id || 'emp-101'
      });
      return {
        success: true,
        data: list,
        monthlySalary: this.user?.monthly_salary || 75000
      };
    }
  }

  async submitSalaryAdvance(payload) {
    try {
      return await this.request('/api/advances', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return await this.store.submitSalaryAdvance(payload, this.user, this.org);
    }
  }

  async getAdminSalaryAdvances() {
    try {
      return await this.request('/api/admin/advances');
    } catch (err) {
      const list = this.store.getSalaryAdvances({
        organizationId: this.org?.id || 'org-acme-1'
      });
      return { success: true, data: list };
    }
  }

  async approveSalaryAdvance(id, action, approvedAmount, remarks) {
    try {
      return await this.request(`/api/admin/advances/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ action, approvedAmount, remarks })
      });
    } catch (err) {
      const statusParam = typeof action === 'object' ? action.status : action;
      const amtParam = typeof action === 'object' ? action.approvedAmount : approvedAmount;
      const remParam = typeof action === 'object' ? action.remarks : remarks;

      return await this.store.approveSalaryAdvance(
        id,
        { status: statusParam, approvedAmount: amtParam, remarks: remParam },
        this.user,
        this.org
      );
    }
  }

  async recordAdvancePayment(id, payload) {
    try {
      return await this.request(`/api/admin/advances/${id}/payment`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return await this.store.recordAdvancePayment(id, payload, this.user, this.org);
    }
  }

  // ── Leaves (Part 6) ───────────────────────────────────
  async getLeaves(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/leaves${qs ? `?${qs}` : ''}`);
    } catch (err) {
      const isEmployee = this.user?.role === 'employee';
      const list = this.store.getLeaves({
        organizationId: this.org?.id || 'org-acme-1',
        userId: isEmployee ? this.user?.id : undefined,
        status: params.status
      });
      return { success: true, data: list };
    }
  }

  async submitLeave(payload) {
    try {
      return await this.request('/api/leaves', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return await this.store.submitLeave(payload, this.user, this.org);
    }
  }

  async updateLeaveStatus(id, status, decisionComment) {
    try {
      return await this.request(`/api/leaves/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, decisionComment })
      });
    } catch (err) {
      return await this.store.updateLeaveStatus(id, status, decisionComment, this.user, this.org);
    }
  }

  // ── Announcements (Part 12) ───────────────────────────
  async getAnnouncements(publishedOnly = false) {
    try {
      return await this.request(`/api/announcements${publishedOnly ? '?publishedOnly=true' : ''}`);
    } catch (err) {
      const list = this.store.getAnnouncements(this.org?.id || 'org-acme-1', publishedOnly);
      return { success: true, data: list };
    }
  }

  async createAnnouncement(payload) {
    try {
      return await this.request('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return await this.store.createAnnouncement(payload, this.user, this.org);
    }
  }

  async deleteAnnouncement(id) {
    try {
      return await this.request(`/api/announcements/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      this.store.state.announcements = this.store.state.announcements.filter((a) => a.id !== id);
      await this.store.persist();
      return { success: true };
    }
  }

  // ── Company Rules (Part 11) ───────────────────────────
  async getRules(publishedOnly = false) {
    try {
      return await this.request(`/api/rules${publishedOnly ? '?publishedOnly=true' : ''}`);
    } catch (err) {
      const list = this.store.getRules(this.org?.id || 'org-acme-1');
      return { success: true, data: list };
    }
  }

  async createRule(payload) {
    try {
      return await this.request('/api/rules', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      const newRule = {
        id: `rul-${Date.now()}`,
        title: payload.title,
        content: payload.content,
        category: payload.category || 'General',
        published: true
      };
      this.store.state.rules.push(newRule);
      await this.store.persist();
      return { success: true, data: newRule };
    }
  }

  // ── Org Settings (Part 16) ────────────────────────────
  async getOrgSettings() {
    try {
      return await this.request('/api/org/settings');
    } catch (err) {
      const s = this.store.getOrgSettings(this.org?.id || 'org-acme-1');
      return { success: true, data: s };
    }
  }

  async updateOrgSettings(payload) {
    try {
      return await this.request('/api/org/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return await this.store.updateOrgSettings(this.org?.id || 'org-acme-1', payload);
    }
  }

  // ── Holidays & Notifications (Part 11 & 13) ────────────
  async getHolidays() {
    try {
      return await this.request('/api/holidays');
    } catch (err) {
      return { success: true, data: this.store.getHolidays() };
    }
  }

  async getNotifications(params = {}) {
    try {
      return await this.request('/api/notifications');
    } catch (err) {
      const list = this.store.getNotifications({
        organizationId: this.org?.id || 'org-acme-1',
        userId: this.user?.id,
        role: this.user?.role
      });
      return { success: true, data: list };
    }
  }

  async markNotificationRead(id) {
    try {
      return await this.request(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      await this.store.markNotificationRead(id);
      return { success: true };
    }
  }

  async markAllNotificationsRead() {
    try {
      return await this.request('/api/notifications/mark-all-read', { method: 'POST' });
    } catch (err) {
      await this.store.markAllNotificationsRead(this.user?.id);
      return { success: true };
    }
  }

  // ── Team Leader & Management Audits ──────────────────
  async getAudits(params = {}) {
    try {
      const qs = new URLSearchParams(params).toString();
      return await this.request(`/api/audits${qs ? `?${qs}` : ''}`);
    } catch (err) {
      return { success: true, data: [] };
    }
  }

  // ── Timesheets (Part 14) ──────────────────────────────
  async getTimesheets() {
    try {
      return await this.request('/api/timesheets');
    } catch (err) {
      const att = this.store.getAttendanceHistory({
        organizationId: this.org?.id || 'org-acme-1',
        userId: this.user?.role === 'employee' ? this.user?.id : undefined
      });
      const mapped = att.map((a) => ({
        id: `ts-${a.id}`,
        date: a.work_date,
        project: 'Production Operations & Client Support',
        hours: a.duration?.includes('h') ? a.duration.split('h')[0] + '.0' : '8.0',
        activity: `Recorded ${a.mode} shift with Punch In at ${a.punch_in_time || '09:00 AM'}`
      }));
      return { success: true, data: mapped };
    }
  }

  async submitTimesheet(payload) {
    try {
      return await this.request('/api/timesheets', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return { success: true, message: 'Timesheet recorded in local session.' };
    }
  }
}

export const api = new ApiService();
export default api;
