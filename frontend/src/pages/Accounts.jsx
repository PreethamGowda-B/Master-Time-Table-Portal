import React, { useState, useEffect } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const ROLES = [
  { key: 'hod',     label: 'HOD',     icon: 'bi-person-workspace',  color: '#059669' },
  { key: 'faculty', label: 'Faculty', icon: 'bi-person-badge-fill', color: '#d97706' },
  { key: 'student', label: 'Student', icon: 'bi-mortarboard-fill',  color: '#7c3aed' },
]
const ROLE_COLORS = { hod: '#059669', faculty: '#d97706', student: '#7c3aed', admin: '#4f46e5' }
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

const emptyAssignment = { department: '', semester: '', subject_ids: [], subjects: [] }
const emptyForm = { name: '', email: '', password: '', role: 'hod', assignments: [{ ...emptyAssignment }] }

export default function Accounts() {
  const user        = JSON.parse(localStorage.getItem('user') || '{}')
  const callerRole  = user.role || 'student'
  const isHOD       = callerRole === 'hod'

  const [users, setUsers]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ ...emptyForm, role: isHOD ? 'faculty' : 'hod' })
  const [saving, setSaving]         = useState(false)
  const [deleting, setDeleting]     = useState(null)
  const [filter, setFilter]         = useState('all')
  const [filterDept, setFilterDept] = useState('')
  const [filterSem, setFilterSem]   = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [departments, setDepts]     = useState([])
  const [assignmentSubjects, setAssignmentSubjects] = useState({}) // idx -> subjects[]
  const [editUser, setEditUser]     = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [editAssignmentSubjects, setEditAssignmentSubjects] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [showEditPwd, setShowEditPwd] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try { const { data } = await api.get('/auth/users/'); setUsers(data) }
    catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchUsers()
    api.get('/departments/').then(r => setDepts(r.data)).catch(() => {})
  }, [])

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  // Assignment helpers — create form
  function updateAssignment(idx, field, value) {
    setForm(f => {
      const assignments = f.assignments.map((a, i) =>
        i === idx ? { ...a, [field]: value, ...(field === 'department' || field === 'semester' ? { subject_ids: [] } : {}) } : a
      )
      return { ...f, assignments }
    })
    if (field === 'department' || field === 'semester') {
      const a = form.assignments[idx] || {}
      const dept = field === 'department' ? value : a.department
      const sem  = field === 'semester'   ? value : a.semester
      if (dept && sem) {
        api.get(`/subjects/?department=${dept}&semester=${sem}&exclude_faculty=0`).then(r =>
          setAssignmentSubjects(prev => ({ ...prev, [idx]: r.data }))
        )
      } else {
        setAssignmentSubjects(prev => ({ ...prev, [idx]: [] }))
      }
    }
  }

  function toggleAssignmentSubject(idx, subId) {
    setForm(f => ({
      ...f,
      assignments: f.assignments.map((a, i) => {
        if (i !== idx) return a
        const ids = a.subject_ids.includes(subId) ? a.subject_ids.filter(s => s !== subId) : [...a.subject_ids, subId]
        return { ...a, subject_ids: ids }
      })
    }))
  }

  // Assignment helpers — edit form
  function updateEditAssignment(idx, field, value) {
    setEditForm(f => {
      const assignments = (f.assignments || []).map((a, i) =>
        i === idx ? { ...a, [field]: value, ...(field === 'department' || field === 'semester' ? { subject_ids: [] } : {}) } : a
      )
      return { ...f, assignments }
    })
    if (field === 'department' || field === 'semester') {
      const a = (editForm.assignments || [])[idx] || {}
      const dept = field === 'department' ? value : a.department
      const sem  = field === 'semester'   ? value : a.semester
      if (dept && sem) {
        // Pass the faculty's own ID so their already-assigned subjects still appear
        const facultyId = editUser?.faculty_id || 0
        api.get(`/subjects/?department=${dept}&semester=${sem}&exclude_faculty=${facultyId}`).then(r =>
          setEditAssignmentSubjects(prev => ({ ...prev, [idx]: r.data }))
        )
      }
    }
  }

  function toggleEditAssignmentSubject(idx, subId) {
    setEditForm(f => ({
      ...f,
      assignments: (f.assignments || []).map((a, i) => {
        if (i !== idx) return a
        const ids = (a.subject_ids || []).includes(subId) ? (a.subject_ids || []).filter(s => s !== subId) : [...(a.subject_ids || []), subId]
        return { ...a, subject_ids: ids }
      })
    }))
  }

  const toggleSubject = id => setForm(f => ({
    ...f, subject_ids: f.subject_ids ? (f.subject_ids.includes(id) ? f.subject_ids.filter(s => s !== id) : [...f.subject_ids, id]) : [id]
  }))
  const handleEdit = e => setEditForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) return toast.error('All fields are required')
    if (form.role === 'faculty' && form.assignments.every(a => !a.department || !a.semester))
      return toast.error('Please add at least one department + semester assignment')
    setSaving(true)
    try {
      const payload = { ...form }
      // Use first assignment as primary dept/semester for backward compat
      const firstA = form.assignments.find(a => a.department && a.semester)
      if (firstA) {
        payload.department  = firstA.department
        payload.semester    = firstA.semester
        payload.subject_ids = firstA.subject_ids
      }
      await api.post('/auth/create-user/', payload)
      toast.success(`${form.role.toUpperCase()} account created`)
      setForm({ ...emptyForm, role: isHOD ? 'faculty' : 'hod' })
      setAssignmentSubjects({})
      setShowForm(false); fetchUsers()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create account') }
    finally { setSaving(false) }
  }

  const openEdit = (u) => {
    setEditUser(u)
    const deptId = departments.find(d => d.name === u.department)?.id || ''
    const existingAssignments = (u.assignments || []).map(a => ({
      id: a.id,
      department: a.department,
      semester: String(a.semester),
      subject_ids: a.subject_ids || [],
    }))
    setEditForm({
      name: u.name, email: u.email, password: '',
      department: deptId,
      semester: u.semester ? String(u.semester) : '',
      subject_ids: (u.subjects || []).map(s => s.id),
      assignments: existingAssignments.length > 0 ? existingAssignments : [{ ...emptyAssignment }],
      faculty_id: u.faculty_id || 0,
    })
    // Pre-load subjects for each existing assignment — exclude other faculty, not this one
    const subMap = {}
    existingAssignments.forEach((a, idx) => {
      if (a.department && a.semester) {
        api.get(`/subjects/?department=${a.department}&semester=${a.semester}&exclude_faculty=${u.faculty_id || 0}`).then(r => {
          setEditAssignmentSubjects(prev => ({ ...prev, [idx]: r.data }))
        })
      }
    })
    setEditAssignmentSubjects(subMap)
  }

  const submitEdit = async e => {
    e.preventDefault()
    setEditSaving(true)
    try {
      const payload = { ...editForm }
      const firstA = (editForm.assignments || []).find(a => a.department && a.semester)
      if (firstA) {
        payload.department  = firstA.department
        payload.semester    = firstA.semester
        payload.subject_ids = firstA.subject_ids
      }
      await api.put(`/auth/users/${editUser.id}/edit/`, payload)
      toast.success('Account updated')
      setEditUser(null); setEditAssignmentSubjects({}); fetchUsers()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update') }
    finally { setEditSaving(false) }
  }

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Delete account for "${name}"?`)) return
    setDeleting(id)
    try { await api.delete(`/auth/users/${id}/`); toast.success('Deleted'); setUsers(u => u.filter(x => x.id !== id)) }
    catch { toast.error('Failed to delete') }
    finally { setDeleting(null) }
  }

  // HOD only sees faculty; admin sees all
  const visibleRoles = isHOD ? ['faculty'] : ['all', 'hod', 'faculty', 'student']
  const filtered = users
    .filter(u => filter === 'all' || u.role === filter)
    .filter(u => {
      if (!filterDept) return true
      const deptName = (departments.find(d => String(d.id) === String(filterDept)) || {}).name || ''
      return u.department === deptName
    })
    .filter(u => !filterSem || String(u.semester) === String(filterSem))
  // HOD: only show faculty role buttons
  const roleButtons = isHOD ? ROLES.filter(r => r.key === 'faculty') : ROLES

  return (
    <div style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1.5rem' }}>
            <i className="bi bi-people-fill" style={{ color: '#4f46e5', marginRight: 10 }}></i>
            {isHOD ? 'Faculty Accounts' : 'Accounts'}
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            {isHOD ? 'Manage faculty accounts for your department' : 'Manage HOD, Faculty and Student accounts'}
          </p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditUser(null) }} style={{
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white',
          border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: '0.9rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: '0 4px 14px rgba(79,70,229,0.35)'
        }}>
          <i className={`bi ${showForm ? 'bi-x-lg' : 'bi-person-plus-fill'}`}></i>
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 16, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', marginBottom: 28, animation: 'fadeDown 0.25s ease' }}>
          <h3 style={{ margin: '0 0 20px', fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>
            <i className="bi bi-person-plus" style={{ color: '#4f46e5', marginRight: 8 }}></i>Create New Account
          </h3>
          {!isHOD && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {roleButtons.map(r => (
                <button key={r.key} type="button" onClick={() => setForm(f => ({ ...f, role: r.key, semester: '', subject_ids: [] }))}
                  style={{ flex: 1, minWidth: 100, padding: '12px 8px', borderRadius: 12, border: `2px solid ${form.role === r.key ? r.color : '#e2e8f0'}`, background: form.role === r.key ? `${r.color}12` : 'white', cursor: 'pointer', textAlign: 'center' }}>
                  <i className={`bi ${r.icon}`} style={{ fontSize: '1.4rem', color: r.color, display: 'block', marginBottom: 4 }}></i>
                  <span style={{ fontWeight: 700, color: r.color, fontSize: '0.85rem' }}>{r.label}</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Full Name"><input name="name" value={form.name} onChange={handle} placeholder="Dr. John Smith" required style={IS} /></Field>
            <Field label="Email Address"><input name="email" type="email" value={form.email} onChange={handle} placeholder="user@example.com" required style={IS} /></Field>
            <Field label="Password">
              <div style={{ position: 'relative' }}>
                <input name="password" type={showPwd ? 'text' : 'password'} value={form.password} onChange={handle} placeholder="Set a password" required style={{ ...IS, paddingRight: 40 }} />
                <EyeBtn show={showPwd} toggle={() => setShowPwd(v => !v)} />
              </div>
            </Field>
            {form.role === 'faculty' && (
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
                    <i className="bi bi-diagram-3 me-1" style={{ color: '#4f46e5' }}></i>
                    Department + Semester Assignments
                  </label>
                  <button type="button" onClick={() => setForm(f => ({ ...f, assignments: [...f.assignments, { ...emptyAssignment }] }))}
                    style={{ padding: '4px 12px', borderRadius: 8, border: '1.5px solid #4f46e5', background: '#ede9fe', color: '#4f46e5', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    <i className="bi bi-plus me-1"></i>Add Assignment
                  </button>
                </div>
                {form.assignments.map((a, idx) => (
                  <AssignmentRow key={idx} idx={idx} assignment={a} departments={departments}
                    subjects={assignmentSubjects[idx] || []}
                    onChange={(field, val) => updateAssignment(idx, field, val)}
                    onToggleSub={subId => toggleAssignmentSubject(idx, subId)}
                    onRemove={form.assignments.length > 1 ? () => setForm(f => ({ ...f, assignments: f.assignments.filter((_, i) => i !== idx) })) : null}
                  />
                ))}
              </div>
            )}
            <div style={{ gridColumn: '1/-1' }}>
              <button type="submit" disabled={saving} style={{ ...btnStyle, width: '50%' }}>
                {saving ? <><Spinner /> Creating...</> : <><i className="bi bi-check-circle-fill"></i> Create Account</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeDown 0.2s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>
                <i className="bi bi-pencil-square" style={{ color: '#4f46e5', marginRight: 8 }}></i>
                Edit — {editUser.name}
                <span style={{ marginLeft: 8, background: `${ROLE_COLORS[editUser.role]}15`, color: ROLE_COLORS[editUser.role], padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{editUser.role}</span>
              </h3>
              <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <form onSubmit={submitEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Full Name"><input name="name" value={editForm.name} onChange={handleEdit} placeholder="Full name" style={IS} /></Field>
              <Field label="Email Address"><input name="email" type="email" value={editForm.email} onChange={handleEdit} placeholder="Email" style={IS} /></Field>
              <Field label="New Password (leave blank to keep)">
                <div style={{ position: 'relative' }}>
                  <input name="password" type={showEditPwd ? 'text' : 'password'} value={editForm.password} onChange={handleEdit} placeholder="Leave blank to keep current" style={{ ...IS, paddingRight: 40 }} />
                  <EyeBtn show={showEditPwd} toggle={() => setShowEditPwd(v => !v)} />
                </div>
              </Field>
              {editUser.role === 'faculty' && (
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>
                      <i className="bi bi-diagram-3 me-1" style={{ color: '#4f46e5' }}></i>
                      Department + Semester Assignments
                    </label>
                    <button type="button" onClick={() => setEditForm(f => ({ ...f, assignments: [...(f.assignments || []), { ...emptyAssignment }] }))}
                      style={{ padding: '4px 12px', borderRadius: 8, border: '1.5px solid #4f46e5', background: '#ede9fe', color: '#4f46e5', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      <i className="bi bi-plus me-1"></i>Add Assignment
                    </button>
                  </div>
                  {(editForm.assignments || []).map((a, idx) => (
                    <AssignmentRow key={idx} idx={idx} assignment={a} departments={departments}
                      subjects={editAssignmentSubjects[idx] || []}
                      onChange={(field, val) => updateEditAssignment(idx, field, val)}
                      onToggleSub={subId => toggleEditAssignmentSubject(idx, subId)}
                      onRemove={(editForm.assignments || []).length > 1 ? () => setEditForm(f => ({ ...f, assignments: (f.assignments || []).filter((_, i) => i !== idx) })) : null}
                    />
                  ))}
                </div>
              )}
              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setEditUser(null)} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={editSaving} style={{ ...btnStyle, width: 'auto', padding: '10px 28px' }}>
                  {editSaving ? <><Spinner /> Saving...</> : <><i className="bi bi-check-circle-fill"></i> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      {!isHOD && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', count: users.length, color: '#4f46e5', icon: 'bi-people-fill' },
            { label: 'HOD', count: users.filter(u => u.role === 'hod').length, color: '#059669', icon: 'bi-person-workspace' },
            { label: 'Faculty', count: users.filter(u => u.role === 'faculty').length, color: '#d97706', icon: 'bi-person-badge-fill' },
            { label: 'Student', count: users.filter(u => u.role === 'student').length, color: '#7c3aed', icon: 'bi-mortarboard-fill' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: 12, padding: '14px 20px', border: `1px solid ${s.color}22`, flex: 1, minWidth: 110, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: '1.1rem' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter — admin only */}
      {!isHOD && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {['all', 'hod', 'faculty', 'student'].map(f => (
            <button key={f} onClick={() => { setFilter(f); setFilterDept(''); setFilterSem('') }}
              style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: filter === f ? '#4f46e5' : '#f1f5f9', color: filter === f ? 'white' : '#64748b' }}>
              {f === 'all' ? 'All Users' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Department + Semester filters — shown when Faculty tab active or HOD view */}
      {(filter === 'faculty' || isHOD) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end', background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Department</label>
            <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setFilterSem('') }}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', background: 'white', color: '#0f172a', minWidth: 180 }}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Semester</label>
            <select value={filterSem} onChange={e => setFilterSem(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', background: 'white', color: '#0f172a', minWidth: 150 }}>
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          {(filterDept || filterSem) && (
            <button onClick={() => { setFilterDept(''); setFilterSem('') }}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>
              <i className="bi bi-x-circle me-1"></i>Clear
            </button>
          )}
          <div style={{ alignSelf: 'flex-end', fontSize: '0.8rem', color: '#94a3b8', marginLeft: 'auto' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading accounts...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <i className="bi bi-people" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10 }}></i>
            No accounts found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Name', 'Email', 'Role', 'Department / Semester / Subjects', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${ROLE_COLORS[u.role] || '#4f46e5'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: ROLE_COLORS[u.role] || '#4f46e5', fontSize: '0.9rem' }}>
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '0.88rem' }}>{u.email}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ background: `${ROLE_COLORS[u.role] || '#4f46e5'}15`, color: ROLE_COLORS[u.role] || '#4f46e5', padding: '3px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {u.role === 'faculty' ? (
                      <div>
                        {(u.assignments && u.assignments.length > 0) ? (
                          u.assignments.map((a, i) => (
                            <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: i < u.assignments.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1a237e' }}><i className="bi bi-building me-1"></i>{a.department_name}</span>
                                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700 }}>Sem {a.semester}</span>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                {a.subjects?.length > 0
                                  ? a.subjects.map(s => <span key={s.id} style={{ background: '#ede9fe', color: '#4f46e5', padding: '1px 7px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600 }}>{s.code}</span>)
                                  : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>No subjects</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              {u.department && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a237e' }}><i className="bi bi-building me-1"></i>{u.department}</span>}
                              {u.semester && <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700 }}>Sem {u.semester}</span>}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {u.subjects?.length > 0
                                ? u.subjects.map(s => <span key={s.id} style={{ background: '#ede9fe', color: '#4f46e5', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600 }}>{s.code}</span>)
                                : <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No subjects</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(u)} style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <i className="bi bi-pencil"></i> Edit
                      </button>
                      <button onClick={() => deleteUser(u.id, u.name)} disabled={deleting === u.id} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, opacity: deleting === u.id ? 0.6 : 1 }}>
                        <i className="bi bi-trash3"></i> {deleting === u.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @keyframes fadeDown { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function AssignmentRow({ idx, assignment, departments, subjects, onChange, onToggleSub, onRemove }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #e2e8f0', position: 'relative' }}>
      {onRemove && (
        <button type="button" onClick={onRemove}
          style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem' }}>
          <i className="bi bi-x-circle"></i>
        </button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: subjects.length > 0 ? 10 : 0 }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Department</label>
          <select value={assignment.department} onChange={e => onChange('department', e.target.value)} style={{ ...IS, fontSize: '0.82rem' }}>
            <option value="">-- Select --</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Semester</label>
          <select value={assignment.semester} onChange={e => onChange('semester', e.target.value)} style={{ ...IS, fontSize: '0.82rem' }} disabled={!assignment.department}>
            <option value="">-- Select --</option>
            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </div>
      </div>
      {subjects.length > 0 && (
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Subjects <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Sem {assignment.semester})</span>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {subjects.map(s => {
              const on = (assignment.subject_ids || []).includes(s.id)
              return (
                <button key={s.id} type="button" onClick={() => onToggleSub(s.id)}
                  style={{ padding: '3px 12px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600, border: `2px solid ${on ? '#4f46e5' : '#e2e8f0'}`, background: on ? '#ede9fe' : 'white', color: on ? '#4f46e5' : '#64748b', cursor: 'pointer' }}>
                  {on && <i className="bi bi-check2 me-1"></i>}{s.code} — {s.name}
                  <span style={{ marginLeft: 5, fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: s.is_lab ? '#fde68a' : '#d1fae5', color: s.is_lab ? '#92400e' : '#065f46' }}>
                    {s.is_lab ? 'Lab' : 'Theory'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {assignment.department && assignment.semester && subjects.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
          <i className="bi bi-info-circle me-1"></i>No subjects found for this dept + semester
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}

function EyeBtn({ show, toggle }) {
  return (
    <button type="button" onClick={toggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
      <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`}></i>
    </button>
  )
}

function SubjectChips({ subjects, selected, toggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {subjects.map(s => {
        const on = selected.includes(s.id)
        return (
          <button key={s.id} type="button" onClick={() => toggle(s.id)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, border: `2px solid ${on ? '#4f46e5' : '#e2e8f0'}`, background: on ? '#ede9fe' : 'white', color: on ? '#4f46e5' : '#64748b', cursor: 'pointer' }}>
            {on && <i className="bi bi-check2 me-1"></i>}{s.code} — {s.name}
          </button>
        )
      })}
    </div>
  )
}

function Spinner() {
  return <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginRight: 6 }}></span>
}

const IS = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box', color: '#0f172a' }
const btnStyle = { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white', border: 'none', borderRadius: 10, padding: '11px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }
