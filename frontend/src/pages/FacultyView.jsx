import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import TimetableGrid from '../components/TimetableGrid'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function FacultyView() {
  const { facultyId } = useParams()
  const navigate = useNavigate()

  const [departments, setDepartments] = useState([])
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedSem, setSelectedSem] = useState('')
  const [faculties, setFaculties] = useState([])
  const [slots, setSlots] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingFaculties, setLoadingFaculties] = useState(false)

  // Load departments and timeslots once
  useEffect(() => {
    api.get('/departments/').then(r => setDepartments(r.data))
    api.get('/timeslots/').then(r => setSlots(r.data))
  }, [])

  // Load faculties when dept+sem selected
  useEffect(() => {
    if (!selectedDept || !selectedSem) { setFaculties([]); return }
    setLoadingFaculties(true)
    api.get(`/auth/faculty-users/?department=${selectedDept}&semester=${selectedSem}`)
      .then(r => setFaculties(r.data))
      .finally(() => setLoadingFaculties(false))
  }, [selectedDept, selectedSem])

  // Load timetable entries when a faculty is selected
  useEffect(() => {
    if (!facultyId) { setEntries([]); return }
    setLoading(true)
    api.get('/timetables/?active=true').then(r => {
      const allEntries = r.data.flatMap(tt =>
        tt.entries.filter(e => e.faculty === Number(facultyId))
      )
      setEntries(allEntries)
    }).finally(() => setLoading(false))
  }, [facultyId])

  const faculty = faculties.find(f => f.id === Number(facultyId))

  function handleFacultyClick(fac) {
    navigate(`/portal/faculty-view/${fac.id}`)
  }

  function downloadPDF() {
    if (!faculty) return
    const doc = new jsPDF({ orientation: 'landscape' })
    const mondaySlots = slots.filter(s => s.day === 'Monday').sort((a, b) => a.slot_number - b.slot_number)

    doc.setFontSize(16)
    doc.setTextColor(26, 35, 126)
    doc.text('East West College of Management', doc.internal.pageSize.width / 2, 18, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor(80, 80, 80)
    doc.text(`Faculty: ${faculty.full_name} | ${faculty.department_name}`, doc.internal.pageSize.width / 2, 26, { align: 'center' })

    const lookup = {}
    DAYS.forEach(d => { lookup[d] = {} })
    entries.forEach(e => { if (lookup[e.day]) lookup[e.day][e.slot_number] = e })

    const head = [['Day', ...mondaySlots.map(s => `${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}`)]]
    const body = DAYS.map(day => [
      day,
      ...mondaySlots.map(ms => {
        const e = lookup[day]?.[ms.slot_number]
        return e ? `${e.subject_code}\n${e.classroom_name}` : '—'
      })
    ])

    autoTable(doc, {
      head, body, startY: 32,
      headStyles: { fillColor: [26, 35, 126], fontSize: 8 },
      bodyStyles: { fontSize: 7, halign: 'center' },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [232, 234, 246] } },
    })
    doc.save(`timetable_${faculty.full_name.replace(/\s+/g, '_')}.pdf`)
    toast.success('PDF downloaded')
  }

  // Group faculty assignments by dept+sem for the detail panel
  const assignmentGroups = faculty?.assignments || []

  return (
    <>
      <div className="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h4 className="mb-1"><i className="bi bi-person-lines-fill me-2"></i>Faculty View</h4>
          <p className="text-muted mb-0">
            {faculty ? `${faculty.full_name} — ${faculty.department_name}` : 'Select department and semester to browse faculty'}
          </p>
        </div>
        {faculty && entries.length > 0 && (
          <button className="btn btn-danger btn-sm" onClick={downloadPDF}>
            <i className="bi bi-file-earmark-pdf me-1"></i>Download PDF
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Department</label>
              <select className="form-select form-select-sm" value={selectedDept}
                onChange={e => { setSelectedDept(e.target.value); navigate('/portal/faculty-view') }}>
                <option value="">— Select Department —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ fontSize: '0.85rem' }}>Semester</label>
              <select className="form-select form-select-sm" value={selectedSem}
                onChange={e => { setSelectedSem(e.target.value); navigate('/portal/faculty-view') }}>
                <option value="">— Select Semester —</option>
                {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Faculty list */}
      {selectedDept && selectedSem && (
        <div className="card mb-3">
          <div className="card-body py-3">
            {loadingFaculties ? (
              <div className="text-center py-3">
                <span className="spinner-border spinner-border-sm" style={{ color: '#1a237e' }}></span>
                <span className="ms-2 text-muted">Loading faculty...</span>
              </div>
            ) : faculties.length === 0 ? (
              <p className="text-muted mb-0">No faculty assigned for this department and semester.</p>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                {faculties.map(f => {
                  const isSelected = facultyId && f.id === Number(facultyId)
                  const subjectCount = f.subjects?.length || 0
                  return (
                    <button key={f.id}
                      onClick={() => handleFacultyClick(f)}
                      className={`btn btn-sm ${isSelected ? 'btn-ewc' : 'btn-outline-secondary'}`}
                      style={{ borderRadius: 20, padding: '6px 14px' }}>
                      <i className="bi bi-person-fill me-1"></i>
                      {f.full_name}
                      {subjectCount > 0 && (
                        <span className="badge ms-2" style={{
                          background: isSelected ? 'rgba(255,255,255,0.25)' : '#e8eaf6',
                          color: isSelected ? '#fff' : '#1a237e',
                          fontSize: '0.68rem'
                        }}>{subjectCount} subj</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Faculty detail panel */}
      {faculty && (
        <div className="row g-3 mb-3">
          {/* Assignment summary */}
          <div className="col-md-4">
            <div className="card h-100">
              <div className="card-header-ewc">
                <i className="bi bi-person-badge me-2"></i>{faculty.full_name}
              </div>
              <div className="card-body">
                <p className="mb-1 text-muted" style={{ fontSize: '0.82rem' }}>
                  <i className="bi bi-building me-1"></i>{faculty.department_name}
                </p>
                <hr className="my-2" />
                <p className="fw-semibold mb-2" style={{ fontSize: '0.85rem' }}>Assigned to:</p>
                {assignmentGroups.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: '0.82rem' }}>No assignments found.</p>
                ) : (
                  assignmentGroups.map(a => (
                    <div key={a.id} className="mb-2 p-2 rounded" style={{ background: '#f8f9ff', border: '1px solid #e8eaf6' }}>
                      <div className="fw-semibold" style={{ fontSize: '0.82rem', color: '#1a237e' }}>
                        {a.department_name} — Sem {a.semester}
                      </div>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {a.subjects.map(s => (
                          <span key={s.id} className="badge" style={{ background: '#e8eaf6', color: '#1a237e', fontSize: '0.7rem' }}>
                            {s.code}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Timetable */}
          <div className="col-md-8">
            {loading ? (
              <div className="text-center py-5">
                <span className="spinner-border" style={{ color: '#1a237e' }}></span>
              </div>
            ) : entries.length ? (
              <div className="card">
                <div className="card-header-ewc">
                  <i className="bi bi-table me-2"></i>Timetable
                </div>
                <div className="card-body p-0">
                  <TimetableGrid entries={entries} slots={slots} />
                </div>
              </div>
            ) : (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>No timetable entries found for this faculty.
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedDept && !selectedSem && (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-person-lines-fill" style={{ fontSize: '3rem', opacity: 0.2 }}></i>
          <p className="mt-3">Select a department and semester to view faculty</p>
        </div>
      )}
    </>
  )
}
