import { useEffect, useState } from "react";
import {
  getUsers,
} from "../services/api";
import api from "../services/api";

export default function AdminManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = currentUser?.role === "superadmin";

  // =========================
  // LOAD USERS
  // =========================
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data || []);
    } catch (err) {
      alert("Load users failed");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // CREATE USER + COMPANY
  // =========================
  const handleCreate = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    const company = prompt("Company name:");

    if (!email || !password || !company) return;

    try {
      await api.post("/admin/users/create-with-company", {
        email,
        password,
        company_name: company,
        role: "admin",
      });

      alert("Created!");
      loadUsers();
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
  };

  // =========================
  // DELETE USER
  // =========================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      await api.delete(`/admin/users/${id}`);
      loadUsers();
    } catch (err) {
      alert("Delete failed");
    }
  };

  // =========================
  // CHANGE PASSWORD
  // =========================
  const handleChangePassword = async (id) => {
    const newPassword = prompt("New password:");
    if (!newPassword) return;

    try {
      await api.post(`/admin/users/${id}/reset-password`, {
        password: newPassword,
      });

      alert("Password updated");
    } catch (err) {
      alert("Error");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={{ marginBottom: 4 }}>User Management</h2>
          <div style={styles.subText}>
            Manage users, roles and companies
          </div>
        </div>

        {isSuperAdmin && (
          <button style={styles.primaryBtn} onClick={handleCreate}>
            + Create User & Company
          </button>
        )}
      </div>

      {/* TABLE CARD */}
      <div style={styles.card}>
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
            {users.map((u) => {
              const isSelf = u.id === currentUser.id;

              return (
                <tr key={u.id} style={styles.tr}>
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
                        style={styles.btn}
                        onClick={() => handleChangePassword(u.id)}
                      >
                        Change Password
                      </button>

                      {isSuperAdmin && !u.is_superadmin && (
                        <button
                          style={styles.dangerBtn}
                          onClick={() => handleDelete(u.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={styles.empty}>
            No users found
          </div>
        )}
      </div>
    </div>
  );
}

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

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 600,
  },

  th: {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    color: "#666",
    borderBottom: "1px solid #eee",
  },

  td: {
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 14,
  },

  tr: {
    transition: "background 0.15s",
  },

  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  btn: {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
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

  dangerBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
  },

  roleBadge: (role) => ({
    padding: "4px 10px",
    borderRadius: 20,
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
        : "#555",
  }),

  empty: {
    textAlign: "center",
    padding: 20,
    color: "#888",
    fontSize: 14,
  },
};