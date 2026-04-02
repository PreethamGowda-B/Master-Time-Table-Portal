import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]

export default function GenerateTimetable() {
  const [departments, setDepartments] = useState([])
  const [form, setForm]               = useState({ department: '', semester: 1, academic_year: '2024-25' })
  const [loading, setLoading]         = useState(false)
  const [loadingAll, setLoadingAll]   = useState(false)
  const [result, setResult]           = useState(null)
  const [allResults, setAllResults]   = useState([])  // results from Generate All
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/departments/').then(r => setDepartments(r.data))
  }, [])

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post('/timetables/generate/', form)
      const stats = data._stats || {}
      const deptName = departments.find(d => String(d.id) === String(form.department))?.name || ''
      setResult({ ...stats, deptName, sem: form.semester, deptId: form.department })
      if (stats.empty > 0) {
        toast.success(stats.message || 'Timetable generated. Some slots empty due to constraints.')
      } else {
        toast.success('Timetable generated successfully!')
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateAll() {
    setLoadingAll(true)
    setAllResults([])
    setResult(null)
    const year = form.academic_year || '2024-25'

    try {
      // Single API call — backend generates all depts in one pass with fair distribution
      const { data } = await api.post('/timetables/generate_all/', { academic_year: year })
      const results = (data.results || []).map(r => ({
        deptName: r.department_name,
        sem:      r.semester,
        deptId:   r.department_id,
        success:  r.success,
        total:    r.total   || 0,
        theory:   r.theory  || 0,
        lab:      r.lab     || 0,
        empty:    r.empty   || 0,
        error:    r.error   || '',
      }))
      setAllResults(results)

      const failed     = data.failed || 0
      const totalEmpty = data.total_empty || 0
      if (failed > 0) {
        toast.error(`${failed} department(s) failed to generate`)
      } else if (totalEmpty > 0) {
        toast.success(`All ${results.length} timetables generated. ${totalEmpty} total empty slots.`)
      } else {
        toast.success(`All ${results.length} timetables generated successfully!`)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generate all failed')
    } finally {
      setLoadingAll(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <h4 className="mb-1"><i className="bi bi-magic me-2"></i>Generate Timetable</h4>
        <p className="text-muted mb-0">Auto-generate conflict-free timetables</p>
      </div>

      <div className="row justify-content-center">
        <div className="col-md-7">

          {/* Generate All Card */}
          <div className="card mb-4 border-primary">
            <div className="card-header fw-bold" style={{ background: '#1e3a5f', color: 'white' }}>
              <i className="bi bi-lightning-fill me-2"></i>Generate All Departments at Once
            </div>
            <div className="card-body p-4">
              <p className="text-muted small mb-3">
                Automatically generates timetables for every department and semester that has subjects and faculty assigned.
              </p>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Academic Year</label>
                <input type="text" className="form-control" style={{ maxWidth: 200 }}
                  value={form.academic_year}
                  onChange={e => setForm({ ...form, academic_year: e.target.value })} />
              </div>
              <button className="btn btn-primary w-100 py-2 fw-semibold" onClick={handleGenerateAll} disabled={loadingAll || loading}>
                {loadingAll
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Generating all timetables...</>
                  : <><i className="bi bi-collection me-2"></i>Generate All Departments &amp; Semesters</>}
              </button>
            </div>
          </div>

          {/* All Results Table */}
          {allResults.length > 0 && (
            <div className="card mb-4">
              <div className="card-header-ewc"><i className="bi bi-table me-2"></i>Generation Results</div>
              <div className="card-body p-0">
                <table className="table table-sm table-bordered mb-0 small">
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th className="ps-3">Department</th>
                      <th>Sem</th>
                      <th className="text-center">Total</th>
                      <th className="text-center">Theory</th>
                      <th className="text-center">Lab</th>
                      <th className="text-center">Empty</th>
                      <th className="text-center">Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allResults.map((r, i) => (
                      <tr key={i}>
                        <td className="ps-3 fw-semibold">{r.deptName}</td>
                        <td>S{r.sem}</td>
                        <td className="text-center">{r.success ? r.total || 0 : 'â€”'}</td>
                        <td className="text-center">{r.success ? r.theory || 0 : 'â€”'}</td>
                        <td className="text-center">{r.success ? r.lab || 0 : 'â€”'}</td>
                        <td className="text-center">
                          {r.success
                            ? <span style={{ color: r.empty > 0 ? '#d97706' : '#059669', fontWeight: 700 }}>{r.empty || 0}</span>
                            : 'â€”'}
                        </td>
                        <td className="text-center">
                          {r.success
                            ? <span className="badge bg-success">Done</span>
                            : <span className="badge bg-danger" title={r.error}>Failed</span>}
                        </td>
                        <td>
                          {r.success && (
                            <button className="btn btn-outline-primary btn-sm py-0 px-2"
                              onClick={() => navigate(`/portal/department/${r.deptId}?semester=${r.sem}`)}>
                              View
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ background: '#f8fafc' }}>
                    <tr>
                      <td colSpan={2} className="ps-3 fw-bold">Total</td>
                      <td className="text-center fw-bold">{allResults.reduce((s, r) => s + (r.total || 0), 0)}</td>
                      <td className="text-center fw-bold">{allResults.reduce((s, r) => s + (r.theory || 0), 0)}</td>
                      <td className="text-center fw-bold">{allResults.reduce((s, r) => s + (r.lab || 0), 0)}</td>
                      <td className="text-center fw-bold" style={{ color: '#d97706' }}>
                        {allResults.reduce((s, r) => s + (r.empty || 0), 0)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Single Department Generator */}
          <div className="card mb-4">
            <div className="card-header-ewc"><i className="bi bi-building me-2"></i>Generate Single Department</div>
            <div className="card-body p-4">
              <form onSubmit={handleGenerate}>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Department</label>
                  <input list="genDeptOptions" className="form-control" placeholder="Type or select department" required
                    value={(departments.find(d => String(d.id) === String(form.department)) || {}).name || form.department}
                    onChange={e => {
                      const val = e.target.value
                      const match = departments.find(d => d.name === val)
                      setForm({ ...form, department: match ? match.id : val })
                    }} />
                  <datalist id="genDeptOptions">
                    {departments.map(d => <option key={d.id} value={d.name} />)}
                  </datalist>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Semester</label>
                  <select className="form-select" required value={form.semester}
                    onChange={e => setForm({ ...form, semester: e.target.value })}>
                    {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="form-label fw-semibold small">Academic Year</label>
                  <input type="text" className="form-control" placeholder="e.g. 2024-25" required
                    value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-success w-100 py-2 fw-semibold" disabled={loading || loadingAll}>
                  {loading
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                    : <><i className="bi bi-lightning-charge me-2"></i>Generate Timetable</>}
                </button>
              </form>
            </div>
          </div>

          {/* Single result */}
          {result && (
            <div className={`card mb-4 border-${result.empty > 0 ? 'info' : 'success'}`}>
              <div className={`card-header fw-bold text-${result.empty > 0 ? 'info' : 'success'} bg-${result.empty > 0 ? 'info' : 'success'} bg-opacity-10`}>
                <i className={`bi bi-${result.empty > 0 ? 'info-circle' : 'check-circle'} me-2`}></i>
                {result.deptName} â€” Sem {result.sem}
              </div>
              <div className="card-body">
                <div className="row text-center g-3 mb-3">
                  {[
                    { label: 'Total', val: result.total || 0, color: '#059669' },
                    { label: 'Theory', val: result.theory || 0, color: '#0891b2' },
                    { label: 'Lab', val: result.lab || 0, color: '#7c3aed' },
                    { label: 'Empty', val: result.empty || 0, color: result.empty > 0 ? '#d97706' : '#059669' },
                  ].map(({ label, val, color }) => (
                    <div className="col-3" key={label}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{val}</div>
                      <div className="text-muted small">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-ewc btn-sm flex-fill"
                    onClick={() => navigate(`/portal/department/${result.deptId}?semester=${result.sem}`)}>
                    <i className="bi bi-building me-1"></i>View Timetable
                  </button>
                  <button className="btn btn-outline-secondary btn-sm flex-fill"
                    onClick={() => navigate(`/portal/master-timetable?department=${result.deptId}&semester=${result.sem}`)}>
                    <i className="bi bi-table me-1"></i>Master View
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
