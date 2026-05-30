import { useEffect, useState } from "react";
import api, { getCompanies, getChannels, getEmployees } from "../services/api";

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);

  const [newCompany, setNewCompany] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("staff");
  const [editingPermissions, setEditingPermissions] =
    useState({});

  // 🔥 PERMISSION STATE
  const [permissions, setPermissions] = useState({
    channels: [],
    employees: [],
  });

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
        loadPermissionOptions(visible[0].id);
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
      const res = await api.get(
        `/admin/users/company/${companyId}/permissions`
      );

      const data = res.data || [];

      setUsers(data);

      const temp = {};

      data.forEach((u) => {
        temp[u.user_id] = {
          role: u.role,
          channels: u.permissions?.channels || [],
          employees: u.permissions?.employees || [],
        };
      });

      setEditingPermissions(temp);
    } catch {
      setUsers([]);
    }
  };

  const loadPermissionOptions = async (companyId) => {
    try {
      const res = await api.get(
        `/admin/users/company/${companyId}/permission-options`
      );

      setChannels(res.data.channels || []);
      setEmployees(res.data.employees || []);
    } catch {
      setChannels([]);
      setEmployees([]);
    }
  };

  const handleSelectCompany = (c) => {
    setSelectedCompany(c);
    setEditCompany(c.name);

    loadUsers(c.id);
    loadPermissionOptions(c.id);

    if (isMobile) setShowDetail(true);
  };

  // ===== COMPANY =====

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

  // ===== PERMISSION HANDLER =====

  const togglePermission = (type, id) => {
    setPermissions((prev) => {
      const list = prev[type];
      const exists = list.includes(id);

      return {
        ...prev,
        [type]: exists
          ? list.filter((i) => i !== id)
          : [...list, id],
      };
    });
  };

  // ===== USER =====

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !selectedCompany) return;

    await api.post("/admin/users/create-with-company", {
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      company_id: selectedCompany.id,
      permissions: newUserRole === "staff" ? permissions : {},
    });

    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("staff");
    setPermissions({ channels: [], employees: [] });

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

  const handleChangeRole = async (userId, role) => {
    const userPerm =
      editingPermissions[userId] || {};

    await api.put(
      `/admin/users/${userId}/role`,
      {
        role,
        permissions:
          role === "staff"
            ? {
                channels:
                  userPerm.channels || [],
                employees:
                  userPerm.employees || [],
              }
            : {},
      }
    );

    loadUsers(selectedCompany.id);
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
            <div style={companyCreateCard}>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Create Company
              </div>
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
          {!selectedCompany ? (
            <div style={center}>No company selected</div>
          ) : (
            <>
              <div style={header}>                
                <div>
                  <div style={title}>{selectedCompany.name}</div>
                  <div style={sub}>
                    Status:
                    <span
                      style={{
                        marginLeft: 6,
                        fontWeight: 600,
                        color:
                          selectedCompany.status === "active"
                            ? "#16a34a"
                            : "#dc2626",
                      }}
                    >
                      {selectedCompany.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                {isSuperAdmin && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {selectedCompany.status === "deleted" ? (
                      <button
                        style={primaryBtn}
                        onClick={handleRestoreCompany}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        style={dangerBtn}
                        onClick={handleDeleteCompany}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* CREATE USER */}
              {isSuperAdmin && selectedCompany.status !== "deleted" && (
                <div style={card}>
                  <div style={sectionTitle}>Create User</div>

                  <div style={row}>
                    <input
                      placeholder="Email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      style={input}
                    />
                    <input
                      placeholder="Password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      style={input}
                    />
                  </div>

                  <div style={buttonRow}>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      style={select}
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button style={primaryBtn} onClick={handleCreateUser}>
                      Create
                    </button>
                  </div>

                  {/* 🔥 PERMISSION UI */}
                  {newUserRole === "staff" && (
                    <div style={permissionBox}>
                      <div style={permissionTitle}>
                        Channel Permissions
                      </div>

                      <div style={permissionGrid}>
                        {channels.map((channel) => (
                          <label
                            key={channel.id}
                            style={permissionItem}
                          >
                            <input
                              type="checkbox"
                              checked={permissions.channels.includes(
                                channel.id
                              )}
                              onChange={() =>
                                togglePermission(
                                  "channels",
                                  channel.id
                                )
                              }
                            />
                            {channel.name}
                          </label>
                        ))}
                      </div>

                      <div
                        style={{
                          ...permissionTitle,
                          marginTop: 16,
                        }}
                      >
                        Employee Permissions
                      </div>

                      <div style={permissionGrid}>
                        {employees.map((employee) => (
                          <label
                            key={employee.id}
                            style={permissionItem}
                          >
                            <input
                              type="checkbox"
                              checked={permissions.employees.includes(
                                employee.id
                              )}
                              onChange={() =>
                                togglePermission(
                                  "employees",
                                  employee.id
                                )
                              }
                            />
                            {employee.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* USERS */}
              <div style={card}>
                <div style={sectionTitle}>Users</div>

                <div style={userGrid}>
                  {users.map((u) => (
                    <div key={u.user_id} style={userCard}>
                      <div style={userTop}>
                        <div style={avatar}>
                          {u.email?.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <div style={userEmail}>{u.email}</div>
                          {u.permissions && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "#666",
                                marginTop: 4,
                              }}
                            >
                              Ch: {u.permissions.channels?.length || 0}
                              {" | "}
                              Emp: {u.permissions.employees?.length || 0}
                            </div>
                          )}

                          {isSuperAdmin && u.role !== "superadmin" ? (
                            <>
                              <select
                                value={
                                  editingPermissions[u.user_id]?.role || u.role
                                }
                                onChange={(e) => {
                                  const role = e.target.value;

                                  setEditingPermissions((prev) => ({
                                    ...prev,
                                    [u.user_id]: {
                                      ...prev[u.user_id],
                                      role,
                                    },
                                  }));
                                }}
                                style={roleSelect}
                              >
                                <option value="staff">Staff</option>
                                <option value="admin">Admin</option>
                              </select>

                              {/* STAFF PERMISSION */}
                              {editingPermissions[u.user_id]?.role ===
                                "staff" && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    borderTop: "1px solid #eee",
                                    paddingTop: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      marginBottom: 6,
                                    }}
                                  >
                                    Channels
                                  </div>

                                  {channels.map((channel) => (
                                    <label
                                      key={channel.id}
                                      style={{
                                        display: "block",
                                        fontSize: 12,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          editingPermissions[
                                            u.user_id
                                          ]?.channels?.includes(channel.id) ||
                                          false
                                        }
                                        onChange={() => {
                                          setEditingPermissions((prev) => {
                                            const current =
                                              prev[u.user_id]?.channels || [];

                                            const exists =
                                              current.includes(channel.id);

                                            return {
                                              ...prev,
                                              [u.user_id]: {
                                                ...prev[u.user_id],
                                                channels: exists
                                                  ? current.filter(
                                                      (i) => i !== channel.id
                                                    )
                                                  : [...current, channel.id],
                                              },
                                            };
                                          });
                                        }}
                                      />
                                      {" "}
                                      {channel.name}
                                    </label>
                                  ))}

                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      marginTop: 10,
                                      marginBottom: 6,
                                    }}
                                  >
                                    Employees
                                  </div>

                                  {employees.map((employee) => (
                                    <label
                                      key={employee.id}
                                      style={{
                                        display: "block",
                                        fontSize: 12,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          editingPermissions[
                                            u.user_id
                                          ]?.employees?.includes(employee.id) ||
                                          false
                                        }
                                        onChange={() => {
                                          setEditingPermissions((prev) => {
                                            const current =
                                              prev[u.user_id]?.employees || [];

                                            const exists =
                                              current.includes(employee.id);

                                            return {
                                              ...prev,
                                              [u.user_id]: {
                                                ...prev[u.user_id],
                                                employees: exists
                                                  ? current.filter(
                                                      (i) => i !== employee.id
                                                    )
                                                  : [...current, employee.id],
                                              },
                                            };
                                          });
                                        }}
                                      />
                                      {" "}
                                      {employee.name}
                                    </label>
                                  ))}

                                  <button
                                    style={{
                                      ...primaryBtn,
                                      marginTop: 10,
                                      width: "100%",
                                    }}
                                    onClick={() =>
                                      handleChangeRole(
                                        u.user_id,
                                        editingPermissions[u.user_id]?.role
                                      )
                                    }
                                  >
                                    Save Permission
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={userRole(u.role)}>
                              {u.role}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSuperAdmin && u.role !== "superadmin" && (
                        <div style={userActions}>
                          <button
                            style={ghostBtn}
                            onClick={() =>
                              handleResetPassword(u.user_id)
                            }
                          >
                            Reset Password
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

/* ===== STYLE ===== */

const container = { display: "flex", height: "100vh", background: "#f9fafb" };
const leftPane = { width: 320, borderRight: "1px solid #e5e7eb", background: "#fff" };
const sidebarHeader = { padding: 12, fontWeight: 600, borderBottom: "1px solid #eee" };
const companyList = { padding: 10 };
const companyItem = { padding: 10, border: "1px solid #eee", borderRadius: 8, marginBottom: 8, cursor: "pointer" };
const badge = { fontSize: 11, background: "#e5e7eb", padding: "2px 6px", borderRadius: 6 };
const meta = { fontSize: 12, color: "#888" };
const createBox = { padding: 10 };
const rightPane = { flex: 1, padding: 16 };
const header = { display: "flex", justifyContent: "space-between", marginBottom: 12 };
const title = { fontSize: 18, fontWeight: 700 };
const sub = { fontSize: 13, color: "#666" };
const card = { background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: 12, marginBottom: 12 };
const sectionTitle = { fontWeight: 600, marginBottom: 8 };
const row = { display: "flex", gap: 8, flexWrap: "wrap" };
const input = { flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" };
const select = { flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" };
const primaryBtn = {
  padding: "10px 18px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  minWidth: 110,
  fontWeight: 600,
};
const buttonRow = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};
const dangerBtn = { padding: 6, background: "#ef4444", color: "#fff", borderRadius: 6 };
const ghostBtn = { padding: 6, border: "1px solid #ddd", borderRadius: 6 };
const userGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 };
const userCard = { border: "1px solid #eee", borderRadius: 10, padding: 10 };
const userTop = { display: "flex", gap: 10 };
const avatar = { width: 36, height: 36, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" };
const userEmail = { fontSize: 13 };
const userRole = (role) => ({
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 6,
  background:
    role === "superadmin"
      ? "#ede9fe"
      : role === "admin"
      ? "#fee2e2"
      : "#e0f2fe",
});
const roleSelect = { marginTop: 4, padding: 4, borderRadius: 6 };
const userActions = { display: "flex", justifyContent: "space-between", marginTop: 8 };
const empty = { padding: 20, textAlign: "center", color: "#888" };
const center = { margin: "auto" };
const rowBetween = { display: "flex", justifyContent: "space-between" };
const permissionBox = {
  marginTop: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 10,
  maxWidth: 420,
  marginLeft: "auto",
  background: "#fafafa",
};

const permissionTitle = {
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 6,
  color: "#374151",
};

const permissionGrid = {
  display: "grid",
  gridTemplateColumns:
    window.innerWidth < 768
      ? "1fr"
      : "1fr 1fr",
  gap: 4,
};

const permissionItem = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 4px",
  fontSize: 12,
  whiteSpace: "nowrap",
};
const companyCreateCard = {
  margin: 10,
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  background: "#fafafa",
};