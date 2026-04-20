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
    <div>
      <h2>Admin Management</h2>

      {/* CREATE BUTTON */}
      {isSuperAdmin && (
        <button onClick={handleCreate} style={{ marginBottom: 20 }}>
          + Create User & Company
        </button>
      )}

      {/* TABLE */}
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
          {users.map((u) => {
            const isSelf = u.id === currentUser.id;

            return (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{(u.companies || []).join(", ")}</td>

                <td>
                  <button onClick={() => handleChangePassword(u.id)}>
                    Change Password
                  </button>

                  {/* chỉ superadmin mới delete */}
                  {isSuperAdmin && !u.is_superadmin && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{ marginLeft: 10 }}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* styles */
const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const thtd = {
  border: "1px solid #ddd",
  padding: 8,
};