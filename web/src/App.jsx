import React, { useState } from 'react';
import {
  Users,
  Clock,
  FileText,
  Award,
  MapPin,
  LayoutDashboard,
  Search,
  Filter,
  Download,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Home,
  UserCheck,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Smartphone,
  Eye,
  Star,
  Table,
  FileSpreadsheet,
  Layers,
  Calendar,
  X
} from 'lucide-react';

import {
  mockStats,
  mockEmployees,
  mockAttendance,
  mockTaskReports,
  mockAudits,
  mockGeofence
} from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [notification, setNotification] = useState(null);

  // Daily Task Summary Spreadsheet states
  const [reportSearch, setReportSearch] = useState('');
  const [reportMonthFilter, setReportMonthFilter] = useState('all');
  const [reportProjectFilter, setReportProjectFilter] = useState('all');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportViewMode, setReportViewMode] = useState('spreadsheet'); // 'spreadsheet' | 'summary'
  const [selectedReportDetail, setSelectedReportDetail] = useState(null);

  const showToast = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // Filtered employees
  const filteredEmployees = mockEmployees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.designation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  // Filtered task reports for spreadsheet
  const filteredTaskReports = mockTaskReports.filter(rep => {
    const matchesSearch = rep.employeeName.toLowerCase().includes(reportSearch.toLowerCase()) ||
                          rep.tasksAssigned.toLowerCase().includes(reportSearch.toLowerCase());
    const matchesMonth = reportMonthFilter === 'all' || rep.month === reportMonthFilter;
    const matchesProject = reportProjectFilter === 'all' || rep.projectName === reportProjectFilter;
    const matchesStatus = reportStatusFilter === 'all' ||
                          (reportStatusFilter === 'completed' && rep.completed === 'Yes') ||
                          (reportStatusFilter === 'pending' && rep.pending === 'Yes');
    return matchesSearch && matchesMonth && matchesProject && matchesStatus;
  });

  // Employee-wise aggregated summary for Summary Cards view
  const employeeWiseReports = React.useMemo(() => {
    const map = {};
    filteredTaskReports.forEach(rep => {
      if (!map[rep.employeeName]) {
        map[rep.employeeName] = {
          employeeName: rep.employeeName,
          department: rep.department,
          month: rep.month,
          totalWorkingDays: rep.totalWorkingDays,
          tasks: [],
          completedCount: 0,
          pendingCount: 0,
          sumSpeed: 0,
          sumUnderstanding: 0,
          sumProblemSolving: 0,
          sumTalking: 0,
          sumQuality: 0,
          sumDiscipline: 0,
          sumOverall: 0,
          latestTlAudit: null
        };
      }
      const item = map[rep.employeeName];
      item.tasks.push(rep);
      if (rep.completed === 'Yes') item.completedCount += 1;
      if (rep.pending === 'Yes') item.pendingCount += 1;
      item.sumSpeed += Number(rep.speed || 0);
      item.sumUnderstanding += Number(rep.understanding || 0);
      item.sumProblemSolving += Number(rep.problemSolving || 0);
      item.sumTalking += Number(rep.talkingBehaviour || 0);
      item.sumQuality += Number(rep.workQuality || 0);
      item.sumDiscipline += Number(rep.discipline || 0);
      item.sumOverall += Number(rep.averageOverall || 0);
      if (!item.latestTlAudit || rep.date >= item.latestTlAudit.date) {
        item.latestTlAudit = {
          score: rep.tlAuditScore,
          remarks: rep.tlAuditRemarks,
          auditor: rep.tlAuditor,
          date: rep.date
        };
      }
    });

    return Object.values(map).map(emp => {
      const count = emp.tasks.length || 1;
      return {
        ...emp,
        avgSpeed: (emp.sumSpeed / count).toFixed(1),
        avgUnderstanding: (emp.sumUnderstanding / count).toFixed(1),
        avgProblemSolving: (emp.sumProblemSolving / count).toFixed(1),
        avgTalking: (emp.sumTalking / count).toFixed(1),
        avgQuality: (emp.sumQuality / count).toFixed(1),
        avgDiscipline: (emp.sumDiscipline / count).toFixed(1),
        avgOverall: (emp.sumOverall / count).toFixed(2)
      };
    });
  }, [filteredTaskReports]);

  // Functional CSV export matching the exact Excel spreadsheet columns
  const handleExportSpreadsheetCSV = () => {
    const headers = [
      'Employee Name',
      'Month',
      'Total Working Days',
      'Date',
      'Day',
      'Project Name',
      'Tasks Assigned',
      'Completed',
      'Pending',
      'Speed',
      'Understanding',
      'Problem Solving Approach',
      'Talking Behaviour',
      'Work Quality',
      'Discipline',
      'Average Overall',
      'Team Leader Audit Score',
      'Team Leader Audit Remarks',
      'Audited By',
      'Audited At'
    ];

    const rows = filteredTaskReports.map(r => [
      `"${r.employeeName}"`,
      `"${r.month}"`,
      r.totalWorkingDays,
      `"${r.date}"`,
      `"${r.day}"`,
      `"${r.projectName}"`,
      `"${(r.tasksAssigned || '').replace(/"/g, '""')}"`,
      `"${r.completed}"`,
      `"${r.pending}"`,
      r.speed,
      r.understanding,
      r.problemSolving,
      r.talkingBehaviour,
      r.workQuality,
      r.discipline,
      r.averageOverall,
      r.tlAuditScore,
      `"${(r.tlAuditRemarks || '').replace(/"/g, '""')}"`,
      `"${r.tlAuditor}"`,
      `"${r.tlAuditedAt}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EMS_Daily_Task_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Spreadsheet CSV generated and downloaded successfully!');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: '#414C30',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(65, 76, 48, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          border: '1px solid #687747'
        }}>
          <CheckCircle2 size={18} color="#E8EDDC" />
          <span>{notification}</span>
        </div>
      )}

      {/* Selfie Photo Modal Preview */}
      {selectedPhoto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(41, 45, 38, 0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={() => setSelectedPhoto(null)}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(41, 45, 38, 0.3)',
            border: '1px solid var(--border)',
            textAlign: 'center'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>Punch In Selfie Verification</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>{selectedPhoto.name} • {selectedPhoto.time}</p>
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '16px' }}>
              <img src={selectedPhoto.url} alt="Selfie" style={{ width: '100%', height: '320px', objectFit: 'cover' }} />
            </div>
            <div style={{ background: 'var(--bg-beige)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', textAlign: 'left', marginBottom: '16px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Location:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPhoto.location}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Geofence Check:</span>
                <span style={{ color: '#414C30', fontWeight: 700 }}>Verified by Haversine</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#687747',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close Verification
            </button>
          </div>
        </div>
      )}

      {/* Daily Task Summary Detail Modal */}
      {selectedReportDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(41, 45, 38, 0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }} onClick={() => setSelectedReportDetail(null)}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(41, 45, 38, 0.3)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-light-olive)', color: '#414C30' }}>
                    EXCEL SPREADSHEET ROW #{selectedReportDetail.id}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-beige)', color: 'var(--text-secondary)' }}>
                    {selectedReportDetail.month} • {selectedReportDetail.totalWorkingDays} Working Days
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedReportDetail.employeeName}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {selectedReportDetail.department} • {selectedReportDetail.date} ({selectedReportDetail.day})
                </p>
              </div>
              <button
                onClick={() => setSelectedReportDetail(null)}
                style={{
                  background: 'var(--bg-beige)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Task Details Section */}
            <div style={{ background: 'var(--bg-card-subtle)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  PROJECT: <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{selectedReportDetail.projectName}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: selectedReportDetail.completed === 'Yes' ? 'var(--bg-light-olive)' : 'var(--bg-beige)',
                    color: selectedReportDetail.completed === 'Yes' ? '#414C30' : 'var(--text-muted)'
                  }}>
                    Completed: {selectedReportDetail.completed}
                  </span>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: selectedReportDetail.pending === 'Yes' ? '#FAF4E8' : 'var(--bg-beige)',
                    color: selectedReportDetail.pending === 'Yes' ? '#C28424' : 'var(--text-muted)'
                  }}>
                    Pending: {selectedReportDetail.pending}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tasks Assigned / Summary:</strong>
                {selectedReportDetail.tasksAssigned}
              </div>
            </div>

            {/* Section 1: Employee Performance Ratings (Out of 10) */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Employee Performance Ratings</h4>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>6 core dimensions evaluated out of 10</p>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #687747, #414C30)',
                  color: '#ffffff',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Average Overall</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedReportDetail.averageOverall} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ 10</span></div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { label: '1. Speed', val: selectedReportDetail.speed },
                  { label: '2. Understanding', val: selectedReportDetail.understanding },
                  { label: '3. Problem Solving', val: selectedReportDetail.problemSolving },
                  { label: '4. Talking Behaviour', val: selectedReportDetail.talkingBehaviour },
                  { label: '5. Work Quality', val: selectedReportDetail.workQuality },
                  { label: '6. Discipline', val: selectedReportDetail.discipline }
                ].map(r => (
                  <div key={r.label} style={{ background: 'var(--bg-beige)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {r.val} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ 10</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Team Leader Audit (Distinct & Separate) */}
            <div style={{
              border: '2px solid #687747',
              borderRadius: '12px',
              padding: '18px',
              background: 'var(--bg-card-subtle)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#687747" />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#414C30' }}>Team Leader Audit</h4>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Independent supervisory audit (Cannot be altered by employees)
                  </p>
                </div>
                <div style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  background: '#687747',
                  color: '#ffffff',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>TL Score</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedReportDetail.tlAuditScore} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>/ 10</span></div>
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', fontSize: '0.78rem', color: '#414C30', marginBottom: '4px' }}>TL Audit Comments & Remarks:</strong>
                {selectedReportDetail.tlAuditRemarks}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Audited By: <strong>{selectedReportDetail.tlAuditor}</strong></span>
                <span>Audit Timestamp: {selectedReportDetail.tlAuditedAt}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedReportDetail(null)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#414C30',
                color: '#ffffff',
                borderRadius: '8px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Close Detail View
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: 'var(--bg-sidebar)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        borderRight: '1px solid rgba(221, 225, 211, 0.15)'
      }}>
        {/* Brand */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(221, 225, 211, 0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #687747, #57643A)',
              color: '#ffffff',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.2rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(232, 237, 220, 0.2)'
            }}>
              E
            </div>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>EMS Command</h1>
              <span style={{ fontSize: '0.72rem', color: '#DDE1D3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Founder Edition</span>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'employees', label: 'Staff Directory', icon: Users, badge: mockEmployees.length },
            { id: 'attendance', label: 'Attendance Logs', icon: Clock, badge: 'Live' },
            { id: 'reports', label: 'Daily Task Reports', icon: FileText },
            { id: 'audits', label: 'Leader Audits & Ratings', icon: Award },
            { id: 'geofence', label: 'Office Geofencing', icon: MapPin }
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  color: isActive ? '#ffffff' : '#DDE1D3',
                  background: isActive ? 'rgba(232, 237, 220, 0.16)' : 'transparent',
                  borderLeft: isActive ? '3px solid #E8EDDC' : '3px solid transparent',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                  width: '100%',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeftStyle: 'solid',
                  borderLeftWidth: '3px',
                  borderLeftColor: isActive ? '#E8EDDC' : 'transparent'
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-sidebar-hover)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={18} color={isActive ? '#E8EDDC' : '#DDE1D3'} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: isActive ? '#687747' : 'rgba(0, 0, 0, 0.25)',
                    color: '#ffffff',
                    fontWeight: 700
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile App Sync Notice */}
        <div style={{
          margin: '12px',
          padding: '14px',
          background: 'rgba(0, 0, 0, 0.18)',
          borderRadius: '12px',
          border: '1px solid rgba(232, 237, 220, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Smartphone size={16} color="#E8EDDC" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>Android App Ready</span>
          </div>
          <p style={{ fontSize: '0.74rem', color: '#DDE1D3', lineHeight: 1.4, margin: 0 }}>
            Connected to the same API. Selfies & GPS punches sync here live.
          </p>
        </div>

        {/* User Card */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(221, 225, 211, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#687747',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
            border: '1px solid rgba(232, 237, 220, 0.25)'
          }}>
            RD
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Rohan Deshmukh
            </div>
            <div style={{ fontSize: '0.72rem', color: '#DDE1D3' }}>Founder & Admin</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header style={{
          height: '70px',
          background: '#ffffff',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {activeTab === 'overview' && 'Founder Command Dashboard'}
              {activeTab === 'employees' && 'Staff & Team Directory'}
              {activeTab === 'attendance' && 'Daily Attendance & Geofence Logs'}
              {activeTab === 'reports' && 'Daily Work & EOD Reports'}
              {activeTab === 'audits' && 'Team Leader Performance Audits'}
              {activeTab === 'geofence' && 'Office Geofencing Perimeter'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Thursday, Oct 22, 2026 • Real-Time Enterprise Session
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--bg-light-olive)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              fontSize: '0.78rem',
              color: '#414C30',
              fontWeight: 700
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#687747' }} />
              API: Connected (Localhost:5000)
            </div>

            <button
              onClick={() => showToast('CSV Export generated and downloaded successfully (Sample demo).')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              Export CSV
            </button>

            <button
              onClick={() => showToast('Add Employee Modal opened (Placeholder for Stage 3).')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(104, 119, 71, 0.25)',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Add Employee
            </button>
          </div>
        </header>

        {/* Tab Content */}
        <div style={{ padding: '32px', flex: 1 }}>
          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Stat Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Headcount</span>
                    <div style={{ background: 'var(--bg-light-olive)', padding: '8px', borderRadius: '8px' }}>
                      <Users size={18} color="#687747" />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{mockStats.totalEmployees}</div>
                  <div style={{ fontSize: '0.78rem', color: '#414C30', fontWeight: 700, marginTop: '4px' }}>100% Active Staff</div>
                </div>

                <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Present Today</span>
                    <div style={{ background: 'var(--bg-light-olive)', padding: '8px', borderRadius: '8px' }}>
                      <UserCheck size={18} color="#414C30" />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{mockStats.presentToday}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#687747' }}>{mockStats.wfoCount} WFO</span> • <span style={{ fontWeight: 700, color: '#73776C' }}>{mockStats.wfhCount} WFH</span>
                  </div>
                </div>

                <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Geofence Accuracy</span>
                    <div style={{ background: 'var(--bg-beige)', padding: '8px', borderRadius: '8px' }}>
                      <MapPin size={18} color="#687747" />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{mockStats.geofenceCompliance}%</div>
                  <div style={{ fontSize: '0.78rem', color: '#414C30', fontWeight: 700, marginTop: '4px' }}>Office Perimeter Secure</div>
                </div>

                <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pending Audits</span>
                    <div style={{ background: '#FAF4E8', padding: '8px', borderRadius: '8px' }}>
                      <Award size={18} color="#C28424" />
                    </div>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{mockStats.pendingAudits}</div>
                  <div style={{ fontSize: '0.78rem', color: '#C28424', fontWeight: 700, marginTop: '4px' }}>Awaiting Team Leader Review</div>
                </div>
              </div>

              {/* Live Attendance Table */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Today's Live Attendance Feed</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Selfie captures & GPS calculations verified on backend</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    View All Attendance Logs <ChevronRight size={16} />
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-beige)', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Employee</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Mode</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Punch In</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Selfie Preview</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Geofence / Location</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAttendance.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: idx < mockAttendance.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img src={row.photoUrl} alt={row.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.department}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: row.mode === 'WFO' ? 'var(--bg-light-olive)' : 'var(--bg-beige)',
                            color: row.mode === 'WFO' ? '#414C30' : '#57643A'
                          }}>
                            {row.mode === 'WFO' ? <Building2 size={13} /> : <Home size={13} />}
                            {row.mode}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {row.punchIn}
                          {row.isLate && <span style={{ color: '#c0392b', fontSize: '0.75rem', marginLeft: '6px', fontWeight: 700 }}>(Late)</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => setSelectedPhoto({ url: row.photoUrl, name: row.name, time: row.punchIn, location: row.location })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-beige)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={14} /> View Selfie
                          </button>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#414C30', fontWeight: 700, fontSize: '0.82rem' }}>
                            <ShieldCheck size={16} color="#687747" />
                            {row.geofenceStatus}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{row.location}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => showToast(`Audit modal opened for ${row.name}`)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: 'var(--bg-card-subtle)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Audit Day
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: STAFF DIRECTORY */}
          {/* ========================================================================= */}
          {activeTab === 'employees' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Filter & Search Bar */}
              <div style={{
                background: '#fff',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: '16px',
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, background: 'var(--bg-beige)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <Search size={18} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search employee by name, email, or designation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ border: 'none', background: 'transparent', width: '100%', outline: 'none', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={16} color="var(--text-secondary)" />
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    <option value="all">All Departments</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
              </div>

              {/* Employees Table */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-beige)', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Employee</th>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Role</th>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Department</th>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Reporting To</th>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Phone</th>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '14px 20px', fontWeight: 700 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-secondary)' }}>
                          <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>No staff members found</div>
                          <div style={{ fontSize: '0.84rem' }}>No employee matches the current search or department filter.</div>
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp, idx) => (
                      <tr key={emp.id} style={{ borderBottom: idx < filteredEmployees.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img src={emp.avatar} alt={emp.name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: emp.role === 'team_leader' ? 'var(--bg-light-olive)' : 'var(--bg-beige)',
                            color: emp.role === 'team_leader' ? '#414C30' : '#57643A'
                          }}>
                            {emp.role === 'team_leader' ? 'Team Leader' : 'Employee'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', fontWeight: 600 }}>
                          <div>{emp.department}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{emp.designation}</div>
                        </td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{emp.teamLeader}</td>
                        <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{emp.phone}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: emp.status === 'active' ? 'var(--bg-light-olive)' : '#FAF0EE',
                            color: emp.status === 'active' ? '#414C30' : '#C0392B'
                          }}>
                            {emp.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => showToast(`Edit profile opened for ${emp.name}`)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: '#fff',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ATTENDANCE LOGS */}
          {/* ========================================================================= */}
          {activeTab === 'attendance' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Company Attendance Log</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Real-time punches recorded via Android app with selfie and GPS proof</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => showToast('Date filter opened (Placeholder)')} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                    Select Date: Today (Oct 22)
                  </button>
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-beige)', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Employee</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Mode</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Punch In</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Punch Out</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Geofence Math</th>
                      <th style={{ padding: '12px 20px', fontWeight: 700 }}>Selfie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockAttendance.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text-primary)' }}>{row.name}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontWeight: 700, color: row.mode === 'WFO' ? '#414C30' : '#57643A' }}>{row.mode}</span>
                        </td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>{row.punchIn}</td>
                        <td style={{ padding: '16px 20px', color: 'var(--text-secondary)' }}>{row.punchOut || '— Active Shift —'}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ color: '#414C30', fontWeight: 700 }}>{row.geofenceStatus}</span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button
                            onClick={() => setSelectedPhoto({ url: row.photoUrl, name: row.name, time: row.punchIn, location: row.location })}
                            style={{ padding: '6px 12px', background: 'var(--bg-light-olive)', color: '#414C30', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Inspect Selfie
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: DAILY TASK REPORTS — EXCEL SPREADSHEET VIEW */}
          {/* ========================================================================= */}
          {activeTab === 'reports' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header & Status Banner */}
              <div style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: '14px',
                border: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ background: 'var(--bg-light-olive)', padding: '6px', borderRadius: '8px', color: '#687747' }}>
                      <FileSpreadsheet size={22} />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Daily Task Summary — Excel Spreadsheet Format</h3>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Maps directly to the master company Excel spreadsheet format across 17 structured columns.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={handleExportSpreadsheetCSV}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      border: '1px solid #57643A',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <Download size={16} />
                    Export Spreadsheet CSV ({filteredTaskReports.length} rows)
                  </button>
                </div>
              </div>

              {/* Demo Mode Notice Banner */}
              <div style={{
                background: 'var(--bg-beige)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.83rem',
                color: 'var(--text-primary)'
              }}>
                <AlertTriangle size={18} color="#C28424" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#414C30' }}>DEMO TESTING DATASET:</strong> These task reports and ratings are simulated local test records for UI evaluation. No database has been connected or modified in this stage.
                </div>
              </div>

              {/* Controls, Filters & View Toggle */}
              <div style={{
                background: '#ffffff',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
                  {/* Search Input */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--bg-beige)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    minWidth: '240px'
                  }}>
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Search employee or task..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '100%', color: 'var(--text-primary)' }}
                    />
                    {reportSearch && (
                      <button onClick={() => setReportSearch('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Month Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={15} color="var(--text-secondary)" />
                    <select
                      value={reportMonthFilter}
                      onChange={(e) => setReportMonthFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="all">All Months</option>
                      <option value="October 2026">October 2026</option>
                      <option value="September 2026">September 2026</option>
                    </select>
                  </div>

                  {/* Project Filter */}
                  <select
                    value={reportProjectFilter}
                    onChange={(e) => setReportProjectFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="all">All Projects</option>
                    <option value="Android Mobile App">Android Mobile App</option>
                    <option value="Regional Logistics Hub">Regional Logistics Hub</option>
                    <option value="EMS Design Tokens">EMS Design Tokens</option>
                    <option value="Core Architecture">Core Architecture</option>
                  </select>

                  {/* Completion Status Filter */}
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="all">All Completion States</option>
                    <option value="completed">Completed Only (Yes)</option>
                    <option value="pending">Pending Only (Yes)</option>
                  </select>
                </div>

                {/* View Switcher: Spreadsheet vs Employee Summary */}
                <div style={{ display: 'flex', background: 'var(--bg-beige)', border: '1px solid var(--border)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                  <button
                    onClick={() => setReportViewMode('spreadsheet')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: reportViewMode === 'spreadsheet' ? '#ffffff' : 'transparent',
                      color: reportViewMode === 'spreadsheet' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      boxShadow: reportViewMode === 'spreadsheet' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <Table size={15} />
                    Spreadsheet Grid View
                  </button>
                  <button
                    onClick={() => setReportViewMode('summary')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: reportViewMode === 'summary' ? '#ffffff' : 'transparent',
                      color: reportViewMode === 'summary' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      boxShadow: reportViewMode === 'summary' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <Layers size={15} />
                    Employee Summary Cards
                  </button>
                </div>
              </div>

              {/* VIEW 1: SPREADSHEET GRID TABLE (ALL 17 COLUMNS) */}
              {reportViewMode === 'spreadsheet' && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: '1500px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                      <thead>
                        {/* Header Grouping Row */}
                        <tr style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          <th colSpan="9" style={{ padding: '8px 16px', background: 'var(--bg-beige)', color: 'var(--text-primary)', borderRight: '2px solid var(--border)', fontWeight: 800 }}>
                            Daily Task Assignment Information
                          </th>
                          <th colSpan="7" style={{ padding: '8px 16px', background: 'var(--bg-light-olive)', color: '#414C30', borderRight: '2px solid var(--border)', fontWeight: 800 }}>
                            Employee Performance Ratings (Out of 10)
                          </th>
                          <th colSpan="2" style={{ padding: '8px 16px', background: '#FAF4E8', color: '#7A5416', fontWeight: 800 }}>
                            Team Leader Audit (Distinct)
                          </th>
                        </tr>
                        {/* Specific Columns Header Row */}
                        <tr style={{ background: '#ffffff', borderBottom: '2px solid var(--border)', color: 'var(--text-primary)' }}>
                          <th style={{ padding: '12px 14px', fontWeight: 700, position: 'sticky', left: 0, background: '#ffffff', zIndex: 2, minWidth: '140px' }}>Employee Name</th>
                          <th style={{ padding: '12px 12px', fontWeight: 700, minWidth: '110px' }}>Month</th>
                          <th style={{ padding: '12px 10px', fontWeight: 700, minWidth: '80px', textAlign: 'center' }}>Total Days</th>
                          <th style={{ padding: '12px 12px', fontWeight: 700, minWidth: '100px' }}>Date</th>
                          <th style={{ padding: '12px 10px', fontWeight: 700, minWidth: '90px' }}>Day</th>
                          <th style={{ padding: '12px 12px', fontWeight: 700, minWidth: '140px' }}>Project Name</th>
                          <th style={{ padding: '12px 14px', fontWeight: 700, minWidth: '220px' }}>Tasks Assigned</th>
                          <th style={{ padding: '12px 10px', fontWeight: 700, minWidth: '85px', textAlign: 'center' }}>Completed</th>
                          <th style={{ padding: '12px 10px', fontWeight: 700, minWidth: '85px', textAlign: 'center', borderRight: '2px solid var(--border)' }}>Pending</th>
                          {/* 6 Ratings + Average */}
                          <th style={{ padding: '12px 8px', fontWeight: 700, minWidth: '60px', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>Speed</th>
                          <th style={{ padding: '12px 8px', fontWeight: 700, minWidth: '60px', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>Under.</th>
                          <th style={{ padding: '12px 8px', fontWeight: 700, minWidth: '65px', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>Prob.</th>
                          <th style={{ padding: '12px 8px', fontWeight: 700, minWidth: '65px', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>Talk.</th>
                          <th style={{ padding: '12px 8px', fontWeight: 700, minWidth: '65px', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>Quality</th>
                          <th style={{ padding: '12px 8px', fontWeight: 700, minWidth: '65px', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>Disc.</th>
                          <th style={{ padding: '12px 10px', fontWeight: 800, minWidth: '80px', textAlign: 'center', background: 'var(--bg-light-olive)', color: '#414C30', borderRight: '2px solid var(--border)' }}>Avg Overall</th>
                          {/* Team Leader Audit */}
                          <th style={{ padding: '12px 12px', fontWeight: 800, minWidth: '120px', textAlign: 'center', background: '#FAF4E8', color: '#7A5416' }}>TL Audit</th>
                          <th style={{ padding: '12px 12px', fontWeight: 700, minWidth: '90px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTaskReports.length === 0 ? (
                          <tr>
                            <td colSpan="18" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                              No task report records match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredTaskReports.map((row) => (
                            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover-row">
                              {/* Employee Name (Sticky column) */}
                              <td style={{
                                padding: '14px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                position: 'sticky',
                                left: 0,
                                background: '#ffffff',
                                zIndex: 1,
                                boxShadow: '2px 0 5px rgba(0,0,0,0.03)'
                              }}>
                                <div>{row.employeeName}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.department}</div>
                              </td>
                              <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{row.month}</td>
                              <td style={{ padding: '14px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{row.totalWorkingDays}</td>
                              <td style={{ padding: '14px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-primary)' }}>{row.date}</td>
                              <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>{row.day}</td>
                              <td style={{ padding: '14px 12px' }}>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  background: 'var(--bg-beige)',
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {row.projectName}
                                </span>
                              </td>
                              <td style={{ padding: '14px', color: 'var(--text-primary)', maxWidth: '280px', lineHeight: 1.4 }}>
                                {row.tasksAssigned}
                              </td>
                              {/* Completed Yes/No */}
                              <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: row.completed === 'Yes' ? 'var(--bg-light-olive)' : 'var(--bg-beige)',
                                  color: row.completed === 'Yes' ? '#414C30' : 'var(--text-muted)'
                                }}>
                                  {row.completed}
                                </span>
                              </td>
                              {/* Pending Yes/No */}
                              <td style={{ padding: '14px 10px', textAlign: 'center', borderRight: '2px solid var(--border)' }}>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '14px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: row.pending === 'Yes' ? '#FAF4E8' : 'var(--bg-beige)',
                                  color: row.pending === 'Yes' ? '#C28424' : 'var(--text-muted)'
                                }}>
                                  {row.pending}
                                </span>
                              </td>
                              {/* 6 Ratings */}
                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{row.speed}</td>
                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{row.understanding}</td>
                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{row.problemSolving}</td>
                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{row.talkingBehaviour}</td>
                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{row.workQuality}</td>
                              <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>{row.discipline}</td>
                              {/* Average Overall */}
                              <td style={{ padding: '14px 10px', textAlign: 'center', background: 'var(--bg-light-olive)', borderRight: '2px solid var(--border)' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '8px',
                                  fontWeight: 800,
                                  fontSize: '0.85rem',
                                  background: '#687747',
                                  color: '#ffffff'
                                }}>
                                  {Number(row.averageOverall).toFixed(2)}
                                </span>
                              </td>
                              {/* Team Leader Audit (Distinct Badge) */}
                              <td style={{ padding: '14px 12px', textAlign: 'center', background: '#FAF4E8' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <span style={{
                                    padding: '3px 8px',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    background: '#414C30',
                                    color: '#ffffff'
                                  }}>
                                    {row.tlAuditScore} / 10
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#7A5416' }}>{row.tlAuditor.split(' ')[0]}</span>
                                </div>
                              </td>
                              {/* Action */}
                              <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => setSelectedReportDetail(row)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    background: '#ffffff',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 2: EMPLOYEE SUMMARY CARDS VIEW */}
              {reportViewMode === 'summary' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                  {employeeWiseReports.map((emp) => (
                    <div
                      key={emp.employeeName}
                      style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        padding: '22px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Top Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{emp.employeeName}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {emp.department} • {emp.month}
                          </span>
                        </div>
                        <div style={{
                          padding: '6px 12px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #687747, #414C30)',
                          color: '#ffffff',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Overall Avg</div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{emp.avgOverall}</div>
                        </div>
                      </div>

                      {/* Working Days & Task Counters */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'var(--bg-beige)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Work Days</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{emp.totalWorkingDays}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.72rem', color: '#414C30', fontWeight: 600 }}>Completed</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#414C30' }}>{emp.completedCount}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.72rem', color: '#C28424', fontWeight: 600 }}>Pending</div>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#C28424' }}>{emp.pendingCount}</div>
                        </div>
                      </div>

                      {/* 6 Dimensions Ratings Breakdown */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                          Performance Breakdown (Avg / 10)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', fontSize: '0.76rem', color: 'var(--text-primary)' }}>
                          <div>Speed: <strong>{emp.avgSpeed}</strong></div>
                          <div>Under.: <strong>{emp.avgUnderstanding}</strong></div>
                          <div>Problem: <strong>{emp.avgProblemSolving}</strong></div>
                          <div>Talking: <strong>{emp.avgTalking}</strong></div>
                          <div>Quality: <strong>{emp.avgQuality}</strong></div>
                          <div>Discipline: <strong>{emp.avgDiscipline}</strong></div>
                        </div>
                      </div>

                      {/* Team Leader Audit (Distinct) */}
                      {emp.latestTlAudit && (
                        <div style={{
                          background: '#FAF4E8',
                          border: '1px solid #EADBB6',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldCheck size={15} color="#687747" />
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7A5416' }}>Team Leader Audit</span>
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: '#414C30', color: '#ffffff' }}>
                              {emp.latestTlAudit.score} / 10
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: '#574116', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{emp.latestTlAudit.remarks}"
                          </p>
                          <div style={{ fontSize: '0.7rem', color: '#7A5416' }}>
                            Auditor: {emp.latestTlAudit.auditor}
                          </div>
                        </div>
                      )}

                      {/* View Action */}
                      <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            setReportSearch(emp.employeeName);
                            setReportViewMode('spreadsheet');
                          }}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: '#ffffff',
                            color: 'var(--text-primary)',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          View in Spreadsheet
                        </button>
                        <button
                          onClick={() => setSelectedReportDetail(emp.tasks[0])}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-light-olive)',
                            color: '#414C30',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          Inspect Detail
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: LEADER AUDITS & RATINGS */}
          {/* ========================================================================= */}
          {activeTab === 'audits' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>Team Leader Daily Audit Trail</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Performance evaluations, punctuality ratings, and team feedback</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {mockAudits.map((audit) => (
                  <div key={audit.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '20px', display: 'flex', gap: '24px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', minWidth: '90px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '1.4rem', fontWeight: 800, color: '#C28424' }}>
                        <Star size={20} fill="#C28424" color="#C28424" />
                        {audit.ratingScore}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Overall Rating</div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>{audit.employeeName}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Reviewed by <strong style={{ color: 'var(--text-primary)' }}>{audit.reviewerName}</strong> on {audit.date}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>{audit.remarks}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', borderLeft: '1px solid var(--border)', paddingLeft: '20px' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Punctuality</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{audit.punctuality}/5</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Delivery</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{audit.taskDelivery}/5</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: GEOFENCE CONFIGURATION */}
          {/* ========================================================================= */}
          {activeTab === 'geofence' && (
            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>Office Geofence Parameters</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Verified by Haversine formula on the backend server</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>Office Name</label>
                  <input type="text" readOnly value={mockGeofence.officeName} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-beige)', color: 'var(--text-primary)' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>Latitude</label>
                    <input type="text" readOnly value={mockGeofence.latitude} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-beige)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>Longitude</label>
                    <input type="text" readOnly value={mockGeofence.longitude} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-beige)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>Allowed Radius (Meters)</label>
                  <input type="text" readOnly value={`${mockGeofence.radiusMeters} meters`} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-beige)', color: 'var(--text-primary)' }} />
                </div>

                <button
                  onClick={() => showToast('Geofence coordinate editor opened (Placeholder for Stage 3).')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Update Office Coordinates
                </button>
              </div>

              {/* Visual Map Representation Card */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Perimeter Status</h3>
                <div style={{
                  height: '240px',
                  background: 'linear-gradient(135deg, #414C30 0%, #292D26 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#fff',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid var(--border)'
                }}>
                  {/* Concentric Geofence Circle visualization */}
                  <div style={{
                    width: '140px',
                    height: '140px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(232, 237, 220, 0.6)',
                    background: 'rgba(104, 119, 71, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 30px rgba(104, 119, 71, 0.3)'
                  }}>
                    <MapPin size={28} color="#E8EDDC" />
                  </div>
                  <div style={{ position: 'absolute', bottom: '16px', fontSize: '0.8rem', color: '#DDE1D3' }}>
                    100m Active Office Geofence Radius
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-beige)', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Employees currently inside:</span>
                  <span style={{ fontWeight: 700, color: '#414C30' }}>{mockGeofence.activeEmployeesInside} Employees</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
