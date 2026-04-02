import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'

const stats = [
  { key: 'departments', label: 'Departments', icon: 'bi-building', color: '#1a237e' },
  { key: 'subjects', label: 'Subjects', icon: 'bi-book', color: '#2e7d32' },
  { key: 'faculty', label: 'Faculty Members', icon: 'bi-people', color: '#e65100' },
  { key: 'timetables', label: 'Active Timetables', icon: 'bi-calendar-check', color: '#6a1b9a' },
]

export default function Dashboard() {
  const [counts, setCounts] = useState({})
  const [departments, setDepartments] = useState([])
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const role = user.role || 'student'
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.get('/departments/'),
      api.get('/subjects/'),
      api.get('/faculty/'),
      api.get('/timetables/?active=true'),
    ]).then(([d, s, f, t]) => {
      setCounts({
        departments: d.data.length,
        subjects: s.data.length,
        faculty: f.data.length,
        timetables: t.data.length,
      })
      setDepartments(d.data)
    })
  }, [])

  return (
    <>
      <div className="page-header">
        <h4 className="mb-1"><i className="bi bi-speedometer2 me-2"></i>Dashboard</h4>
        <p className="text-muted mb-0">
          Welcome, <strong>{user.full_name || user.username}</strong> &mdash; Role: <strong>{role}</strong>
        </p>
      </div>

      <div className="row g-4 mb-4">
        {stats.map(s => (
          <div className="col-6 col-md-3" key={s.key}>
            <div className="stat-card card text-center p-3">
              <i className={`bi ${s.icon}`} style={{fontSize:'2.5rem', color: s.color}}></i>
              <h2 className="fw-bold mt-1" style={{color: s.color}}>{counts[s.key] ?? '—'}</h2>
              <p className="text-muted mb-0 small">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {(role === 'admin' || role === 'hod') && (
          <>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-header-ewc"><i className="bi bi-book me-2"></i>Manage Subjects</div>
                <div className="card-body">
                  <p className="text-muted small">Add or manage subjects for each department and semester.</p>
                  <button className="btn btn-ewc btn-sm" onClick={() => navigate('/portal/subjects')}>
                    <i className="bi bi-plus-circle me-1"></i>Add Subject
                  </button>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-header-ewc"><i className="bi bi-person-check me-2"></i>Faculty Availability</div>
                <div className="card-body">
                  <p className="text-muted small">Set faculty availability slots for timetable generation.</p>
                  <button className="btn btn-ewc btn-sm" onClick={() => navigate('/portal/faculty-availability')}>
                    <i className="bi bi-clock me-1"></i>Set Availability
                  </button>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card h-100">
                <div className="card-header-ewc"><i className="bi bi-magic me-2"></i>Generate Timetable</div>
                <div className="card-body">
                  <p className="text-muted small">Auto-generate timetable based on subjects and availability.</p>
                  <button className="btn btn-success btn-sm" onClick={() => navigate('/portal/generate')}>
                    <i className="bi bi-lightning me-1"></i>Generate Now
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header-ewc"><i className="bi bi-building me-2"></i>Department Timetable</div>
            <div className="card-body">
              <p className="text-muted small mb-3">View timetable by department and semester.</p>
              <div className="d-flex flex-wrap gap-2">
                {departments.map(d => (
                  <button key={d.id} className="btn btn-outline-primary btn-sm"
                    onClick={() => navigate(`/portal/department/${d.id}`)}>
                    {d.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {role !== 'student' && (
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header-ewc"><i className="bi bi-person-lines-fill me-2"></i>Faculty Timetable</div>
              <div className="card-body">
                <p className="text-muted small">View individual faculty timetable and download PDF.</p>
                <button className="btn btn-outline-primary btn-sm" onClick={() => navigate('/portal/faculty-view')}>
                  <i className="bi bi-eye me-1"></i>View
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
