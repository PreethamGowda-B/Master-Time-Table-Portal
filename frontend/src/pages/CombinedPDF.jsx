import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function CombinedPDF() {
  const [departments, setDepartments]     = useState([])
  const [selectedDepts, setSelectedDepts] = useState([])
  const [selectedSems, setSelectedSems]   = useState([])
  const [loading, setLoading]             = useState(false)

  useEffect(() => {
    api.get('/departments/').then(r => setDepartments(r.data))
  }, [])

  function toggleDept(id) {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  function toggleSem(s) {
    setSelectedSems(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  async function handleDownload() {
    if (!selectedDepts.length || !selectedSems.length) {
      toast.error('Select at least one department and one semester')
      return
    }
    setLoading(true)
    try {
      const BACKEND = import.meta.env.VITE_API_URL || 'https://master-time-table-portal.onrender.com'
      const token = localStorage.getItem('token')
      const res = await fetch(`${BACKEND}/api/timetables/export-pdf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`,
        },
        body: JSON.stringify({ departments: selectedDepts, semesters: selectedSems }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Export failed')
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'combined_timetable.pdf'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Download failed')
    } finally {
      setLoading(false)
    }
  }

  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
        borderColor: active ? '#1a237e' : '#d1d5db',
        background: active ? '#1a237e' : 'white',
        color: active ? 'white' : '#374151',
        fontWeight: active ? 700 : 400, fontSize: '0.85rem',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
      {active && <i className="bi bi-check-lg me-1" style={{ fontSize: '0.75rem' }}></i>}
      {label}
    </button>
  )

  return (
    <>
      <div className="page-header">
        <h4 className="mb-1"><i className="bi bi-file-earmark-pdf me-2"></i>Combined Timetable PDF</h4>
        <p className="text-muted mb-0">Select departments and semesters to export a combined PDF</p>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header-ewc"><i className="bi bi-building me-2"></i>Select Departments</div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button onClick={() => setSelectedDepts(departments.map(d => d.id))}
                  className="btn btn-outline-secondary btn-sm">Select All</button>
                <button onClick={() => setSelectedDepts([])}
                  className="btn btn-outline-secondary btn-sm">Clear</button>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {departments.map(d => chip(d.name, selectedDepts.includes(d.id), () => toggleDept(d.id)))}
              </div>
              {selectedDepts.length > 0 && (
                <div className="mt-2" style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {selectedDepts.length} selected
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header-ewc"><i className="bi bi-calendar3 me-2"></i>Select Semesters</div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button onClick={() => setSelectedSems([...SEMESTERS])}
                  className="btn btn-outline-secondary btn-sm">Select All</button>
                <button onClick={() => setSelectedSems([])}
                  className="btn btn-outline-secondary btn-sm">Clear</button>
              </div>
              <div className="d-flex flex-wrap gap-2">
                {SEMESTERS.map(s => chip(`Sem ${s}`, selectedSems.includes(s), () => toggleSem(s)))}
              </div>
              {selectedSems.length > 0 && (
                <div className="mt-2" style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  {selectedSems.length} selected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary + Download */}
      <div className="card mt-4">
        <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            {selectedDepts.length > 0 && selectedSems.length > 0 ? (
              <div style={{ fontSize: '0.88rem', color: '#374151' }}>
                <i className="bi bi-info-circle me-2 text-primary"></i>
                Will export <strong>{selectedDepts.length} department(s)</strong> × <strong>{selectedSems.length} semester(s)</strong>
                {' '}= up to <strong>{selectedDepts.length * selectedSems.length}</strong> timetables
              </div>
            ) : (
              <div style={{ fontSize: '0.88rem', color: '#9ca3af' }}>
                <i className="bi bi-arrow-left me-2"></i>Select departments and semesters above
              </div>
            )}
          </div>
          <button
            onClick={handleDownload}
            disabled={loading || !selectedDepts.length || !selectedSems.length}
            className="btn btn-danger px-5 py-2 fw-bold"
            style={{ borderRadius: 10, fontSize: '0.95rem' }}>
            {loading
              ? <><span className="spinner-border spinner-border-sm me-2"></span>Generating PDF...</>
              : <><i className="bi bi-file-earmark-pdf me-2"></i>Download Combined PDF</>}
          </button>
        </div>
      </div>
    </>
  )
}
