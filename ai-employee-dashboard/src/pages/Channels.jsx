import { useEffect, useState } from "react";
import {
  getChannels,
  toggleChannel,
  deleteChannel,
  getChannelEmployees,
  getEmployees,
  getCompanies,
} from "../services/api";

import AssignModal from "../components/AssignModal";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Channels() {
  const [channels, setChannels] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [mapping, setMapping] = useState({});
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loadingToggle, setLoadingToggle] = useState({});
  const [loadingDelete, setLoadingDelete] = useState({});

  const [form, setForm] = useState({ type: "facebook" });

  useEffect(() => {
    getCompanies().then((data) => {
      setCompanies(data);
      if (data.length > 0) setCompanyId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "facebook") {
      alert("✅ Kết nối Facebook thành công");
      window.history.replaceState({}, document.title, "/channels");
      loadData();
    }
  }, []);

  const loadData = async () => {
    if (!companyId) return;

    const ch = await getChannels(companyId);
    const emp = await getEmployees();

    setChannels(ch);
    setEmployees(emp);

    const map = {};
    for (const c of ch) {
      const data = await getChannelEmployees(c.id);
      map[c.id] = data.sort((a, b) => a.priority - b.priority);
    }
    setMapping(map);
  };

  const handleConnectFacebook = () => {
    if (!companyId) {
      alert("Chọn company trước");
      return;
    }
    window.location.href = `${API_BASE}/facebook/login?company_id=${companyId}`;
  };

  const handleConnectZalo = () => {
    if (!companyId) {
      alert("Chọn company trước");
      return;
    }
    window.location.href = `${API_BASE}/channels/zalo/connect?company_id=${companyId}`;
  };

  const handleToggle = async (id) => {
    setLoadingToggle((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await toggleChannel(id);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_active: res.is_active } : c
        )
      );
    } finally {
      setLoadingToggle((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc muốn xoá channel này?")) return;
    setLoadingDelete((prev) => ({ ...prev, [id]: true }));
    try {
      await deleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert("Xoá thất bại: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingDelete((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div style={container}>
      <h2>Channels</h2>

      <div style={{ marginBottom: 15 }}>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">Chọn company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div style={createBox}>
        <div style={createHeader}>
          <h3 style={title}>Create New Channel</h3>
          <p style={subtitle}>Kết nối kênh để AI có thể nhận và trả lời tin nhắn</p>
        </div>

        <div style={createContent}>
          <div style={fieldGroup}>
            <label style={label}>Platform</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={select}
            >
              <option value="facebook">Facebook</option>
              <option value="zalo">Zalo</option>
            </select>
          </div>

          <div style={actionGroup}>
            {form.type === "facebook" && (
              <button style={fbBtn} onClick={handleConnectFacebook}>
                🔗 Connect Facebook Page
              </button>
            )}
            {form.type === "zalo" && (
              <button style={zaloBtn} onClick={handleConnectZalo}>
                🔗 Connect Zalo OA
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={grid}>
        {channels.map((c) => {
          const assigned = mapping[c.id] || [];
          const toggleLoading = loadingToggle[c.id];
          const deleteLoading = loadingDelete[c.id];

          return (
            <div key={c.id} style={{ ...card, position: "relative" }}>
              <div style={row}>
                <h3>{c.name}</h3>
                <span style={badge(c.is_active)}>
                  {c.is_active ? "Active" : "Disabled"}
                </span>
              </div>

              <p>Platform: {c.platform}</p>

              {c.facebook_page && (
                <>
                  <p>Page: {c.facebook_page.page_name}</p>
                  <p>ID: {c.facebook_page.page_id}</p>
                </>
              )}

              <div style={{ marginTop: 10 }}>
                <b>AI Chain:</b>
                {assigned.length === 0 && <p style={{ color: "#888" }}>Chưa có AI</p>}
                {assigned.map((a, index) => {
                  const emp = employees.find((e) => e.id === a.employee_id);
                  return (
                    <div
                      key={a.employee_id}
                      style={{
                        fontSize: 14,
                        color: a.is_active ? "#000" : "#aaa",
                      }}
                    >
                      → {emp?.name || "Unknown AI"}{" "}
                      {index === 0 && <span style={primaryLabel}>PRIMARY</span>}
                      {a.autoreply_mode === "review" && (
                        <span style={suggestLabel}>REVIEW</span>
                      )}
                      {a.autoreply_mode === "off" && (
                        <span style={{ color: "#999", marginLeft: 5 }}>OFF</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ ...row, gap: 10, marginTop: 10 }}>
                {c.is_active && (
                  <button onClick={() => setSelectedChannel(c)}>Assign AI</button>
                )}
                <button
                  onClick={() => handleToggle(c.id)}
                  disabled={toggleLoading}
                >
                  {toggleLoading
                    ? "Loading..."
                    : c.is_active
                    ? "Disable"
                    : "Enable"}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleteLoading}
                  style={{
                    background: "#e53e3e",
                    color: "#fff",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedChannel && (
        <AssignModal
          channel={selectedChannel}
          employees={employees}
          onClose={() => {
            setSelectedChannel(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

/* ===== STYLE ===== */
// (giữ nguyên style bạn đã viết trước đó)

/* ===== STYLE ===== */

const container = {
  padding: 20,
};

const formBox = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 15,
  marginBottom: 20,
  background: "#fafafa",
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: 20,
};

const card = {
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 15,
  background: "#fff",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};

const badge = (active) => ({
  padding: "4px 8px",
  borderRadius: 6,
  background: active ? "#4CAF50" : "#ccc",
  color: "#fff",
  fontSize: 12,
});

const fbBtn = {
  background: "#1877F2",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};

const zaloBtn = {
  background: "#0068FF",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: "bold",
};

const primaryLabel = {
  color: "green",
  fontWeight: "bold",
  marginLeft: 5,
};

const suggestLabel = {
  color: "orange",
  marginLeft: 5,
};

const createBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
  marginBottom: 24,
  background: "#ffffff",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

const createHeader = {
  marginBottom: 15,
};

const title = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
};

const subtitle = {
  margin: "4px 0 0",
  fontSize: 13,
  color: "#666",
};

const createContent = {
  display: "flex",
  gap: 20,
  alignItems: "flex-end",
  flexWrap: "wrap",
};

const fieldGroup = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const label = {
  fontSize: 12,
  color: "#555",
};

const select = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
};

const actionGroup = {
  display: "flex",
  alignItems: "center",
};