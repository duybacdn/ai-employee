import { useEffect, useState } from "react";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  getCompanies,
  deleteEmployee,
} from "../services/api";

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    company_id: "",
    name: "",
    system_prompt: "",
    style_prompt: "",
  });

  // =========================
  // LOAD
  // =========================
  const loadEmployees = async () => {
    const data = await getEmployees();
    setEmployees(data);
  };

  useEffect(() => {
    loadEmployees();
    getCompanies().then(setCompanies);
  }, []);

  // =========================
  // CREATE
  // =========================
  const openCreate = () => {
    setEditing(null);
    setForm({
      company_id: "",
      name: "",
      system_prompt: "",
      style_prompt: "",
    });
    setShowModal(true);
  };

  // =========================
  // EDIT
  // =========================
  const openEdit = (e) => {
    setEditing(e);

    setForm({
      company_id: e.company_id,
      name: e.name,
      system_prompt: e.system_prompt || "",
      style_prompt: e.style_prompt || "",
    });

    setShowModal(true);
  };

  // =========================
  // SAVE
  // =========================
  const handleSubmit = async () => {
    if (!form.name || !form.company_id) {
      alert("Missing name or company");
      return;
    }

    if (editing) {
      await updateEmployee(editing.id, form);
    } else {
      await createEmployee(form);
    }

    setShowModal(false);
    loadEmployees();
  };

  // =========================
  // TOGGLE ACTIVE
  // =========================
  const toggleActive = async (e) => {
    await updateEmployee(e.id, {
      ...e,
      is_active: !e.is_active,
    });
    loadEmployees();
  };

  // =========================
  // TOGGLE DELETE
  // =========================
  const handleDelete = async (e) => {
    const ok = window.confirm(`Delete ${e.name}?`);

    if (!ok) return;

    await deleteEmployee(e.id);
    loadEmployees();
    };

  return (
  <div style={page}>
    {/* HEADER */}
    <div style={header}>
      <h2>AI Employees</h2>
      <button style={primaryBtn} onClick={openCreate}>
        + Create AI
      </button>
    </div>

    {/* LIST */}
    <div style={grid}>
      {employees.map((e) => (
        <div key={e.id} style={card}>
          <div style={row}>
            <h3>{e.name}</h3>
            <span style={badge(e.is_active)}>
              {e.is_active ? "Active" : "Off"}
            </span>
          </div>

          <p>
            <b>Company:</b> {e.company_name}
          </p>

          <div style={actions}>
            {/* EDIT */}
            <button
              onClick={() => openEdit(e)}
              disabled={!e.is_active}
              style={{
                opacity: e.is_active ? 1 : 0.4,
                cursor: e.is_active ? "pointer" : "not-allowed",
              }}
            >
              Edit
            </button>

            {/* TOGGLE */}
            <button onClick={() => toggleActive(e)}>
              {e.is_active ? "Disable" : "Enable"}
            </button>

            {/* DELETE */}
            <button
              onClick={() => handleDelete(e)}
              style={{
                background: "#ff4d4f",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>

    {/* MODAL */}
    {showModal && (
      <div style={modalBg}>
        <div style={modal}>
          <h3>{editing ? "Edit AI" : "Create AI"}</h3>

          <select
            value={form.company_id}
            onChange={(e) =>
              setForm({
                ...form,
                company_id: e.target.value || null,
              })
            }
            style={input}
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            placeholder="AI Name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            style={input}
          />

          <textarea
            placeholder="System Prompt"
            value={form.system_prompt}
            onChange={(e) =>
              setForm({
                ...form,
                system_prompt: e.target.value,
              })
            }
            style={textarea}
          />

          <textarea
            placeholder="Style Prompt"
            value={form.style_prompt}
            onChange={(e) =>
              setForm({
                ...form,
                style_prompt: e.target.value,
              })
            }
            style={textarea}
          />

          <div style={actions}>
            <button onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button style={primaryBtn} onClick={handleSubmit}>
              Save
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}

const page = { padding: 20 };

const header = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 20,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 16,
};

const card = {
  background: "#fff",
  padding: 16,
  borderRadius: 10,
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const sub = {
  color: "#666",
  fontSize: 14,
  marginTop: 8,
};

const actions = {
  marginTop: 12,
  display: "flex",
  gap: 8,
};

const primaryBtn = {
  background: "#111",
  color: "#fff",
  padding: "8px 14px",
  borderRadius: 6,
  border: "none",
};

const badge = (active) => ({
  background: active ? "#d4f8e8" : "#eee",
  padding: "4px 8px",
  borderRadius: 6,
  fontSize: 12,
});

const modalBg = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modal = {
  background: "#fff",
  padding: 20,
  borderRadius: 10,
  width: "90%",
  maxWidth: 400,
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  boxSizing: "border-box", // 🔥 FIX TRÀN
  borderRadius: 6,
  border: "1px solid #ddd",
};

const textarea = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  minHeight: 80,
  boxSizing: "border-box", // 🔥 FIX
  borderRadius: 6,
  border: "1px solid #ddd",
};