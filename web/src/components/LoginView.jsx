import React, { useState, useEffect } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Sun, Moon } from 'lucide-react';
import webApi from '../services/api';

const PRESETS = [
  {
    role: 'admin',
    title: 'Acme Admin',
    email: 'admin@acmetech.com',
    password: 'admin123',
    org: 'Acme Tech (Co 1)'
  },
  {
    role: 'admin2',
    title: 'Nexus Admin',
    email: 'admin@nexussolutions.in',
    password: 'admin123',
    org: 'Nexus Sol (Co 2)'
  },
  {
    role: 'tl',
    title: 'Team Leader',
    email: 'priya.n@acmetech.com',
    password: 'admin123',
    org: 'Acme Tech'
  },
  {
    role: 'emp',
    title: 'Employee',
    email: 'aarav.sharma@acmetech.com',
    password: 'admin123',
    org: 'Acme Tech'
  }
];

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@acmetech.com');
  const [password, setPassword] = useState('admin123');
  const [selectedPreset, setSelectedPreset] = useState('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('ems_web_theme') === 'dark');

  useEffect(() => {
    const currentTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('ems_web_theme', currentTheme);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.role);
    setEmail(preset.email);
    setPassword(preset.password);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await webApi.login(email, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user, res.organization);
      } else {
        setError(res.error || 'Login failed.');
      }
    } catch (err) {
      setError(err.message || 'Cannot connect to backend server at http://localhost:5000');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      fontFamily: 'var(--font-sans)',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '20px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer'
        }}
      >
        {isDark ? <Sun size={16} color="#FBBF24" /> : <Moon size={16} color="var(--primary)" />}
        <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>

      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '20px',
        padding: '36px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border)'
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '14px',
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            EMS Admin Portal
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Multi-Organization Management Platform
          </p>
        </div>

        {/* Demo Preset Selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.5px', marginBottom: '8px' }}>
            SELECT PRELOADED CREDENTIALS:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {PRESETS.map((p) => {
              const active = selectedPreset === p.role;
              return (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: active ? 'var(--bg-card-subtle)' : 'var(--bg-card)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '700', color: active ? 'var(--primary)' : 'var(--text-primary)' }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {p.org}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '12px',
            marginBottom: '18px',
            border: '1px solid var(--danger-border)'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Work Email
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0 12px',
              backgroundColor: 'var(--input-bg)'
            }}>
              <Mail size={16} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                required
                style={{
                  width: '100%',
                  height: '42px',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0 12px',
              backgroundColor: 'var(--input-bg)'
            }}>
              <Lock size={16} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%',
                  height: '42px',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '13px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 10px rgba(13, 148, 136, 0.25)',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Authenticating...' : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          Multi-Tenant Isolated &bull; Real Teal Theme System Active
        </div>
      </div>
    </div>
  );
}
