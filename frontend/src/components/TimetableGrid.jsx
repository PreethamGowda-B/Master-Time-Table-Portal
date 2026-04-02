import React from 'react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function TimetableGrid({ entries, slots }) {
  const mondaySlots = slots
    .filter(s => s.day === 'Monday')
    .sort((a, b) => a.slot_number - b.slot_number)

  // lookup: day -> slot_number -> entry
  const lookup = {}
  DAYS.forEach(d => { lookup[d] = {} })
  entries.forEach(e => { if (lookup[e.day]) lookup[e.day][e.slot_number] = e })

  // Detect lab pairs using is_lab_slot and lab_pair_id from backend
  // Returns set of "day-slot_number" keys that are the SECOND slot of a lab pair
  const labSecondSlots = new Set()
  const labPairFirstSlots = new Map() // lab_pair_id -> first slot entry
  
  DAYS.forEach(day => {
    const dayEntries = Object.values(lookup[day] || {}).sort((a, b) => a.slot_number - b.slot_number)
    
    // Group by lab_pair_id
    const labPairs = {}
    dayEntries.forEach(e => {
      if (e.is_lab_slot && e.lab_pair_id) {
        if (!labPairs[e.lab_pair_id]) labPairs[e.lab_pair_id] = []
        labPairs[e.lab_pair_id].push(e)
      }
    })
    
    // Mark second slots
    Object.values(labPairs).forEach(pair => {
      if (pair.length === 2) {
        pair.sort((a, b) => a.slot_number - b.slot_number)
        labSecondSlots.add(`${day}-${pair[1].slot_number}`)
        labPairFirstSlots.set(pair[0].lab_pair_id, pair[0])
      }
    })
  })

  function isLabFirst(day, slotNum) {
    const e1 = lookup[day]?.[slotNum]
    if (!e1) return false
    
    // Check if this entry is marked as lab and has a pair
    if (e1.is_lab_slot && e1.lab_pair_id) {
      const e2 = lookup[day]?.[slotNum + 1]
      return e2 && e2.is_lab_slot && e2.lab_pair_id === e1.lab_pair_id
    }
    
    return false
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered tt-table mb-0" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th className="slot-head" style={{ width: 90 }}>Day</th>
            {mondaySlots.map(s => (
              s.is_break
                ? <th key={s.id} className="slot-head text-center" style={{ background: '#fff3cd', color: '#856404', minWidth: 80 }}>
                    🍽 Break<br /><small>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</small>
                  </th>
                : <th key={s.id} className="slot-head text-center">
                    Slot {s.slot_number}<br />
                    <small>{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</small>
                  </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map(day => (
            <tr key={day}>
              <td className="day-col text-center" style={{ verticalAlign: 'middle' }}>{day}</td>
              {mondaySlots.map(ms => {
                if (ms.is_break) return (
                  <td key={ms.id} className="tt-cell text-center"
                    style={{ background: '#fff3cd', color: '#856404', fontWeight: 600, fontSize: '0.75rem', verticalAlign: 'middle' }}>
                    Break
                  </td>
                )

                // Skip second slot of a lab pair — it's merged into the first
                if (labSecondSlots.has(`${day}-${ms.slot_number}`)) return null

                const entry = lookup[day]?.[ms.slot_number]
                const isLab = entry && isLabFirst(day, ms.slot_number)

                // Lab entry spans 2 columns
                if (isLab) {
                  return (
                    <td key={ms.id} colSpan={2} className="tt-cell text-center"
                      style={{ background: '#fdf4ff', verticalAlign: 'middle', border: '2px solid #a855f7' }}>
                      <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: '0.82rem' }}>
                        {entry.subject_code}
                        <span style={{ marginLeft: 5, fontSize: '0.65rem', background: '#ede9fe', padding: '1px 6px', borderRadius: 6 }}>LAB 2hr</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: 2 }}>{entry.faculty_name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 1 }}>
                        <i className="bi bi-door-open"></i> {entry.classroom_name}
                      </div>
                    </td>
                  )
                }

                return (
                  <td key={ms.id} className="tt-cell text-center"
                    style={{ background: entry ? '#f0fdf4' : '', verticalAlign: 'middle' }}>
                    {entry ? (
                      <>
                        <div className="sub-code">{entry.subject_code}</div>
                        <div className="fac-name" style={{ fontSize: '0.75rem', color: '#374151', marginTop: 2 }}>
                          {entry.faculty_name}
                        </div>
                        <div className="room-name">
                          <i className="bi bi-door-open"></i> {entry.classroom_name}
                        </div>
                      </>
                    ) : <span className="text-muted">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
