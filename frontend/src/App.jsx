import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import PageLoader from './components/PageLoader'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddSubject from './pages/AddSubject'
import FacultyAvailability from './pages/FacultyAvailability'
import GenerateTimetable from './pages/GenerateTimetable'
import DepartmentView from './pages/DepartmentView'
import FacultyView from './pages/FacultyView'
import Accounts from './pages/Accounts'
import MasterTimetable from './pages/MasterTimetable'

class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff1f2', minHeight: '100vh' }}>
        <h2 style={{ color: '#dc2626' }}>App crashed — check console</h2>
        <pre style={{ color: '#7f1d1d', whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
        <pre style={{ color: '#991b1b', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
      </div>
    )
    return this.props.children
  }
}

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

function AuthHandler() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = () => navigate('/login', { replace: true })
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [navigate])
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthHandler />
      <PageLoader />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/portal/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="subjects" element={<AddSubject />} />
        <Route path="faculty-availability" element={<FacultyAvailability />} />
        <Route path="generate" element={<GenerateTimetable />} />
        <Route path="department/:deptId" element={<DepartmentView />} />
        <Route path="faculty-view" element={<FacultyView />} />
        <Route path="faculty-view/:facultyId" element={<FacultyView />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="master-timetable" element={<MasterTimetable />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
