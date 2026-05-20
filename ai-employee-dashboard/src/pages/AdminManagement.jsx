import { useEffect, useState } from "react";
import {
  getUsers,
  getCompanies,
} from "../services/api";
import api from "../services/api";

export default function AdminManagement() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    company_id: "",
    role: "admin",
  });

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = currentUser?.role === "superadmin";

  // ================= LOAD =================
  useEffect(() => {
    loadUsers();
    loadCompanies();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data || []);
    } catch {
      alert("Load users failed");
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();
      setCompanies(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // ================= CREATE =================
  const handleCreate = async () => {
    if (!form.email || !form.password || !form.company_id) {
      return alert("Please fill all fields");
    }

    try {
      await api.post("/admin/users/create-with-company", {
        email: form.email,
        password: form.password,
        company_id: form.company_id,
        role: form.role,
      });

      alert("Created!");

      setShowModal(false);

      setForm({
        email: "",
        password: "",
        company_id: "",
        role: "admin",
      });

      loadUsers();
    } catch (err) {
      alert(
        "Error: " +
          (err.response?.data?.detail || err.message)
      );
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      await api.delete(`/admin/users/${id}`);
      loadUsers();
    } catch {
      alert("Delete failed");
    }
  };

  // ================= PASSWORD =================
  const handleChangePassword = async (id) => {
    const newPassword = prompt("New password:");
    if (!newPassword) return;

    try {
      await api.post(`/admin/users/${id}/reset-password`, {
        password: newPassword,
      });

      alert("Password updated");
    } catch {
      alert("Error");
    }
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>User Management</h2>
          <div style={styles.sub}>
            Manage users and company access
          </div>
        </div>

        {isSuperAdmin && (
          <button
            style={styles.primaryBtn}
            onClick={() => setShowModal(true)}
          >
            + Create User
          </button>
        )}
      </div>

      {/* TABLE */}
      <div style={styles.card}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Companies</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={styles.td}>{u.email}</td>

                  <td style={styles.td}>
                    <span style={styles.roleBadge(u.role)}>
                      {u.role}
                    </span>
                  </td>

                  <td style={styles.td}>
                    {(u.companies || []).join(", ") || "-"}
                  </td>

                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button
                        style={styles.secondaryBtn}
                        onClick={() =>
                          handleChangePassword(u.id)
                        }
                      >
                        Password
                      </button>

                      {isSuperAdmin &&
                        !u.is_superadmin && (
                          <button
                            style={styles.dangerBtn}
                            onClick={() =>
                              handleDelete(u.id)
                            }
                          >
                            Delete
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div style={styles.empty}>
              No users found
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={styles.modalBg}>
          <div style={styles.modal}>

            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>
                  Create User
                </div>

                <div style={styles.modalSub}>
                  Create new admin account
                </div>
              </div>

              <button
                style={styles.closeBtn}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.form}>
              <input
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
                style={styles.input}
              />

              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                style={styles.input}
              />

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
                <option value="">
                  Select Company
                </option>

                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value,
                  })
                }
                style={styles.input}
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.ghostBtn}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>

              <button
                style={styles.primaryBtn}
                onClick={handleCreate}
              >
                Create User
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: 20,
  },

  loading: {
    padding: 20,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
    flexWrap: "wrap",
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
  },

  sub: {
    color: "#666",
    marginTop: 4,
    fontSize: 14,
  },

  card: {
    background: "#fff",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 700,
  },

  th: {
    textAlign: "left",
    padding: 14,
    fontSize: 13,
    color: "#666",
    borderBottom: "1px solid #eee",
  },

  td: {
    padding: 14,
    borderBottom: "1px solid #f3f4f6",
    fontSize: 14,
  },

  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ddd",
    fontSize: 14,
    boxSizing: "border-box",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 20,
  },

  primaryBtn: {
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
  },

  secondaryBtn: {
    border: "1px solid #ddd",
    background: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
  },

  ghostBtn: {
    border: "1px solid #ddd",
    background: "#fff",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
  },

  dangerBtn: {
    border: "none",
    background: "#ef4444",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
  },

  roleBadge: (role) => ({
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background:
      role === "superadmin"
        ? "#fee2e2"
        : role === "admin"
        ? "#dbeafe"
        : "#eee",
    color:
      role === "superadmin"
        ? "#991b1b"
        : role === "admin"
        ? "#1d4ed8"
        : "#444",
  }),

  empty: {
    padding: 30,
    textAlign: "center",
    color: "#888",
  },

  modalBg: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 20,
  },

  modal: {
    width: "100%",
    maxWidth: 500,
    background: "#fff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: 700,
  },

  modalSub: {
    color: "#666",
    marginTop: 4,
    fontSize: 14,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 24,
  },

  closeBtn: {
    border: "none",
    background: "transparent",
    fontSize: 18,
    cursor: "pointer",
  },
};