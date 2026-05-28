import { useEffect, useState } from "react";
import api, { getCompanies } from "../services/api";

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [newCompany, setNewCompany] = useState("");
  const [editCompany, setEditCompany] = useState("");

  // user create
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = currentUser?.role === "superadmin";

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();

      const visible = isSuperAdmin
        ? data
        : (data || []).filter((c) => c.status !== "deleted");

      setCompanies(visible || []);

      if (visible?.length > 0) {
        setSelectedCompany(visible[0]);
        setEditCompany(visible[0].name);
        loadUsers(visible[0].id);
      } else {
        setSelectedCompany(null);
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (companyId) => {
    try {
      const res = await api.get(`/companies/${companyId}/users`);
      setUsers(res.data || []);
    } catch {
      setUsers([]);
    }
  };

  const handleSelectCompany = (c) => {
    setSelectedCompany(c);
    setEditCompany(c.name);
    loadUsers(c.id);
  };

  // ================= COMPANY =================

  const handleCreateCompany = async () => {
    if (!newCompany) return;
    await api.post("/companies", { name: newCompany });
    setNewCompany("");
    loadCompanies();
  };

  const handleUpdateCompany = async () => {
    if (!selectedCompany || !editCompany) return;

    await api.put(`/companies/${selectedCompany.id}`, {
      name: editCompany,
    });

    loadCompanies();
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;
    if (!window.confirm("Delete company?")) return;

    await api.delete(`/companies/${selectedCompany.id}`);
    loadCompanies();
  };

  const handleRestoreCompany = async () => {
    if (!selectedCompany) return;

    await api.post(`/companies/${selectedCompany.id}/restore`);
    loadCompanies();
  };

  // ================= USER =================

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !selectedCompany) return;

    await api.post("/admin/users/create-with-company", {
      email: newUserEmail,
      password: newUserPassword,
      company_id: selectedCompany.id,
    });

    setNewUserEmail("");
    setNewUserPassword("");
    loadUsers(selectedCompany.id);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete user?")) return;

    await api.delete(`/admin/users/${userId}`);
    loadUsers(selectedCompany.id);
  };

  const handleResetPassword = async (userId) => {
    const newPass = prompt("New password:");
    if (!newPass) return;

    await api.post(`/admin/users/${userId}/reset-password`, {
      password: newPass,
    });

    alert("Password updated");
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* LEFT */}
        <div style={styles.left}>
          <div style={styles.title}>Companies</div>

          <div style={styles.companyList}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={{
                  ...styles.companyItem,
                  background:
                    selectedCompany?.id === c.id ? "#e0f2fe" : "#fff",
                }}
                onClick={() => handleSelectCompany(c)}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{c.name}</span>

                  {c.status === "deleted" && (
                    <span style={styles.deletedBadge}>DELETED</span>
                  )}
                </div>

                <div style={styles.meta}>
                  {c.user_count} users
                </div>
              </div>
            ))}
          </div>

          {isSuperAdmin && (
            <div>
              <input
                placeholder="New company..."
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                style={styles.input}
              />
              <button style={styles.primaryBtn} onClick={handleCreateCompany}>
                Create
              </button>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={styles.right}>
          {selectedCompany ? (
            <>
              <div style={styles.detailHeader}>
                <div>
                  <div style={styles.title}>{selectedCompany.name}</div>
                  <div style={styles.sub}>
                    Status: {selectedCompany.status}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div style={styles.actions}>
                    {selectedCompany.status !== "deleted" ? (
                      <button style={styles.dangerBtn} onClick={handleDeleteCompany}>
                        Delete
                      </button>
                    ) : (
                      <button style={styles.primaryBtn} onClick={handleRestoreCompany}>
                        Restore
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* EDIT */}
              {isSuperAdmin && selectedCompany.status !== "deleted" && (
                <div style={styles.editBox}>
                  <input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    style={styles.input}
                  />
                  <button style={styles.primaryBtn} onClick={handleUpdateCompany}>
                    Update
                  </button>
                </div>
              )}

              {/* USERS */}
              <div style={styles.sectionTitle}>Users</div>

              {isSuperAdmin && selectedCompany.status !== "deleted" && (
                <div style={styles.createUserBox}>
                  <input
                    placeholder="Email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    style={styles.input}
                  />
                  <input
                    placeholder="Password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    style={styles.input}
                  />
                  <button style={styles.primaryBtn} onClick={handleCreateUser}>
                    Create User
                  </button>
                </div>
              )}

              <div style={styles.userList}>
                {users.map((u) => (
                  <div key={u.user_id} style={styles.userItem}>
                    <div>
                      {u.email} ({u.role})
                    </div>

                    {isSuperAdmin && (
                      <div style={styles.actions}>
                        <button
                          style={styles.smallBtn}
                          onClick={() => handleResetPassword(u.user_id)}
                        >
                          Reset
                        </button>

                        <button
                          style={styles.dangerBtn}
                          onClick={() => handleDeleteUser(u.user_id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {users.length === 0 && (
                  <div style={styles.empty}>No users</div>
                )}
              </div>
            </>
          ) : (
            <div style={styles.empty}>No company</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: 20 },

  container: { display: "flex", gap: 20 },

  left: {
    width: 320,
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #eee",
  },

  right: {
    flex: 1,
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    border: "1px solid #eee",
  },

  title: { fontSize: 18, fontWeight: 700 },

  sub: { fontSize: 13, color: "#666" },

  companyItem: {
    padding: 10,
    border: "1px solid #eee",
    borderRadius: 8,
    marginBottom: 8,
    cursor: "pointer",
  },

  deletedBadge: {
    background: "#ccc",
    padding: "2px 6px",
    borderRadius: 6,
    fontSize: 11,
  },

  meta: { fontSize: 12, color: "#888" },

  input: {
    width: "100%",
    padding: 8,
    marginBottom: 6,
    borderRadius: 8,
    border: "1px solid #ddd",
  },

  primaryBtn: {
    width: "100%",
    padding: 8,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  dangerBtn: {
    padding: "6px 10px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },

  smallBtn: {
    padding: "6px 10px",
    background: "#666",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },

  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  editBox: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },

  createUserBox: {
    marginBottom: 12,
  },

  sectionTitle: {
    fontWeight: 600,
    marginBottom: 8,
  },

  userItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    borderBottom: "1px solid #eee",
  },

  actions: {
    display: "flex",
    gap: 6,
  },

  empty: {
    padding: 20,
    textAlign: "center",
    color: "#888",
  },
};