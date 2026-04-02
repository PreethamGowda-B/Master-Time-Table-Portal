import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'

export default function Layout() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const role = user.role || 'student'
  const facultyId = user.faculty_id

  async function handleLogout() {
    try { await api.post('/auth/logout/') } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
    toast.success('Logged out')
  }

  const link = (to, icon, label) => (
    <NavLink to={to} style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px', margin: '2px 8px', borderRadius: 8,
      textDecoration: 'none', fontSize: '0.9rem', fontWeight: isActive ? 600 : 400,
      color: isActive ? '#1a237e' : '#444',
      background: isActive ? '#e8eaf6' : 'transparent',
      transition: 'all 0.2s'
    })}>
      <i className={`bi ${icon}`}></i> {label}
    </NavLink>
  )

  return (
    <>
      <nav className="navbar navbar-ewc navbar-expand-lg navbar-dark px-3">
        <span className="navbar-brand fw-bold" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <i className="bi bi-calendar3 me-2"></i>East West College of Management
        </span>
        <span className="text-white-50 d-none d-md-inline ms-2" style={{ fontSize: '0.85rem' }}>
          Master Timetable Portal
        </span>
        <div className="ms-auto d-flex align-items-center gap-3">
          <span className="text-white">
            <i className="bi bi-person-circle me-1"></i>{user.full_name || user.username}
            <span className="badge bg-light text-dark ms-2" style={{ fontSize: '0.7rem' }}>{role}</span>
          </span>
        </div>
      </nav>

      <div className="container-fluid">
        <div className="row">
          <div className="col-md-2 d-none d-md-block p-0" style={{ background: 'white', boxShadow: '2px 0 8px rgba(0,0,0,0.07)', minHeight: 'calc(100vh - 62px)', position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 62px)', paddingTop: '1.2rem' }}>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {link('/portal/dashboard', 'bi-speedometer2', 'Dashboard')}
                {(role === 'admin' || role === 'hod') && (<>
                  {link('/portal/subjects', 'bi-book', 'Add Subject')}
                  {link('/portal/faculty-availability', 'bi-person-check', 'Faculty Availability')}
                  {link('/portal/generate', 'bi-magic', 'Generate Timetable')}
                </>)}
                {role === 'admin' && link('/portal/accounts', 'bi-people-fill', 'Accounts')}
                {role === 'hod' && link('/portal/accounts', 'bi-person-badge-fill', 'Faculty Accounts')}
                {role === 'faculty' && facultyId && link(`/portal/faculty-view/${facultyId}`, 'bi-person-lines-fill', 'My Timetable')}
                {link('/portal/department/1', 'bi-building', 'Department View')}
                {link('/portal/master-timetable', 'bi-grid-3x3-gap', 'Master Timetable')}
                {role !== 'student' && role !== 'faculty' && link('/portal/faculty-view', 'bi-person-lines-fill', 'Faculty View')}
              </div>
              <div style={{ padding: '8px', borderTop: '1px solid #f1f5f9' }}>
                <button onClick={handleLogout}
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', textAlign: 'left', padding: '10px 16px', borderRadius: 8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <i className="bi bi-box-arrow-right"></i> Logout
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-10 p-4">
            <Outlet />
          </div>
        </div>
      </div>
    </>
  )
}
