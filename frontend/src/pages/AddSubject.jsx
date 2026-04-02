import React, { useEffect, useState } from "react"
import api from "../api/axios"
import toast from "react-hot-toast"

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const empty = { name: "", code: "", department: "", semester: 1, is_lab: false }

export default function AddSubject() {
  const [form, setForm]               = useState(empty)
  const [subjects, setSubjects]       = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading]         = useState(false)
  const [filterDept, setFilterDept]   = useState("")
  const [filterSem, setFilterSem]     = useState("")
  const [fetching, setFetching]       = useState(false)

  useEffect(() => {
    api.get("/departments/").then(r => setDepartments(r.data))
  }, [])

  useEffect(() => {
    if (!filterDept || !filterSem) { setSubjects([]); return }
    setFetching(true)
    api.get("/subjects/?department=" + filterDept + "&semester=" + filterSem)
      .then(r => setSubjects(r.data))
      .catch(() => toast.error("Failed to load subjects"))
      .finally(() => setFetching(false))
  }, [filterDept, filterSem])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/subjects/", form)
      toast.success("Subject added")
      setForm(empty)
      if (String(form.department) === String(filterDept) && String(form.semester) === String(filterSem)) {
        api.get("/subjects/?department=" + filterDept + "&semester=" + filterSem).then(r => setSubjects(r.data))
      }
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.code && err.response.data.code[0]) || "Failed to add subject")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this subject?")) return
    await api.delete("/subjects/" + id + "/")
    toast.success("Deleted")
    setSubjects(s => s.filter(x => x.id !== id))
  }

  const selectedDeptName = (departments.find(d => String(d.id) === String(filterDept)) || {}).name || ""

  return (
    React.createElement(React.Fragment, null,
      React.createElement("div", { className: "page-header" },
        React.createElement("h4", { className: "mb-1" },
          React.createElement("i", { className: "bi bi-book me-2" }), "Add Subject"),
        React.createElement("p", { className: "text-muted mb-0" }, "Manage subjects for departments and semesters")
      ),
      React.createElement("div", { className: "row g-4" },
        React.createElement("div", { className: "col-md-4" },
          React.createElement("div", { className: "card" },
            React.createElement("div", { className: "card-header-ewc" },
              React.createElement("i", { className: "bi bi-plus-circle me-2" }), "New Subject"),
            React.createElement("div", { className: "card-body" },
              React.createElement("form", { onSubmit: handleSubmit },
                React.createElement("div", { className: "mb-3" },
                  React.createElement("label", { className: "form-label fw-semibold small" }, "Subject Name"),
                  React.createElement("input", { type: "text", className: "form-control form-control-sm", required: true, value: form.name, onChange: e => setForm(Object.assign({}, form, { name: e.target.value })) })
                ),
                React.createElement("div", { className: "mb-3" },
                  React.createElement("label", { className: "form-label fw-semibold small" }, "Subject Code"),
                  React.createElement("input", { type: "text", className: "form-control form-control-sm", required: true, value: form.code, onChange: e => setForm(Object.assign({}, form, { code: e.target.value })) })
                ),
                React.createElement("div", { className: "mb-3" },
                  React.createElement("label", { className: "form-label fw-semibold small" }, "Department"),
                  React.createElement("input", {
                    list: "deptOptions",
                    className: "form-control form-control-sm",
                    required: true,
                    placeholder: "Type or select department",
                    value: (departments.find(d => String(d.id) === String(form.department)) || {}).name || form.department,
                    onChange: e => {
                      const val = e.target.value
                      const match = departments.find(d => d.name === val)
                      setForm(Object.assign({}, form, { department: match ? match.id : val }))
                    }
                  }),
                  React.createElement("datalist", { id: "deptOptions" },
                    departments.map(d => React.createElement("option", { key: d.id, value: d.name }))
                  )
                ),
                React.createElement("div", { className: "mb-3" },
                  React.createElement("label", { className: "form-label fw-semibold small" }, "Semester"),
                  React.createElement("select", { className: "form-select form-select-sm", required: true, value: form.semester, onChange: e => setForm(Object.assign({}, form, { semester: e.target.value })) },
                    SEMESTERS.map(s => React.createElement("option", { key: s, value: s }, "Semester " + s))
                  )
                ),
                React.createElement("div", { className: "mb-3 form-check" },
                  React.createElement("input", { type: "checkbox", className: "form-check-input", id: "isLab", checked: form.is_lab, onChange: e => setForm(Object.assign({}, form, { is_lab: e.target.checked })) }),
                  React.createElement("label", { className: "form-check-label small", htmlFor: "isLab" }, "Lab Subject")
                ),
                React.createElement("button", { type: "submit", className: "btn btn-ewc btn-sm w-100", disabled: loading },
                  loading ? React.createElement("span", { className: "spinner-border spinner-border-sm me-1" }) : React.createElement("i", { className: "bi bi-save me-1" }),
                  "Save Subject"
                )
              )
            )
          )
        ),
        React.createElement("div", { className: "col-md-8" },
          React.createElement("div", { className: "card" },
            React.createElement("div", { className: "card-header-ewc" },
              React.createElement("i", { className: "bi bi-list-ul me-2" }),
              (filterDept && filterSem) ? (selectedDeptName + " \u2014 Semester " + filterSem + " (" + subjects.length + " subject" + (subjects.length !== 1 ? "s" : "") + ")") : "Subject List"
            ),
            React.createElement("div", { className: "card-body" },
              React.createElement("div", { className: "row g-3 mb-4" },
                React.createElement("div", { className: "col-sm-6" },
                  React.createElement("label", { className: "form-label fw-semibold small" }, "Department"),
                  React.createElement("input", {
                    list: "filterDeptOptions",
                    className: "form-control form-control-sm",
                    placeholder: "Type to select department",
                    value: (departments.find(d => String(d.id) === String(filterDept)) || {}).name || filterDept,
                    onChange: e => {
                      const val = e.target.value
                      const match = departments.find(d => d.name === val)
                      setFilterDept(match ? match.id : val); setFilterSem("")
                    }
                  }),
                  React.createElement("datalist", { id: "filterDeptOptions" },
                    departments.map(d => React.createElement("option", { key: d.id, value: d.name }))
                  )
                ),
                React.createElement("div", { className: "col-sm-6" },
                  React.createElement("label", { className: "form-label fw-semibold small" }, "Semester"),
                  React.createElement("select", { className: "form-select form-select-sm", value: filterSem, onChange: e => setFilterSem(e.target.value), disabled: !filterDept },
                    React.createElement("option", { value: "" }, filterDept ? "-- Select Semester --" : "-- Select department first --"),
                    SEMESTERS.map(s => React.createElement("option", { key: s, value: s }, "Semester " + s))
                  )
                )
              ),
              React.createElement("div", { className: "table-responsive" },
                React.createElement("table", { className: "table table-hover mb-0 small" },
                  React.createElement("thead", { className: "table-light" },
                    React.createElement("tr", null,
                      React.createElement("th", null, "Code"),
                      React.createElement("th", null, "Name"),
                      React.createElement("th", null, "Sem"),
                      React.createElement("th", null, "Type"),
                      React.createElement("th", null)
                    )
                  ),
                  React.createElement("tbody", null,
                    (!filterDept || !filterSem) && React.createElement("tr", null,
                      React.createElement("td", { colSpan: 5, className: "text-center text-muted py-5" },
                        React.createElement("i", { className: "bi bi-funnel", style: { fontSize: "1.8rem", display: "block", marginBottom: 8, opacity: 0.4 } }),
                        "Please select a Department and Semester to view subjects"
                      )
                    ),
                    filterDept && filterSem && fetching && React.createElement("tr", null,
                      React.createElement("td", { colSpan: 5, className: "text-center text-muted py-4" },
                        React.createElement("span", { className: "spinner-border spinner-border-sm me-2" }), "Loading..."
                      )
                    ),
                    filterDept && filterSem && !fetching && subjects.length === 0 && React.createElement("tr", null,
                      React.createElement("td", { colSpan: 5, className: "text-center text-muted py-5" },
                        React.createElement("i", { className: "bi bi-inbox", style: { fontSize: "1.8rem", display: "block", marginBottom: 8, opacity: 0.4 } }),
                        "No subjects found for " + selectedDeptName + ", Semester " + filterSem
                      )
                    ),
                    filterDept && filterSem && !fetching && subjects.map(s =>
                      React.createElement("tr", { key: s.id },
                        React.createElement("td", null, React.createElement("span", { className: "badge", style: { background: "#1a237e" } }, s.code)),
                        React.createElement("td", null, s.name),
                        React.createElement("td", null, "Sem " + s.semester),
                        React.createElement("td", null,
                          s.is_lab
                            ? React.createElement("span", { className: "badge bg-warning text-dark" }, "Lab")
                            : React.createElement("span", { className: "badge bg-success" }, "Theory")
                        ),
                        React.createElement("td", null,
                          React.createElement("button", { className: "btn btn-outline-danger btn-sm py-0", onClick: () => handleDelete(s.id) },
                            React.createElement("i", { className: "bi bi-trash" })
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )
}