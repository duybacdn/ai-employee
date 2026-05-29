import { useEffect, useState } from "react";
import api, { getCompanies } from "../services/api";

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [newCompany, setNewCompany] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showDetail, setShowDetail] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = currentUser?.role === "superadmin";

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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

    if (isMobile) setShowDetail(true);
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

  if (loading) return <div style={center}>Loading...</div>;

  return (
    <div style={container}>
      {/* LEFT */}
      {(!isMobile || !showDetail) && (
        <div style={leftPane}>
          <div style={sidebarHeader}>Companies</div>

          <div style={companyList}>
            {companies.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelectCompany(c)}
                style={{
                  ...companyItem,
                  background:
                    selectedCompany?.id === c.id ? "#eff6ff" : "#fff",
                }}
              >
                <div style={rowBetween}>
                  <span>{c.name}</span>
                  {c.status === "deleted" && (
                    <span style={badge}>DELETED</span>
                  )}
                </div>

                <div style={meta}>{c.user_count} users</div>
              </div>
            ))}
          </div>

          {isSuperAdmin && (
            <div style={createBox}>
              <input
                placeholder="New company..."
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                style={input}
              />
              <button style={primaryBtn} onClick={handleCreateCompany}>
                Create
              </button>
            </div>
          )}
        </div>
      )}

      {/* RIGHT */}
      {(!isMobile || showDetail) && (
        <div style={rightPane}>
          {isMobile && (
            <div style={mobileHeader}>
              <div onClick={() => setShowDetail(false)}>←</div>
              <b>{selectedCompany?.name || "Company"}</b>
            </div>
          )}

          {!selectedCompany ? (
            <div style={center}>No company selected</div>
          ) : (
            <>
              {/* HEADER */}
              <div style={header}>
                <div>
                  <div style={title}>{selectedCompany.name}</div>
                  <div style={sub}>
                    Status: {selectedCompany.status}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div style={actions}>
                    {selectedCompany.status !== "deleted" ? (
                      <button
                        style={dangerBtn}
                        onClick={handleDeleteCompany}
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        style={primaryBtn}
                        onClick={handleRestoreCompany}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* EDIT */}
              {isSuperAdmin && selectedCompany.status !== "deleted" && (
                <div style={card}>
                  <div style={sectionTitle}>Edit Company</div>
                  <div style={row}>
                    <input
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      style={input}
                    />
                    <button
                      style={primaryBtn}
                      onClick={handleUpdateCompany}
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}

              {/* USERS */}
              <div style={card}>
                <div style={sectionTitle}>Users</div>

                {isSuperAdmin &&
                  selectedCompany.status !== "deleted" && (
                    <div style={row}>
                      <input
                        placeholder="Email"
                        value={newUserEmail}
                        onChange={(e) =>
                          setNewUserEmail(e.target.value)
                        }
                        style={input}
                      />
                      <input
                        placeholder="Password"
                        value={newUserPassword}
                        onChange={(e) =>
                          setNewUserPassword(e.target.value)
                        }
                        style={input}
                      />
                      <button
                        style={primaryBtn}
                        onClick={handleCreateUser}
                      >
                        Create
                      </button>
                    </div>
                  )}

                <div style={userList}>
                  {users.map((u) => (
                    <div key={u.user_id} style={userItem}>
                      <div>
                        {u.email} ({u.role})
                      </div>

                      {isSuperAdmin && (
                        <div style={actions}>
                          <button
                            style={smallBtn}
                            onClick={() =>
                              handleResetPassword(u.user_id)
                            }
                          >
                            Reset
                          </button>

                          <button
                            style={dangerBtn}
                            onClick={() =>
                              handleDeleteUser(u.user_id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div style={empty}>No users</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= STYLE ================= */

const container = {
  display: "flex",
  height: "100vh",
  background: "#f9fafb",
};

const leftPane = {
  width: 320,
  borderRight: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
};

const sidebarHeader = {
  padding: 12,
  fontWeight: 600,
  borderBottom: "1px solid #eee",
};

const companyList = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
};

const companyItem = {
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 8,
  marginBottom: 8,
  cursor: "pointer",
  fontSize: 13,
};

const badge = {
  fontSize: 11,
  background: "#e5e7eb",
  padding: "2px 6px",
  borderRadius: 6,
};

const meta = {
  fontSize: 12,
  color: "#888",
  marginTop: 4,
};

const createBox = {
  padding: 10,
  borderTop: "1px solid #eee",
};

const rightPane = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  padding: 16,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 12,
};

const title = { fontSize: 18, fontWeight: 700 };
const sub = { fontSize: 13, color: "#666" };

const card = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
};

const sectionTitle = {
  fontWeight: 600,
  marginBottom: 8,
  fontSize: 14,
};

const row = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const input = {
  flex: 1,
  minWidth: 120,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
};

const primaryBtn = {
  padding: "8px 12px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const dangerBtn = {
  padding: "6px 10px",
  background: "#ef4444",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const smallBtn = {
  padding: "6px 10px",
  background: "#6b7280",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const actions = {
  display: "flex",
  gap: 6,
};

const userList = {
  marginTop: 8,
};

const userItem = {
  display: "flex",
  justifyContent: "space-between",
  padding: 10,
  borderBottom: "1px solid #eee",
  fontSize: 13,
};

const empty = {
  padding: 20,
  textAlign: "center",
  color: "#888",
};

const center = {
  margin: "auto",
  color: "#888",
};

const rowBetween = {
  display: "flex",
  justifyContent: "space-between",
};

const mobileHeader = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderBottom: "1px solid #eee",
  background: "#fff",
  position: "sticky",
  top: 0,
  zIndex: 10,
};