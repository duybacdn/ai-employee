import { useEffect, useState } from "react";
import api, { getUsers, getCompanies } from "../services/api";

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);

  const [selectedCompany, setSelectedCompany] = useState(null);

  const [loading, setLoading] = useState(true);

  const [newCompany, setNewCompany] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = currentUser?.role === "superadmin";

  // ================= LOAD =================
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();
      setCompanies(data || []);

      if (data?.length > 0) {
        setSelectedCompany(data[0]);
        loadUsersByCompany(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUsersByCompany = async (companyId) => {
    try {
      const data = await getUsers();
      const filtered = (data || []).filter((u) =>
        (u.companies || []).includes(
          companies.find((c) => c.id === companyId)?.name
        )
      );
      setUsers(filtered);
    } catch {
      setUsers([]);
    }
  };

  // ================= SELECT =================
  const handleSelectCompany = (c) => {
    setSelectedCompany(c);
    setEditCompany(c.name);
    loadUsersByCompany(c.id);
  };

  // ================= CREATE =================
  const handleCreateCompany = async () => {
    if (!newCompany) return;

    await api.post("/companies", { name: newCompany });
    setNewCompany("");
    loadCompanies();
  };

  // ================= UPDATE =================
  const handleUpdateCompany = async () => {
    if (!selectedCompany || !editCompany) return;

    await api.put(`/companies/${selectedCompany.id}`, {
      name: editCompany,
    });

    loadCompanies();
  };

  // ================= DELETE =================
  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;

    if (!window.confirm("Delete company?")) return;

    await api.delete(`/companies/${selectedCompany.id}`);
    setSelectedCompany(null);
    setUsers([]);
    loadCompanies();
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* LEFT: COMPANY LIST */}
        <div style={styles.left}>
          <div style={styles.sectionTitle}>Companies</div>

          <div style={styles.companyList}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={{
                  ...styles.companyItem,
                  background:
                    selectedCompany?.id === c.id
                      ? "#e0f2fe"
                      : "#fff",
                }}
                onClick={() => handleSelectCompany(c)}
              >
                {c.name}
              </div>
            ))}
          </div>

          {isSuperAdmin && (
            <>
              <input
                placeholder="New company..."
                value={newCompany}
                onChange={(e) =>
                  setNewCompany(e.target.value)
                }
                style={styles.input}
              />

              <button
                style={styles.primaryBtn}
                onClick={handleCreateCompany}
              >
                Add Company
              </button>
            </>
          )}
        </div>

        {/* RIGHT: DETAIL */}
        <div style={styles.right}>
          {selectedCompany ? (
            <>
              <div style={styles.sectionTitle}>
                {selectedCompany.name}
              </div>

              {isSuperAdmin && (
                <div style={styles.editBox}>
                  <input
                    value={editCompany}
                    onChange={(e) =>
                      setEditCompany(e.target.value)
                    }
                    style={styles.input}
                  />

                  <div style={styles.actions}>
                    <button
                      style={styles.primaryBtn}
                      onClick={handleUpdateCompany}
                    >
                      Update
                    </button>

                    <button
                      style={styles.dangerBtn}
                      onClick={handleDeleteCompany}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              <div style={styles.userList}>
                {users.map((u) => (
                  <div key={u.id} style={styles.userItem}>
                    {u.email} - {u.role}
                  </div>
                ))}

                {users.length === 0 && (
                  <div style={styles.empty}>
                    No users in this company
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={styles.empty}>
              Select a company
            </div>
          )}
        </div>
      </div>
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

  container: {
    display: "flex",
    gap: 20,
  },

  left: {
    width: 300,
    background: "#fff",
    padding: 16,
    borderRadius: 16,
    border: "1px solid #eee",
  },

  right: {
    flex: 1,
    background: "#fff",
    padding: 16,
    borderRadius: 16,
    border: "1px solid #eee",
  },

  sectionTitle: {
    fontWeight: 700,
    marginBottom: 12,
  },

  companyList: {
    marginBottom: 12,
  },

  companyItem: {
    padding: 10,
    borderRadius: 10,
    cursor: "pointer",
    marginBottom: 6,
    border: "1px solid #eee",
  },

  input: {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ddd",
    marginBottom: 10,
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
    padding: 10,
    borderRadius: 10,
    background: "#ef4444",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  },

  actions: {
    display: "flex",
    gap: 10,
  },

  editBox: {
    marginBottom: 16,
  },

  userList: {
    marginTop: 10,
  },

  userItem: {
    padding: 10,
    borderBottom: "1px solid #eee",
  },

  empty: {
    padding: 20,
    textAlign: "center",
    color: "#888",
  },
};