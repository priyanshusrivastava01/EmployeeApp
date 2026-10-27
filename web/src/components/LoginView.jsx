import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, Building2, Users, AlertCircle } from 'lucide-react';
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
      backgroundColor: '#f4f6f2',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '36px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        border: '1px solid #e2ebd8'
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            backgroundColor: '#405335',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '14px',
            boxShadow: '0 4px 12px rgba(64, 83, 53, 0.25)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1a2218', margin: '0 0 6px 0' }}>
            EMS Admin Portal
          </h1>
          <p style={{ fontSize: '13px', color: '#687762', margin: 0 }}>
            Multi-Organization Management Platform
          </p>
        </div>

        {/* Demo Preset Selector */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#687762', letterSpacing: '0.5px', marginBottom: '8px' }}>
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
                    border: active ? '1.5px solid #405335' : '1px solid #e2ebd8',
                    backgroundColor: active ? '#f0f5ee' : '#ffffff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: '700', color: active ? '#405335' : '#1a2218' }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: '10px', color: '#687762', marginTop: '2px' }}>
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
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            padding: '10px 12px',
            borderRadius: '10px',
            fontSize: '12px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1a2218', marginBottom: '6px' }}>
              Work Email
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid #e2ebd8',
              borderRadius: '10px',
              padding: '0 12px',
              backgroundColor: '#fbfcfb'
            }}>
              <Mail size={16} color="#687762" style={{ marginRight: '8px' }} />
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
                  color: '#1a2218'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1a2218', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid #e2ebd8',
              borderRadius: '10px',
              padding: '0 12px',
              backgroundColor: '#fbfcfb'
            }}>
              <Lock size={16} color="#687762" style={{ marginRight: '8px' }} />
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
                  color: '#1a2218'
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
              backgroundColor: '#405335',
              color: '#ffffff',
              border: 'none',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 10px rgba(64, 83, 53, 0.25)',
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
          color: '#687762'
        }}>
          Backend: http://localhost:5000 &bull; Multi-Tenant Isolated
        </div>
      </div>
    </div>
  );
}
