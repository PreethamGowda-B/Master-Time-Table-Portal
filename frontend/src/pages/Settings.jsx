import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function Settings() {
  const [timeslots, setTimeslots]   = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [tab, setTab]               = useState('classrooms')
  const [loading, setLoading]       = useState(false)

  // Classroom form
  const [roomForm, setRoomForm] = useState({ name: '', capacity: 30, is_lab: false })
  // Timeslot form
  const [tsForm, setTsForm] = useState({ day: 'Monday', slot_number: 1, start_time: '08:45', end_time: '09:45', is_break: false })

  useEffect(() => {
    api.get('/timeslots/').then(r => setTimeslots(r.data))
    api.get('/classrooms/').then(r => setClassrooms(r.data))
  }, [])

  async function addClassroom(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/classrooms/', roomForm)
      setClassrooms(c => [...c, data])
      setRoomForm({ name: '', capacity: 30, is_lab: false })
      toast.success('Classroom added')
    } catch { toast.error('Failed to add classroom') }
    finally { setLoading(false) }
  }

  async function deleteClassroom(id) {
    if (!confirm('Delete this classroom?')) return
    try {
      await api.delete(`/classrooms/${id}/`)
      setClassrooms(c => c.filter(r => r.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  async function addTimeslot(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/timeslots/', tsForm)
      setTimeslots(t => [...t, data])
      toast.success('Timeslot added')
    } catch { toast.error('Failed to add timeslot') }
    finally { setLoading(false) }
  }

  async function deleteTimeslot(id) {
    if (!confirm('Delete this timeslot? This may affect existing timetables.')) return
    try {
      await api.delete(`/timeslots/${id}/`)
      setTimeslots(t => t.filter(s => s.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const tabStyle = (t) => ({
    padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
    background: tab === t ? '#1a237e' : 'transparent',
    color: tab === t ? 'white' : '#64748b',
    transition: 'all 0.2s',
  })

  return (
    <>
      <div className="page-header">
        <h4 className="mb-1"><i className="bi bi-gear-fill me-2"></i>Settings</h4>
        <p className="text-muted mb-0">Manage classrooms and timeslots</p>
      </div>

      <div className="d-flex gap-2 mb-4">
        <button style={tabStyle('classrooms')} onClick={() => setTab('classrooms')}>
          <i className="bi bi-door-open me-2"></i>Classrooms
        </button>
        <button style={tabStyle('timeslots')} onClick={() => setTab('timeslots')}>
          <i className="bi bi-clock me-2"></i>Timeslots
        </button>
      </div>

      {tab === 'classrooms' && (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-header-ewc"><i className="bi bi-plus-circle me-2"></i>Add Classroom</div>
              <div className="card-body">
                <form onSubmit={addClassroom}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Room Name</label>
                    <input className="form-control form-control-sm" placeholder="e.g. Room 101" required
                      value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Capacity</label>
                    <input type="number" className="form-control form-control-sm" min={1}
                      value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: Number(e.target.value) }))} />
                  </div>
                  <div className="mb-3 form-check">
                    <input type="checkbox" className="form-check-input" id="isLab"
                      checked={roomForm.is_lab} onChange={e => setRoomForm(f => ({ ...f, is_lab: e.target.checked }))} />
                    <label className="form-check-label small" htmlFor="isLab">Is a Lab room</label>
                  </div>
                  <button type="submit" className="btn btn-ewc btn-sm w-100" disabled={loading}>
                    <i className="bi bi-plus me-1"></i>Add Classroom
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-8">
            <div className="card">
              <div className="card-header-ewc"><i className="bi bi-building me-2"></i>All Classrooms ({classrooms.length})</div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr><th className="ps-3">Name</th><th>Type</th><th>Capacity</th><th></th></tr>
                  </thead>
                  <tbody>
                    {classrooms.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted py-3">No classrooms yet</td></tr>
                    )}
                    {classrooms.map(r => (
                      <tr key={r.id}>
                        <td className="ps-3 fw-semibold">{r.name}</td>
                        <td>
                          <span className={`badge ${r.is_lab ? 'bg-purple' : 'bg-primary'}`}
                            style={{ background: r.is_lab ? '#7c3aed' : '#1a237e', fontSize: '0.7rem' }}>
                            {r.is_lab ? 'Lab' : 'Theory'}
                          </span>
                        </td>
                        <td>{r.capacity || '—'}</td>
                        <td>
                          <button className="btn btn-outline-danger btn-sm py-0 px-2"
                            onClick={() => deleteClassroom(r.id)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'timeslots' && (
        <div className="row g-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-header-ewc"><i className="bi bi-plus-circle me-2"></i>Add Timeslot</div>
              <div className="card-body">
                <form onSubmit={addTimeslot}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Day</label>
                    <select className="form-select form-select-sm" value={tsForm.day}
                      onChange={e => setTsForm(f => ({ ...f, day: e.target.value }))}>
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Slot Number</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={20}
                      value={tsForm.slot_number} onChange={e => setTsForm(f => ({ ...f, slot_number: Number(e.target.value) }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Start Time</label>
                    <input type="time" className="form-control form-control-sm"
                      value={tsForm.start_time} onChange={e => setTsForm(f => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">End Time</label>
                    <input type="time" className="form-control form-control-sm"
                      value={tsForm.end_time} onChange={e => setTsForm(f => ({ ...f, end_time: e.target.value }))} />
                  </div>
                  <div className="mb-3 form-check">
                    <input type="checkbox" className="form-check-input" id="isBreak"
                      checked={tsForm.is_break} onChange={e => setTsForm(f => ({ ...f, is_break: e.target.checked }))} />
                    <label className="form-check-label small" htmlFor="isBreak">Is a Break slot</label>
                  </div>
                  <button type="submit" className="btn btn-ewc btn-sm w-100" disabled={loading}>
                    <i className="bi bi-plus me-1"></i>Add Timeslot
                  </button>
                </form>
              </div>
            </div>
          </div>
          <div className="col-md-8">
            <div className="card">
              <div className="card-header-ewc"><i className="bi bi-clock me-2"></i>All Timeslots ({timeslots.length})</div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr><th className="ps-3">Day</th><th>Slot</th><th>Time</th><th>Type</th><th></th></tr>
                  </thead>
                  <tbody>
                    {timeslots.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted py-3">No timeslots yet</td></tr>
                    )}
                    {timeslots.map(s => (
                      <tr key={s.id}>
                        <td className="ps-3 fw-semibold">{s.day}</td>
                        <td>{s.is_break ? '—' : s.slot_number}</td>
                        <td>{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</td>
                        <td>
                          <span className="badge" style={{ background: s.is_break ? '#d97706' : '#1a237e', fontSize: '0.7rem' }}>
                            {s.is_break ? 'Break' : 'Slot'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-outline-danger btn-sm py-0 px-2"
                            onClick={() => deleteTimeslot(s.id)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
