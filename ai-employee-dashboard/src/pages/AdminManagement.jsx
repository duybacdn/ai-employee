import { useEffect, useState } from "react";
import {
  getCompanies,
  getUsers,
  getCompanyUsers,
  assignUserToCompany,
  removeUserFromCompany,
} from "../services/api";

export default function AdminManagement() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [companyUsers, setCompanyUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(false);

  // =========================
  // LOAD INIT DATA
  // =========================
  useEffect(() => {
    getCompanies().then((data) => {
      setCompanies(data || []);
      if (data?.length > 0) setCompanyId(data[0].id);
    });

    getUsers().then(setUsers);
  }, []);

  // =========================
  // LOAD COMPANY USERS
  // =========================
  useEffect(() => {
    if (!companyId) return;

    getCompanyUsers(companyId).then((data) => {
      setCompanyUsers(data || []);
    });
  }, [companyId]);

  // =========================
  // ASSIGN USER
  // =========================
  const handleAssign = async () => {
    if (!selectedUser) return alert("Chọn user");

    setLoading(true);
    try {
      await assignUserToCompany(companyId, {
        user_id: selectedUser,
        role,
      });

      setSelectedUser("");
      await reload();
    } catch (err) {
      alert("Assign failed");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // REMOVE USER
  // =========================
  const handleRemove = async (userId) => {
    if (!window.confirm("Remove user khỏi company?")) return;

    setLoading(true);
    try {
      await removeUserFromCompany(companyId, userId);
      await reload();
    } catch (err) {
      alert("Remove failed");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // RELOAD
  // =========================
  const reload = async () => {
    const data = await getCompanyUsers(companyId);
    setCompanyUsers(data || []);
  };

  return (
    <div style={container}>
      <h2 style={title}>Admin Management</h2>

      {/* ================= COMPANY SELECT ================= */}
      <div style={box}>
        <h3 style={subtitle}>Select Company</h3>

        <select
          style={input}
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ================= ASSIGN USER ================= */}
      <div style={box}>
        <h3 style={subtitle}>Assign User</h3>

        <div style={flexWrap}>
          <select
            style={inputFlex}
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">Chọn user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>

          <select
            style={inputFlex}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="admin">admin</option>
            <option value="staff">staff</option>
            <option value="viewer">viewer</option>
          </select>

          <button
            style={primaryBtn}
            onClick={handleAssign}
            disabled={loading}
          >
            {loading ? "Loading..." : "Assign"}
          </button>
        </div>
      </div>

      {/* ================= COMPANY USERS ================= */}
      <div style={box}>
        <h3 style={subtitle}>Users in Company</h3>

        {companyUsers.length === 0 && (
          <div style={empty}>Chưa có user</div>
        )}

        <div style={list}>
          {companyUsers.map((u) => (
            <div key={u.user_id} style={userRow}>
              <div style={{ flex: 1 }}>
                <div style={email}>{u.email}</div>
                <div style={roleText}>Role: {u.role}</div>
              </div>

              <button
                style={dangerBtn}
                onClick={() => handleRemove(u.user_id)}
                disabled={loading}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const container = {
  padding: 16,
  maxWidth: 1000,
  margin: "0 auto",
};

const title = {
  marginBottom: 20,
};

const subtitle = {
  marginBottom: 10,
};

const box = {
  border: "1px solid #ddd",
  padding: 16,
  borderRadius: 10,
  marginBottom: 20,
};

const flexWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
};

const input = {
  width: "100%",
  padding: 10,
};

const inputFlex = {
  flex: 1,
  minWidth: 150,
  padding: 10,
};

const primaryBtn = {
  padding: "10px 16px",
  background: "#1976d2",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const dangerBtn = {
  padding: "6px 12px",
  background: "red",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const userRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #eee",
  paddingBottom: 8,
};

const email = {
  fontWeight: "bold",
};

const roleText = {
  fontSize: 13,
  color: "#666",
};

const empty = {
  color: "#999",
};