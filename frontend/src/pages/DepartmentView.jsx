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
  const canEdit        = user.role === "admin" || user.role === "hod"

  const [departments, setDepartments] = useState([])
  const [timetable, setTimetable]     = useState(null)
  const [slots, setSlots]             = useState([])
  const [semester, setSemester]       = useState(Number(searchParams.get("semester")) || 1)
  const [loading, setLoading]         = useState(false)
  const [editMode, setEditMode]       = useState(false)
  const [editEntry, setEditEntry]     = useState(null)
  const [editForm, setEditForm]       = useState({})
  const [editSaving, setEditSaving]   = useState(false)
  const [subjects, setSubjects]       = useState([])
  const [faculties, setFaculties]     = useState([])
  const [classrooms, setClassrooms]   = useState([])
  const [occupiedFids, setOccupiedFids] = useState([])

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
    api.get("/faculty/?department=" + deptId).then(function(r) { setFaculties(r.data) })
    api.get("/classrooms/").then(function(r) { setClassrooms(r.data) })
  }, [editEntry])

  var dept = departments.find(function(d) { return d.id === Number(deptId) })

  var lookup = {}
  DAYS.forEach(function(d) { lookup[d] = {} })
  if (timetable) timetable.entries.forEach(function(e) { if (lookup[e.day]) lookup[e.day][e.slot_number] = e })

  var mondaySlots = slots.filter(function(s) { return s.day === "Monday" }).sort(function(a, b) { return a.slot_number - b.slot_number })

  function openEdit(entry) {
    setEditEntry(entry)
    setEditForm({ subject: entry.subject, faculty: entry.faculty, classroom: entry.classroom })
    setOccupiedFids([])
    api.get("/timeslot-occupancy/?timeslot_id=" + entry.timeslot_id).then(function(r) {
      setOccupiedFids(r.data)
    })
  }

  function saveEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    api.patch("/timetable-entries/" + editEntry.id + "/", {
      subject: editForm.subject,
      faculty: editForm.faculty,
      classroom: editForm.classroom,
    }).then(function(res) {
      setTimetable(function(tt) {
        return Object.assign({}, tt, {
          entries: tt.entries.map(function(en) {
            return en.id === editEntry.id ? Object.assign({}, en, res.data) : en
          })
        })
      })
      toast.success("Entry updated")
      setEditEntry(null)
    }).catch(function(err) {
      toast.error((err.response && err.response.data && err.response.data.error) || "Failed to save")
    }).finally(function() { setEditSaving(false) })
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
          React.createElement("i", { className: "bi bi-file-earmark-pdf me-1" }), "Download PDF")
      )
    ),

    editMode && React.createElement("div", { className: "alert alert-warning py-2 mb-3 d-flex align-items-center gap-2", style: { fontSize: "0.85rem" } },
      React.createElement("i", { className: "bi bi-pencil-fill" }),
      React.createElement("strong", null, "Edit Mode ON"),
      " \u2014 Click any filled cell to change its subject, faculty, or classroom."
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
                      var clickable = editMode && entry
                      return React.createElement("td", {
                        key: ms.id,
                        onClick: function() { if (clickable) openEdit(entry) },
                        style: { verticalAlign: "middle", textAlign: "center", padding: "6px 8px", background: entry ? "#f0fdf4" : "#fafafa", cursor: clickable ? "pointer" : "default", outline: clickable ? "2px dashed #f59e0b" : "none" },
                        title: clickable ? "Click to edit this slot" : ""
                      },
                        entry ? React.createElement(React.Fragment, null,
                          React.createElement("div", { style: { fontWeight: 700, color: "#1a237e", fontSize: "0.82rem" } }, entry.subject_code),
                          React.createElement("div", { style: { fontSize: "0.72rem", color: "#374151", marginTop: 2 } }, entry.faculty_name),
                          React.createElement("div", { style: { fontSize: "0.68rem", color: "#6b7280", marginTop: 1 } }, React.createElement("i", { className: "bi bi-door-open" }), " " + entry.classroom_name),
                          editMode && React.createElement("div", { style: { fontSize: "0.65rem", color: "#d97706", marginTop: 3 } }, React.createElement("i", { className: "bi bi-pencil" }), " edit")
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

    editEntry && React.createElement("div", { style: { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
      React.createElement("div", { style: { background: "white", borderRadius: 20, padding: 32, width: "100%", maxWidth: 500, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 } },
          React.createElement("div", null,
            React.createElement("h5", { style: { margin: 0, fontWeight: 800, color: "#1e293b", fontSize: "1.25rem" } },
              React.createElement("i", { className: "bi bi-pencil-square", style: { color: "#f59e0b", marginRight: 10 } }), "Modify Time Slot"),
            React.createElement("div", { style: { fontSize: "0.85rem", color: "#64748b", marginTop: 6, fontWeight: 500 } },
              editEntry.day + " \u2014 Slot " + editEntry.slot_number + "  ",
              React.createElement("span", { style: { background: "#e0e7ff", color: "#4338ca", padding: "2px 10px", borderRadius: 10, fontSize: "0.75rem", fontWeight: 700, marginLeft: 8 } },
                fmtTime(editEntry.start_time) + " \u2013 " + fmtTime(editEntry.end_time))
            )
          ),
          React.createElement("button", { onClick: function() { setEditEntry(null) }, style: { background: "#f1f5f9", border: "none", cursor: "pointer", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", transition: "all 0.2s" } },
            React.createElement("i", { className: "bi bi-x-lg" }))
        ),
        
        editEntry.is_lab_slot && React.createElement("div", { className: "alert alert-primary py-2 px-3 mb-4", style: { fontSize: "0.8rem", border: "none", borderRadius: 10, background: "#eff6ff", color: "#1d4ed8" } },
          React.createElement("i", { className: "bi bi-info-circle-fill me-2" }),
          "This is a ", React.createElement("strong", null, "Lab Slot"), ". Changes will automatically apply to both hours of the block."
        ),

        React.createElement("form", { onSubmit: saveEdit },
          React.createElement("div", { className: "mb-3" },
            React.createElement("label", { className: "form-label fw-bold small text-secondary" }, "Subject"),
            React.createElement("input", {
              list: "editSubjectOptions",
              className: "form-control form-control-sm",
              placeholder: "Type or select subject",
              value: (subjects.find(s => s.id === editForm.subject) || {}).name || "",
              onChange: e => {
                const match = subjects.find(s => s.name === e.target.value || s.code === e.target.value)
                if (match) setEditForm(f => Object.assign({}, f, { subject: match.id }))
              }
            }),
            React.createElement("datalist", { id: "editSubjectOptions" },
              subjects.map(s => React.createElement("option", { key: s.id, value: s.name }, s.code))
            )
          ),
          
          React.createElement("div", { className: "mb-3" },
            React.createElement("label", { className: "form-label fw-bold small text-secondary" }, "Faculty"),
            React.createElement("input", {
              list: "editFacultyOptions",
              className: "form-control form-control-sm",
              placeholder: "Type or select faculty",
              value: (faculties.find(f => f.id === editForm.faculty) || {}).full_name || "",
              onChange: e => {
                const match = faculties.find(f => f.full_name === e.target.value)
                if (match) setEditForm(f => Object.assign({}, f, { faculty: match.id }))
              }
            }),
            React.createElement("datalist", { id: "editFacultyOptions" },
              faculties.map(f => {
                const isOcc = occupiedFids.includes(f.id) && f.id !== editEntry.faculty
                // In a perfect system, we'd fetch WHY they are occupied, but for now we label them.
                return React.createElement("option", { key: f.id, value: f.full_name }, isOcc ? "⚠️ Occupied elsewhere" : "Available")
              })
            ),
            occupiedFids.length > 0 && React.createElement("div", { style: { fontSize: "0.7rem", color: "#ef4444", marginTop: 4, fontWeight: 500 } },
              React.createElement("i", { className: "bi bi-exclamation-circle me-1" }),
              "Some faculty members are already assigned to other departments in this slot."
            )
          ),

          React.createElement("div", { className: "mb-4" },
            React.createElement("label", { className: "form-label fw-bold small text-secondary" }, "Classroom"),
            React.createElement("input", {
              list: "editRoomOptions",
              className: "form-control form-control-sm",
              placeholder: "Type or select classroom",
              value: (classrooms.find(c => c.id === editForm.classroom) || {}).name || "",
              onChange: e => {
                const match = classrooms.find(c => c.name === e.target.value)
                if (match) setEditForm(f => Object.assign({}, f, { classroom: match.id }))
              }
            }),
            React.createElement("datalist", { id: "editRoomOptions" },
              classrooms.map(c => React.createElement("option", { key: c.id, value: c.name }, c.is_lab ? "Lab" : "Theory"))
            )
          ),

          React.createElement("div", { style: { display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 } },
            React.createElement("button", { type: "button", onClick: function() { setEditEntry(null) }, className: "btn btn-light px-4", style: { borderRadius: 12, fontWeight: 600, fontSize: "0.9rem" } }, "Cancel"),
            React.createElement("button", { type: "submit", disabled: editSaving, className: "btn btn-primary px-4", style: { borderRadius: 12, fontWeight: 700, fontSize: "0.9rem", background: "linear-gradient(135deg, #1e293b, #334155)", border: "none" } },
              editSaving ? React.createElement("span", { className: "spinner-border spinner-border-sm me-2" }) : null,
              editSaving ? "Saving..." : "Apply Changes")
          )
        )
      )
    )

  )
}
