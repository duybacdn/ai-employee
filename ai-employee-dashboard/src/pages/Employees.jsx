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
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();

    getCompanies().then((data) => {
      setCompanies(Array.isArray(data) ? data : []);
    });
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
        company_id: form.company_id, // 🔥 FIX: giữ UUID string
      };

      if (editing) {
        await updateEmployee(editing.id, payload);
      } else {
        await createEmployee(payload);
      }

      setShowModal(false);
      setEditing(null);

      await loadEmployees();
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

      await loadEmployees();
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
      await loadEmployees();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  // =========================
  // UI
  // =========================
/* ================= UI ================= */
  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={{ marginBottom: 4 }}>AI Employees</h2>
          <div style={styles.subText}>
            Manage AI agents & behavior
          </div>
        </div>

        <button
          style={styles.primaryBtn}
          onClick={openCreate}
          disabled={loading}
        >
          + Create AI
        </button>
      </div>

      {loading && <p>Loading...</p>}

      {/* GRID */}
      <div style={styles.grid}>
        {employees.map((e) => (
          <div key={e.id} style={styles.card}>
            <div style={styles.row}>
              <div>
                <div style={styles.name}>{e.name}</div>
                <div style={styles.company}>
                  {e.company_name}
                </div>
              </div>

              <span style={styles.badge(e.is_active)}>
                {e.is_active ? "Active" : "Off"}
              </span>
            </div>

            <div style={styles.actions}>
              <button
                style={styles.btn}
                onClick={() => openEdit(e)}
                disabled={!e.is_active}
              >
                Edit
              </button>

              <button
                style={styles.warningBtn}
                onClick={() => toggleActive(e)}
              >
                {e.is_active ? "Disable" : "Enable"}
              </button>

              <button
                style={styles.dangerBtn}
                onClick={() => handleDelete(e)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={styles.modalBg}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3>{editing ? "Edit AI" : "Create AI"}</h3>
            </div>

            <div style={styles.form}>
              <select
                value={form.company_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    company_id: e.target.value,
                  })
                }
                style={styles.input}
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
                style={styles.input}
              />

              <textarea
                placeholder="System Prompt (AI behavior...)"
                value={form.system_prompt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    system_prompt: e.target.value,
                  })
                }
                style={styles.textarea}
              />

              <textarea
                placeholder="Style Prompt (tone, personality...)"
                value={form.style_prompt}
                onChange={(e) =>
                  setForm({
                    ...form,
                    style_prompt: e.target.value,
                  })
                }
                style={styles.textarea}
              />
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.ghostBtn}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>

              <button
                style={styles.primaryBtn}
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
/* ================= STYLE ================= */

const styles = {
  page: {
    padding: 20,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  subText: {
    fontSize: 13,
    color: "#666",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 18,
  },

  card: {
    background: "#fff",
    padding: 16,
    borderRadius: 14,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    transition: "all 0.2s ease",
  },

  name: {
    fontWeight: 600,
    fontSize: 15,
  },

  company: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  actions: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  btn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
  },

  primaryBtn: {
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    color: "#fff",
    border: "none",
    padding: "9px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
  },

  warningBtn: {
    background: "#f59e0b",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },

  dangerBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },

  ghostBtn: {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
  },

  badge: (active) => ({
    background: active ? "#dcfce7" : "#eee",
    color: active ? "#166534" : "#555",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  }),

  modalBg: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },

  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "90%",
    maxWidth: 520,
    padding: 20,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },

  modalHeader: {
    marginBottom: 12,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  modalFooter: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },

  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
  },

  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    minHeight: 100,
    fontSize: 13,
    resize: "vertical",
  },
};