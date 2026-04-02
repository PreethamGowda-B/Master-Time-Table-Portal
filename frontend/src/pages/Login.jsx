import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'

const ROLES = [
  { key: 'admin',   label: 'Admin',   icon: 'bi-shield-lock-fill',  color: '#4f46e5', desc: 'Full access' },
  { key: 'hod',     label: 'HOD',     icon: 'bi-person-workspace',  color: '#059669', desc: 'Manage department' },
  { key: 'faculty', label: 'Faculty', icon: 'bi-person-badge-fill', color: '#d97706', desc: 'View schedule' },
  { key: 'student', label: 'Student', icon: 'bi-mortarboard-fill',  color: '#7c3aed', desc: 'View timetable' },
]

export default function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState('role')   // 'role' | 'form'
  const [selectedRole, setSelectedRole] = useState(null)
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adminExists, setAdminExists] = useState(true)

  useEffect(() => {
    api.get('/auth/admin-exists/').then(r => setAdminExists(r.data.exists)).catch(() => {})
  }, [])

  function selectRole(role) {
    setSelectedRole(role)
    setStep('form')
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Please fill all fields.')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login/', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: selectedRole.key,
      })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success(`Welcome, ${data.user.full_name}`)
      // Role-based redirect
      if (data.user.role === 'faculty' && data.user.faculty_id) {
        navigate(`/portal/faculty-view/${data.user.faculty_id}`)
      } else if (data.user.role === 'student') {
        navigate('/portal/department/1')
      } else {
        navigate('/portal/dashboard')
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const role = selectedRole

  return (
    <div className="lp-root">
      {/* Background orbs */}
      <div className="lp-bg">
        <div className="lp-orb lp-orb1"></div>
        <div className="lp-orb lp-orb2"></div>
        <div className="lp-orb lp-orb3"></div>
      </div>

      <div className="lp-card">
        {/* Header */}
        <div className="lp-header">
          <div className="lp-logo"><i className="bi bi-mortarboard-fill"></i></div>
          <h2 className="lp-title">East West College</h2>
          <p className="lp-sub">Master Timetable Portal</p>
        </div>

        {step === 'role' && (
          <div className="lp-body">
            <button className="lp-back" onClick={() => navigate('/')}>
              <i className="bi bi-arrow-left"></i> Back to Home
            </button>
            <p className="lp-prompt"><i className="bi bi-person-circle"></i> Select your role to login</p>
            <div className="lp-roles">
              {ROLES.map(r => (
                <button key={r.key} className="lp-role-btn" onClick={() => selectRole(r)}
                  style={{ '--rc': r.color }}>
                  <i className={`bi ${r.icon}`}></i>
                  <span className="lp-role-name">{r.label}</span>
                  <span className="lp-role-desc">{r.desc}</span>
                </button>
              ))}
            </div>
            {!adminExists && (
              <div className="lp-signup-hint">
                No admin account yet? Contact your system administrator.
              </div>
            )}
          </div>
        )}

        {step === 'form' && role && (
          <div className="lp-body">
            <button className="lp-back" onClick={() => setStep('role')}>
              <i className="bi bi-arrow-left"></i> Back
            </button>
            <div className="lp-role-badge" style={{ '--rc': role.color }}>
              <i className={`bi ${role.icon}`}></i>
              <span>{role.label} Login</span>
            </div>
            <form onSubmit={handleLogin} className="lp-form">
              <div className="lp-field">
                <label>Email Address</label>
                <div className="lp-input-wrap">
                  <i className="bi bi-envelope"></i>
                  <input
                    type="email" placeholder="Enter your email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoFocus
                  />
                </div>
              </div>
              <div className="lp-field">
                <label>Password</label>
                <div className="lp-input-wrap">
                  <i className="bi bi-lock"></i>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                  <button type="button" className="lp-eye" onClick={() => setShowPwd(v => !v)}>
                    <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
              <button type="submit" className="lp-submit" disabled={loading}
                style={{ '--rc': role.color }}>
                {loading
                  ? <><span className="lp-spinner"></span> Signing in...</>
                  : <><i className="bi bi-box-arrow-in-right"></i> Sign In as {role.label}</>
                }
              </button>
            </form>
          </div>
        )}

        <div className="lp-footer">&copy; {new Date().getFullYear()} East West College of Management</div>
      </div>

      <style>{`
        .lp-root {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f0c29 0%, #1a237e 50%, #302b63 100%);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; position: relative; overflow: hidden;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }
        .lp-bg { position: absolute; inset: 0; pointer-events: none; }
        .lp-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.15;
          animation: lpOrb 8s ease-in-out infinite;
        }
        .lp-orb1 { width: 400px; height: 400px; background: #4f46e5; top: -100px; left: -100px; }
        .lp-orb2 { width: 300px; height: 300px; background: #7c3aed; bottom: -80px; right: -60px; animation-delay: 3s; }
        .lp-orb3 { width: 200px; height: 200px; background: #06b6d4; top: 50%; left: 60%; animation-delay: 5s; }
        @keyframes lpOrb {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        .lp-card {
          background: rgba(255,255,255,0.97);
          border-radius: 24px; width: 100%; max-width: 440px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.35);
          overflow: hidden; position: relative; z-index: 1;
          animation: lpIn 0.5s ease;
        }
        @keyframes lpIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: none; }
        }
        .lp-header {
          background: linear-gradient(135deg, #1a237e, #4f46e5);
          padding: 28px 24px 22px; text-align: center;
        }
        .lp-logo {
          width: 52px; height: 52px; border-radius: 16px;
          background: rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; color: white; margin: 0 auto 12px;
          border: 1.5px solid rgba(255,255,255,0.25);
        }
        .lp-title { color: white; font-weight: 800; font-size: 1.15rem; margin: 0 0 4px; }
        .lp-sub { color: rgba(197,202,233,0.9); font-size: 0.8rem; margin: 0; }
        .lp-body { padding: 24px; }
        .lp-prompt {
          text-align: center; font-weight: 600; color: #374151;
          font-size: 0.92rem; margin-bottom: 18px;
          display: flex; align-items: center; justify-content: center; gap: 7px;
        }
        .lp-roles {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
        }
        .lp-role-btn {
          background: white; border: 2px solid color-mix(in srgb, var(--rc) 20%, transparent);
          border-radius: 14px; padding: 18px 12px;
          cursor: pointer; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        }
        .lp-role-btn:hover {
          transform: translateY(-4px);
          border-color: var(--rc);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--rc) 25%, transparent);
        }
        .lp-role-btn i { font-size: 1.9rem; color: var(--rc); }
        .lp-role-name { font-weight: 700; color: var(--rc); font-size: 0.95rem; }
        .lp-role-desc { font-size: 0.72rem; color: #9ca3af; }
        .lp-signup-hint {
          text-align: center; margin-top: 18px;
          font-size: 0.82rem; color: #6b7280;
        }
        .lp-link { color: #4f46e5; font-weight: 600; text-decoration: none; }
        .lp-link:hover { text-decoration: underline; }
        .lp-back {
          background: none; border: none; color: #6b7280;
          font-size: 0.85rem; cursor: pointer; padding: 0;
          display: flex; align-items: center; gap: 5px;
          margin-bottom: 16px; font-weight: 500;
          transition: color 0.2s;
        }
        .lp-back:hover { color: #1a237e; }
        .lp-role-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: color-mix(in srgb, var(--rc) 10%, white);
          border: 1.5px solid color-mix(in srgb, var(--rc) 30%, transparent);
          color: var(--rc); border-radius: 20px;
          padding: 6px 16px; font-size: 0.85rem; font-weight: 700;
          margin-bottom: 20px;
        }
        .lp-form { display: flex; flex-direction: column; gap: 16px; }
        .lp-field { display: flex; flex-direction: column; gap: 6px; }
        .lp-field label { font-size: 0.82rem; font-weight: 600; color: #374151; }
        .lp-input-wrap {
          display: flex; align-items: center;
          border: 1.5px solid #e5e7eb; border-radius: 10px;
          padding: 0 12px; gap: 8px;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: #f9fafb;
        }
        .lp-input-wrap:focus-within {
          border-color: var(--rc, #4f46e5);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--rc, #4f46e5) 15%, transparent);
          background: white;
        }
        .lp-input-wrap > i { color: #9ca3af; font-size: 0.95rem; flex-shrink: 0; }
        .lp-input-wrap input {
          flex: 1; border: none; background: none; outline: none;
          padding: 11px 0; font-size: 0.9rem; color: #111827;
        }
        .lp-eye {
          background: none; border: none; cursor: pointer;
          color: #9ca3af; padding: 0; font-size: 0.95rem;
          transition: color 0.2s;
        }
        .lp-eye:hover { color: #374151; }
        .lp-submit {
          background: linear-gradient(135deg, var(--rc), color-mix(in srgb, var(--rc) 70%, #000));
          color: white; border: none; border-radius: 10px;
          padding: 13px; font-weight: 700; font-size: 0.95rem;
          cursor: pointer; margin-top: 4px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px color-mix(in srgb, var(--rc) 35%, transparent);
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }
        .lp-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--rc) 45%, transparent);
        }
        .lp-submit:disabled { opacity: 0.7; cursor: not-allowed; }
        .lp-spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite; display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .lp-footer {
          text-align: center; padding: 14px;
          font-size: 0.75rem; color: #9ca3af;
          border-top: 1px solid #f3f4f6;
        }
      `}</style>
    </div>
  )
}
