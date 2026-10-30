/**
 * EMS Web Dashboard API Service
 * Multi-Organization Backend Integration
 */

const BASE_URL = 'http://localhost:5000';

class WebApiService {
  constructor() {
    this.token = localStorage.getItem('ems_web_token') || null;
    this.user = JSON.parse(localStorage.getItem('ems_web_user') || 'null');
    this.org = JSON.parse(localStorage.getItem('ems_web_org') || 'null');
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Request failed`);
      }

      return data;
    } catch (err) {
      console.warn(`[Web API] ${options.method || 'GET'} ${endpoint} error:`, err.message);
      throw err;
    }
  }

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.success && data.token) {
      this.token = data.token;
      this.user = data.user;
      this.org = data.organization;

      localStorage.setItem('ems_web_token', data.token);
      localStorage.setItem('ems_web_user', JSON.stringify(data.user));
      localStorage.setItem('ems_web_org', JSON.stringify(data.organization));
    }

    return data;
  }

  logout() {
    this.token = null;
    this.user = null;
    this.org = null;
    localStorage.removeItem('ems_web_token');
    localStorage.removeItem('ems_web_user');
    localStorage.removeItem('ems_web_org');
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async getStats() {
    return this.request('/api/attendance/stats');
  }

  async getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/users${qs ? `?${qs}` : ''}`);
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

  async getAttendance(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/attendance${qs ? `?${qs}` : ''}`);
  }

  async getDailyReports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/daily-reports${qs ? `?${qs}` : ''}`);
  }

  async getEmployeesWithDailyReports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/daily-reports/employees-summary${qs ? `?${qs}` : ''}`);
  }

  async getEmployeeReportProfile(employeeId) {
    return this.request(`/api/daily-reports/employee/${encodeURIComponent(employeeId)}`);
  }

  async assignTaskToEmployee(payload) {
    return this.request('/api/daily-reports/assign-task', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateTaskStatus(payload) {
    return this.request('/api/daily-reports/tasks/status', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getTaskReportsForDateRange(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/api/daily-reports/date-range${qs ? `?${qs}` : ''}`);
  }

  async getEmployeeSpreadsheetData({ employeeId, startDate, endDate }) {
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    return this.request(`/api/management/task-reports/employees/${encodeURIComponent(employeeId)}/spreadsheet?${qs}`);
  }

  async downloadEmployeeTaskReportsExcel({ employeeId, startDate, endDate }) {
    const qs = new URLSearchParams({ startDate, endDate }).toString();
    return this.request(`/api/management/task-reports/employees/${encodeURIComponent(employeeId)}/export?${qs}`);
  }

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

  // ── Salary Advances (Shared Contracts) ────────────────
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

  // ── Holidays & Notifications ──────────────────────────
  async getHolidays() {
    return this.request('/api/holidays');
  }

  async getNotifications() {
    return this.request('/api/notifications');
  }

  async markNotificationRead(id) {
    return this.request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.request('/api/notifications/mark-all-read', { method: 'POST' });
  }

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

  async getRules(publishedOnly = false) {
    return this.request(`/api/rules${publishedOnly ? '?publishedOnly=true' : ''}`);
  }

  async createRule(payload) {
    return this.request('/api/rules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getOrgSettings() {
    return this.request('/api/org/settings');
  }

  async updateOrgSettings(payload) {
    return this.request('/api/org/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }
}

export const webApi = new WebApiService();
export default webApi;
