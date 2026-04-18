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
  const [loading, setLoading] = useState(false);

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
    try {
      setLoading(true);
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    getCompanies().then(setCompanies);
  }, []);

  // =========================
  // OPEN CREATE
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
  // OPEN EDIT
  // =========================
  const openEdit = (e) => {
    setEditing(e);

    setForm({
      company_id: e.company_id || "",
      name: e.name || "",
      system_prompt: e.system_prompt || "",
      style_prompt: e.style_prompt || "",
    });

    setShowModal(true);
  };

  // =========================
  // SAVE (CREATE / UPDATE)
  // =========================
  const handleSubmit = async () => {
    if (!form.name || !form.company_id) {
      alert("Missing name or company");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...form,
        company_id: Number(form.company_id),
      };

      if (editing) {
        await updateEmployee(editing.id, payload);
      } else {
        await createEmployee(payload);
      }

      setShowModal(false);
      loadEmployees();
    } catch (err) {
      console.error("Save error:", err);
      alert("Save failed");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // TOGGLE ACTIVE
  // =========================
  const toggleActive = async (e) => {
    try {
      await updateEmployee(e.id, {
        ...e,
        is_active: !e.is_active,
      });

      loadEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // DELETE
  // =========================
  const handleDelete = async (e) => {
    const ok = window.confirm(`Delete ${e.name}?`);
    if (!ok) return;

    try {
      await deleteEmployee(e.id);
      loadEmployees();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={page}>
      <div style={header}>
        <h2>AI Employees</h2>

        <button
          style={primaryBtn}
          onClick={openCreate}
          disabled={loading}
        >
          + Create AI
        </button>
      </div>

      {loading && <p>Loading...</p>}

      <div style={grid}>
        {employees.map((e) => (
          <div key={e.id} style={card}>
            <div style={row}>
              <h3>{e.name}</h3>
              <span style={badge(e.is_active)}>
                {e.is_active ? "Active" : "Off"}
              </span>
            </div>

            <p><b>Company:</b> {e.company_name}</p>

            <div style={actions}>
              <button
                onClick={() => openEdit(e)}
                disabled={!e.is_active}
              >
                Edit
              </button>

              <button onClick={() => toggleActive(e)}>
                {e.is_active ? "Disable" : "Enable"}
              </button>

              <button onClick={() => handleDelete(e)}>
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
                  company_id: e.target.value,
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

              <button
                style={primaryBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
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