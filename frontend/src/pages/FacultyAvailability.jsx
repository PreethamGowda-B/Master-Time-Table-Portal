import React, { useEffect, useRef, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

function fmt(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function FacultyAvailability() {
  const [departments,      setDepartments]      = useState([])
  const [selectedDept,     setSelectedDept]     = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [faculties,        setFaculties]        = useState([])
  const [selectedFaculty,  setSelectedFaculty]  = useState('')
  const [slots,            setSlots]            = useState([])
  const [availability,     setAvailability]     = useState({})
  // BUSY: THIS faculty already assigned in another timetable (hard block, non-selectable)
  const [busySlots,        setBusySlots]        = useState([])
  // TAKEN: first faculty per slot in same dept+sem (for TAKEN label in individual view)
  const [takenMap,         setTakenMap]         = useState({})
  // allNamesMap: ALL faculty who saved each slot in this dept+sem (for overview display)
  const [allNamesMap,      setAllNamesMap]      = useState({})
  // deptSlotMap: from generated timetable (one faculty per slot)
  const [deptSlotMap,      setDeptSlotMap]      = useState({})
  const [facultySubjects,  setFacultySubjects]  = useState([])
  const [loading,          setLoading]          = useState(false)
  const loadedForRef = useRef(null)

  useEffect(() => {
    api.get('/timeslots/').then(r => setSlots(r.data)).catch(() => {})
    api.get('/departments/').then(r => setDepartments(r.data)).catch(() => {})
  }, [])

  // Reset when dept/semester changes
  useEffect(() => {
    setSelectedFaculty('')
    setFaculties([])
    setAvailability({})
    setBusySlots([])
    setTakenMap({})
    setAllNamesMap({})
    setDeptSlotMap({})
    setFacultySubjects([])
    loadedForRef.current = null
    if (!selectedDept || !selectedSemester) return
    api.get(`/auth/faculty-users/?department=${selectedDept}&semester=${selectedSemester}`)
      .then(r => setFaculties(r.data))
      .catch(() => toast.error('Failed to load faculty list'))
  }, [selectedDept, selectedSemester])

  // Load overview (timetable) and takenMap (same-sem availability) when dept/sem changes
  useEffect(() => {
    if (!selectedDept || !selectedSemester) return

    // Overview: who is assigned in the generated timetable per slot (one per slot)
    api.get(`/dept-slot-assignments/?department=${selectedDept}&semester=${selectedSemester}`)
      .then(r => setDeptSlotMap(r.data))
      .catch(() => {})

    // takenMap + allNamesMap: build sequentially to avoid race conditions
    api.get(`/auth/faculty-users/?department=${selectedDept}&semester=${selectedSemester}`)
      .then(async r => {
        const facultyList = r.data
        if (!facultyList.length) return
        const raw = {}      // first faculty per slot (for TAKEN label)
        const allNames = {} // all faculty per slot (for overview)
        for (const f of facultyList) {
          try {
            const res = await api.get(`/faculty-availability/?faculty=${f.id}&department=${selectedDept}&semester=${selectedSemester}`)
            res.data.forEach(a => {
              if (a.is_available) {
                const key = String(a.timeslot)
                if (!raw[key]) raw[key] = { faculty_id: f.id, faculty_name: f.full_name }
                if (!allNames[key]) allNames[key] = []
                if (!allNames[key].includes(f.full_name)) allNames[key].push(f.full_name)
              }
            })
          } catch (_) {}
        }
        setTakenMap(raw)
        setAllNamesMap(allNames)
      })
      .catch(() => {})
  }, [selectedDept, selectedSemester])

  // Load faculty data when faculty changes — full reset, no stale state
  useEffect(() => {
    setAvailability({})
    setBusySlots([])
    setFacultySubjects([])
    loadedForRef.current = null
    if (!selectedFaculty || selectedFaculty === 'all') return

    const facId = String(selectedFaculty)
    loadedForRef.current = facId
    const fac = faculties.find(f => String(f.id) === facId)
    if (fac) setFacultySubjects(fac.subjects || [])

    // BUSY = this SAME faculty is already assigned in ANOTHER timetable (not current dept+sem)
    const excl = selectedDept && selectedSemester
      ? `&exclude_department=${selectedDept}&exclude_semester=${selectedSemester}` : ''
    api.get(`/faculty-assignments/?faculty=${facId}${excl}`)
      .then(r => { if (loadedForRef.current === facId) setBusySlots(r.data) })
      .catch(() => {})

    // Load saved availability for this faculty — scoped to current dept+sem
    const defaults = {}
    slots.forEach(s => { if (!s.is_break) defaults[s.id] = false })
    const deptSemParams = selectedDept && selectedSemester
      ? `&department=${selectedDept}&semester=${selectedSemester}` : ''
    api.get(`/faculty-availability/?faculty=${facId}${deptSemParams}`)
      .then(r => {
        if (loadedForRef.current !== facId) return
        const map = {}
        r.data.forEach(a => { map[a.timeslot] = a.is_available })
        setAvailability({ ...defaults, ...map })
      })
      .catch(() => {})
  }, [selectedFaculty]) // eslint-disable-line react-hooks/exhaustive-deps

  // Three-state slot evaluation
  function getBlockInfo(slotId) {
    const sid = String(slotId)

    // STATE 1: BUSY — same faculty assigned in another timetable (hard block)
    const busy = busySlots.find(b => b.timeslot_id === slotId)
    if (busy) return {
      type: 'busy',
      label: 'BUSY',
      sub: `${busy.department_name} S${busy.semester}`,
      bg: '#f3e8ff', color: '#7c3aed',
      blocked: true,
    }

    // STATE 2: TAKEN — another faculty in same dept+sem saved this slot (soft, still selectable)
    // Only show if current faculty hasn't already selected it themselves
    const taken = takenMap[sid]
    if (taken && String(taken.faculty_id) !== String(selectedFaculty) && !availability[slotId]) {
      return {
        type: 'taken',
        label: 'Taken by',
        sub: taken.faculty_name,
        bg: '#fef9c3', color: '#92400e',
        blocked: false,
      }
    }

    return null
  }

  function isBlocked(slotId) {
    return getBlockInfo(slotId)?.blocked === true
  }

  function toggle(slotId) {
    if (isBlocked(slotId)) return
    setAvailability(prev => ({ ...prev, [slotId]: !prev[slotId] }))
  }

  function setAll(val) {
    const patch = {}
    slots.filter(s => !s.is_break).forEach(s => {
      if (val && isBlocked(s.id)) return
      patch[s.id] = val
    })
    setAvailability(prev => ({ ...prev, ...patch }))
  }

  async function handleSave() {
    if (!selectedFaculty || selectedFaculty === 'all') return
    setLoading(true)
    try {
      const payload = slots.filter(s => !s.is_break)
        .map(s => ({ timeslot_id: s.id, is_available: !!availability[s.id] }))
      await api.post('/faculty-availability/', {
        faculty: selectedFaculty,
        department: selectedDept,
        semester: selectedSemester,
        slots: payload,
      })

      // Re-fetch scoped to this dept+sem to confirm save
      const facId = String(selectedFaculty)
      const r = await api.get(`/faculty-availability/?faculty=${facId}&department=${selectedDept}&semester=${selectedSemester}`)
      const defaults = {}
      slots.forEach(s => { if (!s.is_break) defaults[s.id] = false })
      const map = {}
      r.data.forEach(a => { map[a.timeslot] = a.is_available })
      setAvailability({ ...defaults, ...map })

      // Refresh takenMap + allNamesMap so other faculty see updated state
      if (selectedDept && selectedSemester) {
        const fl = await api.get(`/auth/faculty-users/?department=${selectedDept}&semester=${selectedSemester}`)
        const raw = {}
        const allNames = {}
        for (const f of fl.data) {
          try {
            const res = await api.get(`/faculty-availability/?faculty=${f.id}&department=${selectedDept}&semester=${selectedSemester}`)
            res.data.forEach(a => {
              if (a.is_available) {
                const key = String(a.timeslot)
                if (!raw[key]) raw[key] = { faculty_id: f.id, faculty_name: f.full_name }
                if (!allNames[key]) allNames[key] = []
                if (!allNames[key].includes(f.full_name)) allNames[key].push(f.full_name)
              }
            })
          } catch (_) {}
        }
        setTakenMap(raw)
        setAllNamesMap(allNames)
      }

      const savedCount = r.data.filter(a => a.is_available).length
      toast.success(`Saved ${savedCount} available slots`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const slotsByDay = DAYS.reduce((acc, day) => {
    acc[day] = slots.filter(s => s.day === day).sort((a, b) => a.slot_number - b.slot_number)
    return acc
  }, {})
  const headerSlots = slotsByDay['Monday'] || []
  const selectedFacultyName = faculties.find(f => String(f.id) === String(selectedFaculty))?.full_name || ''

  return (
    <>
      <div className="page-header">
        <h4 className="mb-1"><i className="bi bi-person-check me-2"></i>Faculty Availability</h4>
        <p className="text-muted mb-0">Mark available time slots per faculty member</p>
      </div>

      <div className="card">
        <div className="card-header-ewc"><i className="bi bi-clock me-2"></i>Set Availability Slots</div>
        <div className="card-body">

          <div className="d-flex gap-3 mb-3 flex-wrap" style={{ fontSize: '0.78rem' }}>
            {[
              { bg: '#e8f5e9', bd: '#a5d6a7', label: 'Available (selected)' },
              { bg: '#f3e8ff', bd: '#a855f7', label: 'Busy — same faculty, other timetable' },
              { bg: '#fef9c3', bd: '#f59e0b', label: 'Taken by another faculty (same sem)' },
              { bg: '#fff3cd', bd: '#fcd34d', label: 'Break' },
            ].map(({ bg, bd, label }) => (
              <span key={label}>
                <span style={{ display: 'inline-block', width: 13, height: 13, background: bg, border: `1px solid ${bd}`, borderRadius: 3, marginRight: 4, verticalAlign: 'middle' }} />
                {label}
              </span>
            ))}
          </div>

          <div className="row mb-4 align-items-end g-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold small">Department</label>
              <input list="deptOpts" className="form-control" placeholder="Type or select..."
                value={(departments.find(d => String(d.id) === String(selectedDept)) || {}).name || selectedDept}
                onChange={e => {
                  const match = departments.find(d => d.name === e.target.value)
                  setSelectedDept(match ? String(match.id) : e.target.value)
                }} />
              <datalist id="deptOpts">
                {departments.map(d => <option key={d.id} value={d.name} />)}
              </datalist>
            </div>

            <div className="col-md-2">
              <label className="form-label fw-semibold small">Semester</label>
              <select className="form-select" value={selectedSemester}
                onChange={e => setSelectedSemester(e.target.value)}>
                <option value="">-- Semester --</option>
                {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold small">Faculty</label>
              <select className="form-select" value={selectedFaculty}
                onChange={e => setSelectedFaculty(e.target.value)}
                disabled={!selectedDept || !selectedSemester}>
                <option value="">
                  {selectedDept && selectedSemester ? '-- Select Faculty --' : '-- Select dept & sem first --'}
                </option>
                <option value="all">All Faculty (overview)</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
              </select>
            </div>

            {selectedFaculty && selectedFaculty !== 'all' && (
              <div className="col-auto d-flex gap-2">
                <button className="btn btn-outline-success btn-sm" onClick={() => setAll(true)}>
                  <i className="bi bi-check-all me-1"></i>Select All
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setAll(false)}>
                  <i className="bi bi-x-circle me-1"></i>Clear All
                </button>
              </div>
            )}
          </div>

          {selectedFaculty && selectedFaculty !== 'all' && (
            <div className="mb-3">
              {facultySubjects.length > 0 ? (
                <div style={{ padding: '8px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', fontSize: '0.8rem' }}>
                  <strong style={{ color: '#0369a1' }}>
                    <i className="bi bi-book me-1"></i>{selectedFacultyName} subjects (Sem {selectedSemester}):
                  </strong>
                  {facultySubjects.map(s => (
                    <span key={s.id} style={{ display: 'inline-block', background: '#e0f2fe', color: '#0369a1', padding: '1px 9px', borderRadius: 10, fontSize: '0.73rem', fontWeight: 600, marginLeft: 6, marginTop: 3 }}>
                      {s.code}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '7px 14px', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a', fontSize: '0.8rem', color: '#92400e' }}>
                  <i className="bi bi-exclamation-triangle me-1"></i>
                  No subjects assigned to {selectedFacultyName} for Sem {selectedSemester}.
                </div>
              )}
            </div>
          )}

          <div className="table-responsive">
            <table className="table table-bordered text-center small mb-0">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Day</th>
                  {headerSlots.map(s => (
                    s.is_break
                      ? <th key={s.id} style={{ background: '#fff3cd', color: '#856404', minWidth: 80 }}>
                          Break<br /><small>{fmt(s.start_time)}-{fmt(s.end_time)}</small>
                        </th>
                      : <th key={s.id}>
                          Slot {s.slot_number}<br />
                          <small>{fmt(s.start_time)}-{fmt(s.end_time)}</small>
                        </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {!selectedFaculty && (
                  <tr>
                    <td colSpan={headerSlots.length + 1} className="text-muted py-4">
                      <i className="bi bi-arrow-up-circle me-2"></i>Select a faculty member above
                    </td>
                  </tr>
                )}

                {/* All Faculty overview — shows all faculty available per slot for this dept+sem */}
                {selectedFaculty === 'all' && (() => {
                  if (!Object.keys(takenMap).length) return (
                    <tr>
                      <td colSpan={headerSlots.length + 1} className="text-muted py-4">
                        <i className="bi bi-info-circle me-2"></i>
                        No availability saved yet for this department and semester.
                      </td>
                    </tr>
                  )
                  return DAYS.map(day => (
                    <tr key={day}>
                      <td className="day-col">{day}</td>
                      {slotsByDay[day]?.map(slot => {
                        if (slot.is_break) return (
                          <td key={slot.id} style={{ background: '#fff3cd', color: '#856404', fontSize: '0.72rem', fontWeight: 600 }}>Break</td>
                        )
                        // Show ALL faculty who saved this slot (not just first-save-wins)
                        const names = allNamesMap[String(slot.id)] || []
                        return (
                          <td key={slot.id} style={{ background: names.length ? '#f0fdf4' : '#fafafa', verticalAlign: 'middle', padding: '4px 6px' }}>
                            {names.length
                              ? names.map((name, i) => (
                                  <div key={i} style={{ fontSize: '0.65rem', color: '#166534', fontWeight: 600, lineHeight: 1.5 }}>
                                    <i className="bi bi-person-check-fill me-1" style={{ color: '#16a34a' }}></i>
                                    {name}
                                  </div>
                                ))
                              : <span style={{ color: '#d1d5db', fontSize: '0.7rem' }}>—</span>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  ))
                })()}

                {/* Individual faculty grid — three states */}
                {selectedFaculty && selectedFaculty !== 'all' && DAYS.map(day => (
                  <tr key={day}>
                    <td className="day-col">{day}</td>
                    {slotsByDay[day]?.map(slot => {
                      if (slot.is_break) return (
                        <td key={slot.id} style={{ background: '#fff3cd', color: '#856404', fontSize: '0.72rem', fontWeight: 600, verticalAlign: 'middle' }}>
                          Break
                        </td>
                      )
                      const blockInfo = getBlockInfo(slot.id)
                      const checked = !!availability[slot.id]

                      // BUSY — hard block, cannot select
                      if (blockInfo?.blocked) return (
                        <td key={slot.id} style={{ background: blockInfo.bg, cursor: 'not-allowed', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '0.63rem', color: blockInfo.color, fontWeight: 700, lineHeight: 1.2 }}>
                            <i className="bi bi-slash-circle d-block mb-1" />
                            {blockInfo.label}<br />
                            <span style={{ fontSize: '0.6rem', fontWeight: 500 }}>{blockInfo.sub}</span>
                          </div>
                        </td>
                      )

                      // TAKEN — soft info, still selectable
                      if (blockInfo?.type === 'taken') return (
                        <td key={slot.id}
                          style={{ cursor: 'pointer', background: checked ? '#e8f5e9' : blockInfo.bg, verticalAlign: 'middle', border: '1px solid #fcd34d' }}
                          onClick={() => toggle(slot.id)}>
                          {!checked && (
                            <div style={{ fontSize: '0.58rem', color: blockInfo.color, fontWeight: 600, lineHeight: 1.2, marginBottom: 2 }}>
                              <i className="bi bi-person-fill me-1" />
                              {blockInfo.label} {blockInfo.sub}
                            </div>
                          )}
                          <input type="checkbox" className="form-check-input"
                            checked={checked}
                            onChange={() => toggle(slot.id)}
                            onClick={e => e.stopPropagation()} />
                        </td>
                      )

                      // AVAILABLE — normal selectable
                      return (
                        <td key={slot.id}
                          style={{ cursor: 'pointer', background: checked ? '#e8f5e9' : '', verticalAlign: 'middle' }}
                          onClick={() => toggle(slot.id)}>
                          <input type="checkbox" className="form-check-input"
                            checked={checked}
                            onChange={() => toggle(slot.id)}
                            onClick={e => e.stopPropagation()} />
                        </td>
                      )
                    })}
                  </tr>
                ))}

              </tbody>
            </table>
          </div>

          <button className="btn btn-ewc mt-3 px-4" onClick={handleSave}
            disabled={loading || !selectedFaculty || selectedFaculty === 'all'}>
            {loading
              ? <span className="spinner-border spinner-border-sm me-2" />
              : <i className="bi bi-save me-2" />}
            Save Availability
          </button>

        </div>
      </div>
    </>
  )
}