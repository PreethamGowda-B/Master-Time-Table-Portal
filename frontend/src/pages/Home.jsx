import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../home.css'

function useCountUp(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const num = parseInt(target)
    const suffix = target.replace(/[0-9]/g, '')
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * num) + suffix)
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start])
  return count || '0'
}

function StatCard({ value, label, delay }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef()
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  const count = useCountUp(value, 1800, visible)
  return (
    <div ref={ref} className="hp-stat" style={{ animationDelay: `${delay}ms` }}>
      <div className="hp-stat-value">{visible ? count : '0'}</div>
      <div className="hp-stat-label">{label}</div>
    </div>
  )
}

const roles = [
  { role: 'Admin',   icon: 'bi-shield-lock-fill',  color: '#4f46e5', grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)', desc: 'Full access to all features', bg: 'rgba(79,70,229,0.08)' },
  { role: 'HOD',     icon: 'bi-person-workspace',  color: '#059669', grad: 'linear-gradient(135deg,#059669,#10b981)', desc: 'Manage department timetables', bg: 'rgba(5,150,105,0.08)' },
  { role: 'Faculty', icon: 'bi-person-badge-fill', color: '#d97706', grad: 'linear-gradient(135deg,#d97706,#f59e0b)', desc: 'View your class schedule', bg: 'rgba(217,119,6,0.08)' },
  { role: 'Student', icon: 'bi-mortarboard-fill',  color: '#7c3aed', grad: 'linear-gradient(135deg,#7c3aed,#a855f7)', desc: 'View department timetable', bg: 'rgba(124,58,237,0.08)' },
]

const features = [
  { icon: 'bi-calendar-check-fill', title: 'Smart Scheduling', desc: 'Auto-generate conflict-free timetables for all departments instantly.' },
  { icon: 'bi-people-fill',         title: 'Faculty Management', desc: 'Track availability, workload, and assignments for every faculty member.' },
  { icon: 'bi-building',            title: 'Department View', desc: 'Dedicated views for each department with real-time updates.' },
  { icon: 'bi-phone-fill',          title: 'Mobile Friendly', desc: 'Access your schedule from any device, anywhere, anytime.' },
  { icon: 'bi-lock-fill',           title: 'Role-Based Access', desc: 'Secure login with tailored access for Admin, HOD, Faculty & Students.' },
  { icon: 'bi-download',            title: 'Export & Print', desc: 'Download timetables as PDF or print directly from the portal.' },
]

export default function Home() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100)
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="hp-root">

      {/* Navbar */}
      <nav className={`hp-nav ${scrolled ? 'hp-nav-scrolled' : ''}`}>
        <div className="hp-nav-brand">
          <div className="hp-logo-box">
            <i className="bi bi-mortarboard-fill"></i>
          </div>
          <div>
            <div className="hp-college-name">East West College of Management</div>
            <div className="hp-college-sub">Bengaluru | Affiliated to Bangalore University</div>
          </div>
        </div>
        <button className="hp-login-btn" onClick={() => navigate('/login')}>
          <i className="bi bi-box-arrow-in-right"></i> Login
        </button>
      </nav>

      {/* Hero */}
      <section className="hp-hero">
        <div className="hp-hero-bg-anim">
          {[...Array(6)].map((_, i) => <div key={i} className={`hp-orb hp-orb-${i+1}`}></div>)}
        </div>
        <div className={`hp-hero-content ${heroVisible ? 'hp-hero-in' : ''}`}>
          <div className="hp-hero-badge">
            <i className="bi bi-stars"></i> Academic Year 2024–25
          </div>
          <h1 className="hp-hero-title">
            Master Timetable<br />
            <span className="hp-hero-accent">Portal</span>
          </h1>
          <p className="hp-hero-sub">
            Streamline scheduling for all departments, faculty, and students at East West College of Management.
          </p>
          <div className="hp-hero-btns">
            <button className="hp-btn-primary" onClick={() => navigate('/login')}>
              <i className="bi bi-arrow-right-circle-fill"></i> Access Portal
            </button>
            <button className="hp-btn-ghost" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              Learn More <i className="bi bi-chevron-down"></i>
            </button>
          </div>
        </div>
        <div className={`hp-hero-visual ${heroVisible ? 'hp-hero-in' : ''}`} style={{ animationDelay: '0.2s' }}>
          <div className="hp-hero-card">
            <div className="hp-hero-card-header">
              <span className="hp-dot red"></span><span className="hp-dot yellow"></span><span className="hp-dot green"></span>
              <span style={{ marginLeft: 8, fontSize: '0.75rem', color: '#94a3b8' }}>Timetable Preview</span>
            </div>
            <div className="hp-mini-grid">
              {['Mon','Tue','Wed','Thu','Fri'].map(d => (
                <div key={d} className="hp-mini-col">
                  <div className="hp-mini-day">{d}</div>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`hp-mini-slot hp-slot-${(i + d.charCodeAt(0)) % 4}`}></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="hp-stats-bar">
        <StatCard value="25+" label="Years of Excellence" delay={0} />
        <StatCard value="5000+" label="Students" delay={100} />
        <StatCard value="200+" label="Faculty Members" delay={200} />
        <StatCard value="10+" label="Departments" delay={300} />
      </section>

      {/* Features */}
      <section className="hp-section" id="features">
        <div className="hp-section-inner">
          <div className="hp-section-tag"><i className="bi bi-lightning-charge-fill"></i> Features</div>
          <h2 className="hp-section-title">Everything You Need</h2>
          <p className="hp-section-sub">A complete timetable management solution built for modern academic institutions.</p>
          <div className="hp-features-grid">
            {features.map((f, i) => (
              <div key={f.title} className="hp-feature-card" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="hp-feature-icon">
                  <i className={`bi ${f.icon}`}></i>
                </div>
                <h3 className="hp-feature-title">{f.title}</h3>
                <p className="hp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="hp-section hp-section-dark">
        <div className="hp-section-inner">
          <div className="hp-section-tag light"><i className="bi bi-people-fill"></i> Access Roles</div>
          <h2 className="hp-section-title light">Who Can Use This Portal?</h2>
          <p className="hp-section-sub light">Login with your role to access the features available to you.</p>
          <div className="hp-roles-grid">
            {roles.map((r, i) => (
              <div key={r.role} className="hp-role-card" onClick={() => navigate('/login')}
                style={{ animationDelay: `${i * 100}ms` }}>
                <div className="hp-role-icon-wrap" style={{ background: r.grad }}>
                  <i className={`bi ${r.icon}`}></i>
                </div>
                <div className="hp-role-name" style={{ color: r.color }}>{r.role}</div>
                <div className="hp-role-desc">{r.desc}</div>
                <div className="hp-role-arrow" style={{ color: r.color }}>
                  <i className="bi bi-arrow-right"></i>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button className="hp-btn-primary large" onClick={() => navigate('/login')}>
              <i className="bi bi-box-arrow-in-right"></i> Go to Login
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div>
            <div className="hp-footer-brand">
              <i className="bi bi-mortarboard-fill"></i> East West College of Management
            </div>
            <div className="hp-footer-sub">Bengaluru | Affiliated to Bangalore University</div>
          </div>
          <div className="hp-footer-copy">
            &copy; {new Date().getFullYear()} East West College of Management. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  )
}
