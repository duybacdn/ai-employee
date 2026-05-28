import { useEffect, useState } from "react";
import api, { getCompanies } from "../services/api";

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [newCompany, setNewCompany] = useState("");
  const [editCompany, setEditCompany] = useState("");

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

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* LEFT */}
        <div style={styles.left}>
          <div style={styles.header}>
            <div style={styles.title}>Companies</div>
          </div>

          <div style={styles.companyList}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={{
                  ...styles.companyItem,
                  background:
                    selectedCompany?.id === c.id ? "#e0f2fe" : "#fff",
                  opacity: c.status === "deleted" ? 0.5 : 1,
                }}
                onClick={() => handleSelectCompany(c)}
              >
                <div>{c.name}</div>
                <div style={styles.meta}>
                  {c.user_count} users
                </div>
              </div>
            ))}
          </div>

          {isSuperAdmin && (
            <div style={styles.createBox}>
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
                  <div style={styles.title}>
                    {selectedCompany.name}
                  </div>
                  <div style={styles.sub}>
                    Status: {selectedCompany.status}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div style={styles.actions}>
                    {selectedCompany.status !== "deleted" ? (
                      <button
                        style={styles.dangerBtn}
                        onClick={handleDeleteCompany}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        style={styles.primaryBtn}
                        onClick={handleRestoreCompany}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isSuperAdmin && selectedCompany.status !== "deleted" && (
                <div style={styles.editBox}>
                  <input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    style={styles.input}
                  />

                  <button
                    style={styles.primaryBtn}
                    onClick={handleUpdateCompany}
                  >
                    Update
                  </button>
                </div>
              )}

              <div style={styles.userSection}>
                <div style={styles.sectionTitle}>Users</div>

                <div style={styles.userList}>
                  {users.map((u) => (
                    <div key={u.user_id} style={styles.userItem}>
                      <div>{u.email}</div>
                      <div style={styles.role}>{u.role}</div>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div style={styles.empty}>
                      No users in this company
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={styles.empty}>No company selected</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: 20 },

  loading: { padding: 20 },

  container: {
    display: "flex",
    gap: 20,
  },

  left: {
    width: 320,
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    border: "1px solid #eee",
  },

  right: {
    flex: 1,
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #eee",
  },

  header: {
    marginBottom: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: 700,
  },

  sub: {
    color: "#666",
    fontSize: 13,
    marginTop: 4,
  },

  companyList: {
    marginTop: 10,
    marginBottom: 12,
  },

  companyItem: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid #eee",
    marginBottom: 8,
    cursor: "pointer",
  },

  meta: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },

  createBox: {
    marginTop: 10,
  },

  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    marginBottom: 8,
  },

  primaryBtn: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    background: "#2563eb",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },

  dangerBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    background: "#ef4444",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },

  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  editBox: {
    display: "flex",
    gap: 10,
    marginBottom: 16,
  },

  actions: {
    display: "flex",
    gap: 10,
  },

  userSection: {
    marginTop: 10,
  },

  sectionTitle: {
    fontWeight: 600,
    marginBottom: 10,
  },

  userList: {
    borderTop: "1px solid #eee",
  },

  userItem: {
    padding: 10,
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
  },

  role: {
    fontSize: 12,
    color: "#666",
  },

  empty: {
    padding: 20,
    textAlign: "center",
    color: "#888",
  },
};