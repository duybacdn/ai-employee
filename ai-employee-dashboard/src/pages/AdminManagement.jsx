import { useEffect, useState } from "react";
import {
  getUsers,
} from "../services/api";

import api from "../services/api";

export default function AdminManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    company_name: "",
    role: "admin",
  });

  // =========================
  // LOAD USERS
  // =========================
  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data || []);
    } catch (err) {
      alert("Load users failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // =========================
  // CREATE USER + COMPANY
  // =========================
  const handleCreate = async () => {
    if (!form.email || !form.password || !form.company_name) {
      return alert("Nhập đầy đủ thông tin");
    }

    try {
      await api.post("/admin/users/create-with-company", form);

      setForm({
        email: "",
        password: "",
        company_name: "",
        role: "admin",
      });

      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Create failed");
    }
  };

  // =========================
  // RESET PASSWORD
  // =========================
  const handleReset = async (id) => {
    if (!window.confirm("Reset password về 123456?")) return;

    await api.post(`/admin/users/${id}/reset-password`);
    alert("Đã reset về 123456");
  };

  // =========================
  // DELETE USER
  // =========================
  const handleDelete = async (user) => {
    if (user.is_superadmin) {
      return alert("Không được xoá superadmin");
    }

    if (!window.confirm("Xoá user này?")) return;

    try {
      await api.delete(`/admin/users/${user.id}`);
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "Delete failed");
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={container}>
      <h2>Admin Management</h2>

      {/* CREATE FORM */}
      <div style={formBox}>
        <h3>Tạo khách hàng (User + Company)</h3>

        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <input
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <input
          placeholder="Company Name"
          value={form.company_name}
          onChange={(e) => setForm({ ...form, company_name: e.target.value })}
        />

        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="viewer">Viewer</option>
        </select>

        <button onClick={handleCreate}>Create</button>
      </div>

      {/* USERS TABLE */}
      <div style={{ marginTop: 30 }}>
        <h3>Users</h3>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Companies</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.email}
                    {u.is_superadmin && (
                      <span style={badge}>SUPERADMIN</span>
                    )}
                  </td>

                  <td>{u.role}</td>

                  <td>
                    {(u.companies || []).map((c, i) => (
                      <div key={i}>{c}</div>
                    ))}
                  </td>

                  <td>
                    <button onClick={() => handleReset(u.id)}>
                      Reset
                    </button>

                    {!u.is_superadmin && (
                      <button onClick={() => handleDelete(u)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* =========================
   STYLE
========================= */
const container = {
  padding: 20,
};

const formBox = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  maxWidth: 400,
  padding: 15,
  border: "1px solid #ddd",
  borderRadius: 10,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const badge = {
  marginLeft: 10,
  background: "red",
  color: "#fff",
  padding: "2px 6px",
  fontSize: 12,
};