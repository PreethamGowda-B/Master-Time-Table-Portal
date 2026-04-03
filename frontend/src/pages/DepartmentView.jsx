import React, { useEffect, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import api from "../api/axios"
import toast from "react-hot-toast"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function fmtTime(t) {
  if (!t) return ""
  const parts = t.slice(0, 5).split(":").map(Number)
  const h = parts[0], m = parts[1]
  return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM")
}

export default function DepartmentView() {
  const { deptId }     = useParams()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const user           = JSON.parse(localStorage.getItem("user") || "{}")
  const isAdmin        = user.role === "admin" || user.role === "hod"
  const isFaculty      = user.role === "faculty"
  const canEdit        = isAdmin || isFaculty  // both can enter edit mode

  const [departments, setDepartments] = useState([])
  const [timetable, setTimetable]     = useState(null)
  const [slots, setSlots]             = useState([])
  const [semester, setSemester]       = useState(Number(searchParams.get("semester")) || 1)
  const [loading, setLoading]         = useState(false)
  const [editMode, setEditMode]       = useState(false)
  const [editEntry, setEditEntry]     = useState(null)
  const [editSaving, setEditSaving]   = useState(false)
  const [subjects, setSubjects]       = useState([])
  const [classrooms, setClassrooms]   = useState([])
  // Controlled edit state
  const [selectedSubject, setSelectedSubject] = useState(null)  // full subject object
  const [autoFaculty, setAutoFaculty]         = useState(null)  // auto-resolved faculty
  const [autoClassroom, setAutoClassroom]     = useState(null)  // auto-resolved classroom
  const [facultyLoading, setFacultyLoading]   = useState(false)

  useEffect(function() {
    api.get("/departments/").then(function(r) { setDepartments(r.data) })
    api.get("/timeslots/").then(function(r) { setSlots(r.data) })
  }, [])

  useEffect(function() {
    setLoading(true)
    api.get("/timetables/?department=" + deptId + "&semester=" + semester + "&active=true")
      .then(function(r) { setTimetable(r.data[0] || null) })
      .finally(function() { setLoading(false) })
  }, [deptId, semester])

  useEffect(function() {
    if (!editEntry) return
    api.get("/subjects/?department=" + deptId + "&semester=" + semester).then(function(r) { setSubjects(r.data) })
    api.get("/classrooms/").then(function(r) { setClassrooms(r.data) })
  }, [editEntry])

  var dept = departments.find(function(d) { return d.id === Number(deptId) })

  var lookup = {}
  DAYS.forEach(function(d) { lookup[d] = {} })
  if (timetable) timetable.entries.forEach(function(e) { if (lookup[e.day]) lookup[e.day][e.slot_number] = e })

  var mondaySlots = slots.filter(function(s) { return s.day === "Monday" }).sort(function(a, b) { return a.slot_number - b.slot_number })

  function openEdit(entry) {
    setEditEntry(entry)
    setAutoFaculty({ id: entry.faculty, name: entry.faculty_name })
    setAutoClassroom(null)
    setSelectedSubject(null)

    Promise.all([
      api.get(`/auth/faculty-users/?department=${deptId}&semester=${semester}`),
      api.get("/classrooms/"),
      api.get("/timetables/?department=" + deptId + "&semester=" + semester + "&active=true")
    ]).then(function([facultyRes, roomRes, ttRes]) {
      const allRooms = roomRes.data
      setClassrooms(allRooms)

      // Find occupied rooms in this slot (excluding current entry)
      const tt = ttRes.data[0]
      const occupiedRoomIds = tt ? tt.entries
        .filter(e => e.timeslot_id === entry.timeslot_id && e.id !== entry.id)
        .map(e => Number(e.classroom)) : []

      // Find the faculty record for this slot's faculty
      const slotFaculty = facultyRes.data.find(f => f.id === entry.faculty)
      if (slotFaculty && slotFaculty.subjects && slotFaculty.subjects.length > 0) {
        setSubjects(slotFaculty.subjects)
        const cur = slotFaculty.subjects.find(s => s.id === entry.subject)
        if (cur) {
          setSelectedSubject(cur)
          setAutoFaculty({ id: slotFaculty.id, name: slotFaculty.full_name })
          // Use current room if free, else pick another free room of correct type
          const currentRoom = allRooms.find(c => c.id === entry.classroom)
          const preferred = (!occupiedRoomIds.includes(entry.classroom) && currentRoom)
            ? currentRoom
            : allRooms.find(c => c.is_lab === cur.is_lab && !occupiedRoomIds.includes(c.id))
            || allRooms.find(c => !occupiedRoomIds.includes(c.id))
            || allRooms[0]
          setAutoClassroom(preferred || null)
        }
      } else {
        api.get("/subjects/?department=" + deptId + "&semester=" + semester).then(function(r) {
          setSubjects(r.data)
          const cur = r.data.find(s => s.id === entry.subject)
          if (cur) {
            setSelectedSubject(cur)
            const currentRoom = allRooms.find(c => c.id === entry.classroom)
            const preferred = (!occupiedRoomIds.includes(entry.classroom) && currentRoom)
              ? currentRoom
              : allRooms.find(c => c.is_lab === cur.is_lab && !occupiedRoomIds.includes(c.id))
              || allRooms[0]
            setAutoClassroom(preferred || null)
          }
        })
      }
    })
  }

  function resolveFaculty(subject, fallbackFacultyId, fallbackFacultyName) {
    if (!subject) return
    // Faculty is already locked to the slot owner — just confirm via assignment
    setFacultyLoading(true)
    api.get(`/auth/faculty-users/?department=${deptId}&semester=${semester}`)
      .then(function(r) {
        const match = r.data.find(f =>
          f.subjects && f.subjects.some(s => s.id === subject.id)
        )
        setAutoFaculty(match
          ? { id: match.id, name: match.full_name }
          : { id: fallbackFacultyId, name: fallbackFacultyName }
        )
      })
      .finally(() => setFacultyLoading(false))
  }

  function handleSubjectChange(subjectId) {
    const subj = subjects.find(s => s.id === Number(subjectId))
    if (!subj) return
    setSelectedSubject(subj)
    // Classroom stays the same — we only change the subject
  }

  function saveEdit(e) {
    e.preventDefault()
    if (!selectedSubject) {
      toast.error("Select a subject first")
      return
    }
    const facultyId = autoFaculty ? autoFaculty.id : editEntry.faculty
    setEditSaving(true)
    api.patch("/timetable-entries/" + editEntry.id + "/", {
      subject: selectedSubject.id,
      faculty: facultyId,
      classroom: editEntry.classroom,
    }).then(function() {
      return api.get("/timetables/?department=" + deptId + "&semester=" + semester + "&active=true")
    }).then(function(r) {
      setTimetable(r.data[0] || null)
      toast.success("Subject updated successfully")
      setEditEntry(null)
    }).catch(function(err) {
      toast.error((err.response && err.response.data && err.response.data.error) || "Failed to save")
    }).finally(function() { setEditSaving(false) })
  }

  function downloadIcal() {
    if (!timetable) return
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//EWC Timetable//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ]
    const dayOffset = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5 }
    // Use next Monday as base date
    const base = new Date()
    base.setDate(base.getDate() + ((1 - base.getDay() + 7) % 7 || 7))

    timetable.entries.forEach(e => {
      if (!e.start_time || !e.end_time) return
      const offset = dayOffset[e.day] ?? 0
      const d = new Date(base)
      d.setDate(base.getDate() + offset)
      const fmt = (dt, time) => {
        const [h, m] = time.slice(0, 5).split(':')
        return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}T${h}${m}00`
      }
      lines.push('BEGIN:VEVENT')
      lines.push(`DTSTART:${fmt(d, e.start_time)}`)
      lines.push(`DTEND:${fmt(d, e.end_time)}`)
      lines.push(`SUMMARY:${e.subject_code} - ${e.subject_name || ''}`)
      lines.push(`DESCRIPTION:Faculty: ${e.faculty_name}\\nRoom: ${e.classroom_name}`)
      lines.push(`LOCATION:${e.classroom_name}`)
      lines.push(`RRULE:FREQ=WEEKLY`)
      lines.push(`UID:ewc-${timetable.id}-${e.id}@timetable`)
      lines.push('END:VEVENT')
    })
    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `timetable_sem${semester}.ics`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Calendar file downloaded')
  }

  function downloadPDF() {
    if (!timetable) return
    var doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(16); doc.setTextColor(26, 35, 126)
    doc.text("East West College of Management", doc.internal.pageSize.width / 2, 18, { align: "center" })
    doc.setFontSize(11); doc.setTextColor(80, 80, 80)
    doc.text((dept ? dept.name : "") + " | Semester " + semester + " | " + timetable.academic_year, doc.internal.pageSize.width / 2, 26, { align: "center" })
    var head = [["Day"].concat(mondaySlots.map(function(s) { return s.is_break ? "Break" : (s.start_time ? s.start_time.slice(0,5) : "") + "\n" + (s.end_time ? s.end_time.slice(0,5) : "") }))]
    var body = DAYS.map(function(day) {
      return [day].concat(mondaySlots.map(function(ms) {
        if (ms.is_break) return "Break"
        var e = lookup[day] && lookup[day][ms.slot_number]
        return e ? e.subject_code + "\n" + (e.faculty_name ? e.faculty_name.split(" ").pop() : "") + "\n" + e.classroom_name : "-"
      }))
    })
    autoTable(doc, { head: head, body: body, startY: 32, headStyles: { fillColor: [26, 35, 126], fontSize: 8 }, bodyStyles: { fontSize: 7, halign: "center" }, columnStyles: { 0: { fontStyle: "bold", fillColor: [232, 234, 246] } } })
    doc.save("timetable_" + (dept ? dept.code : "dept") + "_sem" + semester + ".pdf")
    toast.success("PDF downloaded")
  }

  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "page-header d-flex justify-content-between align-items-center flex-wrap gap-2" },
      React.createElement("div", null,
        React.createElement("h4", { className: "mb-1" }, React.createElement("i", { className: "bi bi-building me-2" }), "Department Timetable"),
        React.createElement("p", { className: "text-muted mb-0" }, (dept ? dept.name : "") + " \u2014 Semester " + semester)
      ),
      React.createElement("div", { className: "d-flex gap-2 flex-wrap" },
        timetable && canEdit && React.createElement("button", {
          className: "btn btn-sm " + (editMode ? "btn-warning" : "btn-outline-warning"),
          onClick: function() { setEditMode(function(v) { return !v }) }
        }, React.createElement("i", { className: "bi " + (editMode ? "bi-x-circle" : "bi-pencil-square") + " me-1" }), editMode ? "Exit Edit Mode" : "Edit Timetable"),
        timetable && React.createElement("button", { className: "btn btn-danger btn-sm", onClick: downloadPDF },
          React.createElement("i", { className: "bi bi-file-earmark-pdf me-1" }), "Download PDF"),
        timetable && React.createElement("button", { className: "btn btn-outline-success btn-sm", onClick: downloadIcal },
          React.createElement("i", { className: "bi bi-calendar-plus me-1" }), "Export iCal")
      )
    ),

    editMode && React.createElement("div", { className: "alert alert-warning py-2 mb-3 d-flex align-items-center gap-2", style: { fontSize: "0.85rem" } },
      React.createElement("i", { className: "bi bi-pencil-fill" }),
      React.createElement("strong", null, "Edit Mode ON"),
      isFaculty
        ? " — You can only edit slots assigned to you. Other slots are locked."
        : " — Click any filled cell to edit its subject and faculty."
    ),

    React.createElement("div", { className: "card mb-3" },
      React.createElement("div", { className: "card-body py-2" },
        React.createElement("div", { className: "row g-2 align-items-end" },
          React.createElement("div", { className: "col-auto" },
            React.createElement("label", { className: "form-label mb-1 small fw-semibold" }, "Department"),
            React.createElement("select", { className: "form-select form-select-sm", value: deptId, onChange: function(e) { navigate("/portal/department/" + e.target.value + "?semester=" + semester) } },
              departments.map(function(d) { return React.createElement("option", { key: d.id, value: d.id }, d.name) })
            )
          ),
          React.createElement("div", { className: "col-auto" },
            React.createElement("label", { className: "form-label mb-1 small fw-semibold" }, "Semester"),
            React.createElement("select", { className: "form-select form-select-sm", value: semester, onChange: function(e) { setSemester(Number(e.target.value)) } },
              [1,2,3,4,5,6,7,8].map(function(s) { return React.createElement("option", { key: s, value: s }, "Semester " + s) })
            )
          )
        )
      )
    ),

    loading ? React.createElement("div", { className: "text-center py-5" }, React.createElement("span", { className: "spinner-border", style: { color: "#1a237e" } }))
    : timetable ? React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-header-ewc" },
          React.createElement("i", { className: "bi bi-table me-2" }),
          (dept ? dept.name : "") + " | Sem " + semester + " | " + timetable.academic_year
        ),
        React.createElement("div", { className: "card-body p-0" },
          React.createElement("div", { className: "table-responsive" },
            React.createElement("table", { className: "table table-bordered mb-0", style: { minWidth: 700, fontSize: "0.82rem" } },
              React.createElement("thead", null,
                React.createElement("tr", null,
                  React.createElement("th", { style: { background: "#1a237e", color: "white", width: 90, textAlign: "center", verticalAlign: "middle" } }, "Day"),
                  mondaySlots.map(function(s) {
                    return s.is_break
                      ? React.createElement("th", { key: s.id, style: { background: "#fff3cd", color: "#856404", textAlign: "center", minWidth: 80, verticalAlign: "middle" } }, "\uD83C\uDF7D Break", React.createElement("br"), React.createElement("small", { style: { fontWeight: 400 } }, fmtTime(s.start_time) + "\u2013" + fmtTime(s.end_time)))
                      : React.createElement("th", { key: s.id, style: { background: "#1a237e", color: "white", textAlign: "center", minWidth: 110, verticalAlign: "middle" } }, "Slot " + s.slot_number, React.createElement("br"), React.createElement("small", { style: { fontWeight: 400, opacity: 0.85 } }, fmtTime(s.start_time) + "\u2013" + fmtTime(s.end_time)))
                  })
                )
              ),
              React.createElement("tbody", null,
                DAYS.map(function(day) {
                  return React.createElement("tr", { key: day },
                    React.createElement("td", { style: { background: "#e8eaf6", fontWeight: 700, textAlign: "center", verticalAlign: "middle", color: "#1a237e" } }, day),
                    mondaySlots.map(function(ms) {
                      if (ms.is_break) return React.createElement("td", { key: ms.id, style: { background: "#fff3cd", textAlign: "center", verticalAlign: "middle", color: "#856404", fontWeight: 600, fontSize: "0.75rem" } }, "Break")
                      var entry = lookup[day] && lookup[day][ms.slot_number]
                      // Faculty can only edit their own slots; admin/hod can edit all
                      var isOwnSlot = isAdmin || (isFaculty && entry && entry.faculty === user.faculty_id)
                      var clickable = editMode && entry && isOwnSlot
                      var lockedByOther = editMode && entry && isFaculty && !isOwnSlot
                      return React.createElement("td", {
                        key: ms.id,
                        onClick: function() {
                          if (clickable) { openEdit(entry) }
                          else if (lockedByOther) { toast.error("You can only edit your own assigned slots") }
                        },
                        style: {
                          verticalAlign: "middle", textAlign: "center", padding: "6px 8px",
                          background: lockedByOther ? "#f8f8f8" : entry ? "#f0fdf4" : "#fafafa",
                          cursor: clickable ? "pointer" : lockedByOther ? "not-allowed" : "default",
                          outline: clickable ? "2px dashed #f59e0b" : "none",
                          opacity: lockedByOther ? 0.55 : 1,
                        },
                        title: clickable ? "Click to edit" : lockedByOther ? "Assigned to another faculty" : ""
                      },
                        entry ? React.createElement(React.Fragment, null,
                          React.createElement("div", { style: { fontWeight: 700, color: "#1a237e", fontSize: "0.82rem" } }, entry.subject_code),
                          React.createElement("div", { style: { fontSize: "0.72rem", color: "#374151", marginTop: 2 } }, entry.faculty_name),
                          React.createElement("div", { style: { fontSize: "0.68rem", color: "#6b7280", marginTop: 1 } }, React.createElement("i", { className: "bi bi-door-open" }), " " + entry.classroom_name),
                          clickable && React.createElement("div", { style: { fontSize: "0.65rem", color: "#d97706", marginTop: 3 } }, React.createElement("i", { className: "bi bi-pencil" }), " edit"),
                          lockedByOther && React.createElement("div", { style: { fontSize: "0.65rem", color: "#9ca3af", marginTop: 3 } }, React.createElement("i", { className: "bi bi-lock-fill" }), " locked")
                        ) : React.createElement("span", { style: { color: "#d1d5db" } }, "\u2014")
                      )
                    })
                  )
                })
              )
            )
          )
        )
      )
    : React.createElement("div", { className: "alert alert-warning" },
        React.createElement("i", { className: "bi bi-exclamation-triangle me-2" }),
        "No active timetable for ", React.createElement("strong", null, (dept ? dept.name : "") + " Semester " + semester), ". ",
        React.createElement("span", { className: "alert-link", style: { cursor: "pointer" }, onClick: function() { navigate("/portal/generate") } }, "Generate one now.")
      ),

    editEntry && React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
      React.createElement("div", { style: { background: "white", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)", border: "1px solid #e2e8f0" } },

        // Header
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 } },
          React.createElement("div", null,
            React.createElement("h5", { style: { margin: 0, fontWeight: 800, color: "#1e293b", fontSize: "1.1rem" } },
              React.createElement("i", { className: "bi bi-pencil-square me-2", style: { color: "#f59e0b" } }), "Edit Slot"),
            React.createElement("div", { style: { fontSize: "0.82rem", color: "#64748b", marginTop: 5 } },
              React.createElement("strong", null, editEntry.day), " — Slot ", editEntry.slot_number, "  ",
              React.createElement("span", { style: { background: "#e0e7ff", color: "#4338ca", padding: "2px 8px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 700, marginLeft: 6 } },
                fmtTime(editEntry.start_time), " – ", fmtTime(editEntry.end_time))
            )
          ),
          React.createElement("button", { onClick: function() { setEditEntry(null) }, style: { background: "#f1f5f9", border: "none", cursor: "pointer", width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" } },
            React.createElement("i", { className: "bi bi-x-lg" }))
        ),

        // Lab warning
        editEntry.is_lab_slot && React.createElement("div", { style: { background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: "0.8rem", color: "#1d4ed8" } },
          React.createElement("i", { className: "bi bi-info-circle-fill me-2" }),
          React.createElement("strong", null, "Lab Slot"), " — both consecutive slots will update together automatically."
        ),

        React.createElement("form", { onSubmit: saveEdit },

          // Subject selector (controlled dropdown)
          React.createElement("div", { className: "mb-3" },
            React.createElement("label", { style: { fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" } },
              React.createElement("i", { className: "bi bi-book me-1" }), "Subject"),
            React.createElement("select", {
              className: "form-select form-select-sm",
              value: selectedSubject ? selectedSubject.id : "",
              onChange: function(e) { handleSubjectChange(e.target.value) },
              required: true,
              style: { borderRadius: 8, borderColor: "#d1d5db" }
            },
              React.createElement("option", { value: "" }, "— Select Subject —"),
              subjects.map(function(s) {
                return React.createElement("option", { key: s.id, value: s.id },
                  s.code + " — " + s.name + " [" + (s.is_lab ? "Lab" : "Theory") + "]")
              })
            )
          ),

          // Faculty — read only, auto-assigned
          React.createElement("div", { className: "mb-3" },
            React.createElement("label", { style: { fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" } },
              React.createElement("i", { className: "bi bi-person-fill me-1" }), "Faculty",
              React.createElement("span", { style: { fontSize: "0.7rem", color: "#6b7280", fontWeight: 400, marginLeft: 6 } }, "(auto-assigned, read-only)")
            ),
            React.createElement("div", { style: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: "0.88rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 8, minHeight: 36 } },
              facultyLoading
                ? React.createElement("span", { className: "spinner-border spinner-border-sm", style: { color: "#1a237e" } })
                : React.createElement(React.Fragment, null,
                    React.createElement("i", { className: "bi bi-person-badge", style: { color: "#1a237e" } }),
                    React.createElement("span", { style: { fontWeight: 600 } }, autoFaculty ? autoFaculty.name : "—"),
                    autoFaculty && React.createElement("span", { style: { marginLeft: "auto", fontSize: "0.7rem", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 6, fontWeight: 600 } }, "Auto")
                  )
            )
          ),

          // Classroom — kept as-is, shown read-only
          React.createElement("div", { className: "mb-4" },
            React.createElement("label", { style: { fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" } },
              React.createElement("i", { className: "bi bi-door-open me-1" }), "Classroom",
              React.createElement("span", { style: { fontSize: "0.7rem", color: "#6b7280", fontWeight: 400, marginLeft: 6 } }, "(unchanged)")
            ),
            React.createElement("div", { style: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: "0.88rem", color: "#64748b", display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("i", { className: "bi bi-lock-fill", style: { fontSize: "0.75rem" } }),
              React.createElement("span", null, (classrooms.find(c => c.id === editEntry.classroom) || {}).name || "—")
            )
          ),

          // Actions
          React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
            React.createElement("button", { type: "button", onClick: function() { setEditEntry(null) }, className: "btn btn-light px-4", style: { borderRadius: 10, fontWeight: 600 } }, "Cancel"),
            React.createElement("button", { type: "submit", disabled: editSaving || !selectedSubject || facultyLoading, className: "btn px-4", style: { borderRadius: 10, fontWeight: 700, background: "linear-gradient(135deg, #1a237e, #3949ab)", color: "white", border: "none" } },
              editSaving
                ? React.createElement(React.Fragment, null, React.createElement("span", { className: "spinner-border spinner-border-sm me-2" }), "Saving...")
                : React.createElement(React.Fragment, null, React.createElement("i", { className: "bi bi-check-lg me-1" }), "Save Changes")
            )
          )
        )
      )
    )

  )
}
