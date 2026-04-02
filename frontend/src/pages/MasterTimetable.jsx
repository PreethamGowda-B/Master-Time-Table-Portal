import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const DAYS    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function MasterTimetable() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [departments, setDepartments]   = useState([])
  const [slots, setSlots]               = useState([])
  const [timetable, setTimetable]       = useState(null)
  const [workload, setWorkload]         = useState([])
  const [loading, setLoading]           = useState(false)

  const filterDept = searchParams.get('department') || ''
  const filterSem  = searchParams.get('semester')   || ''

  useEffect(() => {
    api.get('/departments/').then(r => setDepartments(r.data))
    api.get('/timeslots/').then(r => setSlots(r.data))
  }, [])

  useEffect(() => {
    if (!filterDept || !filterSem) { setTimetable(null); setWorkload([]); return }
    setLoading(true)
    Promise.all([
      api.get(`/timetables/?department=${filterDept}&semester=${filterSem}&active=true`),
      api.get(`/faculty-workload/?department=${filterDept}&semester=${filterSem}`),
    ]).then(([ttRes, wlRes]) => {
      setTimetable(ttRes.data[0] || null)
      setWorkload(wlRes.data)
    }).catch(() => toast.error('Failed to load timetable'))
      .finally(() => setLoading(false))
  }, [filterDept, filterSem])

  const dept         = departments.find(d => String(d.id) === String(filterDept))
  const mondaySlots  = slots.filter(s => s.day === 'Monday').sort((a, b) => a.slot_number - b.slot_number)

  // Build lookup: day -> slot_number -> entry
  const lookup = {}
  DAYS.forEach(d => { lookup[d] = {} })
  if (timetable) {
    timetable.entries.forEach(e => { if (lookup[e.day]) lookup[e.day][e.slot_number] = e })
  }

  function setFilter(key, val) {
    const next = new URLSearchParams(searchParams)
    next.set(key, val)
    setSearchParams(next)
  }

  function downloadPDF() {
    if (!timetable || !dept) return
    const doc = new jsPDF({ orientation: 'landscape', format: 'a3' })
    const pw = doc.internal.pageSize.width

    doc.setFontSize(18)
    doc.setTextColor(26, 35, 126)
    doc.text('East West College of Management', pw / 2, 18, { align: 'center' })
    doc.setFontSize(12)
    doc.setTextColor(60, 60, 60)
    doc.text(`Master Timetable — ${dept.name} | Semester ${filterSem} | ${timetable.academic_year}`, pw / 2, 27, { align: 'center' })

    const head = [['Day / Slot', ...mondaySlots.map(s =>
      s.is_break ? 'Break' : `Slot ${s.slot_number}\n${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}`
    )]]

    const body = DAYS.map(day => [
      day,
      ...mondaySlots.map(ms => {
        if (ms.is_break) return 'Break'
        const e = lookup[day]?.[ms.slot_number]
        if (!e) return '—'
        return `${e.subject_code}\n${e.faculty_name?.split(' ').slice(-1)[0]}\n${e.classroom_name}`
      })
    ])

    autoTable(doc, {
      head, body, startY: 34,
      headStyles: { fillColor: [26, 35, 126], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 7, halign: 'center', valign: 'middle', minCellHeight: 14 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [232, 234, 246], halign: 'left' } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })

    // Workload table on next section
    if (workload.length > 0) {
      const finalY = doc.lastAutoTable.finalY + 12
      doc.setFontSize(11)
      doc.setTextColor(26, 35, 126)
      doc.text('Faculty Workload Summary', 14, finalY)
      autoTable(doc, {
        head: [['Faculty', 'Employee ID', 'Periods Assigned']],
        body: workload.map(w => [w.name, w.employee_id, w.periods]),
        startY: finalY + 4,
        headStyles: { fillColor: [26, 35, 126], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
      })
    }

    doc.save(`master_timetable_${dept.code}_sem${filterSem}.pdf`)
    toast.success('PDF downloaded')
  }

  return (
    <>
      <div className="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h4 className="mb-1"><i className="bi bi-table me-2"></i>Master Timetable</h4>
          <p className="text-muted mb-0">
            {dept && filterSem ? `${dept.name} — Semester ${filterSem}` : 'Select department and semester'}
          </p>
        </div>
        {timetable && (
          <button className="btn btn-danger btn-sm" onClick={downloadPDF}>
            <i className="bi bi-file-earmark-pdf me-1"></i>Download PDF
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label mb-1 small fw-semibold">Department</label>
              <input
                list="deptFilterOptions"
                className="form-control form-control-sm"
                placeholder="Type or select department"
                value={(departments.find(d => String(d.id) === String(filterDept)) || {}).name || filterDept}
                onChange={e => {
                  const val = e.target.value
                  const match = departments.find(d => d.name === val)
                  setFilter('department', match ? match.id : val)
                }}
              />
              <datalist id="deptFilterOptions">
                {departments.map(d => <option key={d.id} value={d.name} />)}
              </datalist>
            </div>
            <div className="col-auto">
              <label className="form-label mb-1 small fw-semibold">Semester</label>
              <select className="form-select form-select-sm" value={filterSem}
                onChange={e => setFilter('semester', e.target.value)} disabled={!filterDept}>
                <option value="">{filterDept ? '-- Select Semester --' : '-- Select dept first --'}</option>
                {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {(!filterDept || !filterSem) && (
        <div className="alert alert-secondary text-center py-5">
          <i className="bi bi-funnel" style={{ fontSize: '2rem', display: 'block', marginBottom: 8, opacity: 0.4 }}></i>
          Please select a Department and Semester to view the master timetable
        </div>
      )}

      {/* Loading */}
      {filterDept && filterSem && loading && (
        <div className="text-center py-5">
          <span className="spinner-border" style={{ color: '#1a237e' }}></span>
        </div>
      )}

      {/* No timetable */}
      {filterDept && filterSem && !loading && !timetable && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          No active timetable found for <strong>{dept?.name} Semester {filterSem}</strong>.
          Generate one from the <a href="/portal/generate" className="alert-link">Generate Timetable</a> page.
        </div>
      )}

      {/* Master timetable grid */}
      {timetable && !loading && (
        <>
          <div className="card mb-4">
            <div className="card-header-ewc">
              <i className="bi bi-grid-3x3-gap me-2"></i>
              {dept?.name} | Semester {filterSem} | {timetable.academic_year}
              <span className="ms-3 badge bg-light text-dark" style={{ fontSize: '0.75rem' }}>
                {timetable.entries.length} entries
              </span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-bordered mb-0" style={{ minWidth: 800, fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#1a237e', color: 'white', width: 90, verticalAlign: 'middle', textAlign: 'center' }}>
                        Day
                      </th>
                      {mondaySlots.map(s => (
                        s.is_break
                          ? <th key={s.id} style={{ background: '#fff3cd', color: '#856404', textAlign: 'center', minWidth: 90, verticalAlign: 'middle' }}>
                              🍽 Break<br /><small style={{ fontWeight: 400 }}>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</small>
                            </th>
                          : <th key={s.id} style={{ background: '#1a237e', color: 'white', textAlign: 'center', minWidth: 110, verticalAlign: 'middle' }}>
                              Slot {s.slot_number}<br />
                              <small style={{ fontWeight: 400, opacity: 0.85 }}>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</small>
                            </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day, di) => (
                      <tr key={day}>
                        <td style={{ background: '#e8eaf6', fontWeight: 700, textAlign: 'center', verticalAlign: 'middle', color: '#1a237e' }}>
                          {day}
                        </td>
                        {mondaySlots.map(ms => {
                          if (ms.is_break) return (
                            <td key={ms.id} style={{ background: '#fff3cd', textAlign: 'center', verticalAlign: 'middle', color: '#856404', fontWeight: 600, fontSize: '0.75rem' }}>
                              Break
                            </td>
                          )
                          const e = lookup[day]?.[ms.slot_number]
                          const isLab = e && (e.is_lab_slot || e.subject_is_lab)

                          // Detect if this is the second slot of a lab pair — skip it (merged into first)
                          const prevEntry = lookup[day]?.[ms.slot_number - 1]
                          const isLabSecond = prevEntry && e &&
                            prevEntry.subject === e.subject &&
                            prevEntry.faculty === e.faculty &&
                            (prevEntry.is_lab_slot || prevEntry.subject_is_lab)
                          if (isLabSecond) return null

                          // Detect if this is the first slot of a lab pair
                          const nextEntry = lookup[day]?.[ms.slot_number + 1]
                          const isLabFirst = isLab && nextEntry &&
                            nextEntry.subject === e.subject &&
                            nextEntry.faculty === e.faculty

                          if (isLabFirst) {
                            return (
                              <td key={ms.id} colSpan={2}
                                style={{ verticalAlign: 'middle', textAlign: 'center', background: '#fdf4ff', padding: '6px 8px', border: '2px solid #a855f7' }}>
                                <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.82rem' }}>
                                  {e.subject_code}
                                  <span style={{ marginLeft: 5, fontSize: '0.65rem', background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>LAB 2hr</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: 2 }}>{e.faculty_name}</div>
                                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 1 }}>
                                  <i className="bi bi-door-open"></i> {e.classroom_name}
                                </div>
                              </td>
                            )
                          }

                          return (
                            <td key={ms.id} style={{ verticalAlign: 'middle', textAlign: 'center', background: e ? (isLab ? '#fdf4ff' : '#f0fdf4') : '#fafafa', padding: '6px 8px' }}>
                              {e ? (
                                <>
                                  <div style={{ fontWeight: 700, color: isLab ? '#7c3aed' : '#1a237e', fontSize: '0.82rem' }}>
                                    {e.subject_code}
                                    {isLab && <span style={{ marginLeft: 4, fontSize: '0.65rem', background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>LAB</span>}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: 2 }}>{e.faculty_name}</div>
                                  <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 1 }}>
                                    <i className="bi bi-door-open"></i> {e.classroom_name}
                                  </div>
                                </>
                              ) : <span style={{ color: '#d1d5db' }}>—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Faculty Workload Summary */}
          {workload.length > 0 && (
            <div className="card">
              <div className="card-header-ewc">
                <i className="bi bi-bar-chart me-2"></i>Faculty Workload Summary
              </div>
              <div className="card-body p-0">
                <table className="table table-hover mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th>Faculty</th>
                      <th>Employee ID</th>
                      <th>Periods Assigned</th>
                      <th>Workload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map(w => {
                      const maxPeriods = workload[0]?.periods || 1
                      const pct = Math.round((w.periods / maxPeriods) * 100)
                      return (
                        <tr key={w.faculty_id}>
                          <td style={{ fontWeight: 600 }}>{w.name}</td>
                          <td><span className="badge" style={{ background: '#1a237e' }}>{w.employee_id}</span></td>
                          <td>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1a237e' }}>{w.periods}</span>
                            <span className="text-muted ms-1" style={{ fontSize: '0.78rem' }}>periods/week</span>
                          </td>
                          <td style={{ minWidth: 160 }}>
                            <div style={{ background: '#e8eaf6', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, background: pct > 75 ? '#dc2626' : pct > 50 ? '#d97706' : '#059669', height: '100%', borderRadius: 6, transition: 'width 0.4s' }}></div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
