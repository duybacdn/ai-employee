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

  // =========================
  // LOAD COMPANIES
  // =========================
  useEffect(() => {
    getCompanies().then((data) => {
      setCompanies(data || []);
      if (data?.length > 0) setCompanyId(data[0].id);
    });
  }, []);

  // =========================
  // LOAD DATA
  // =========================
  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  const loadData = async () => {
    if (!companyId) return;

    try {
      const [ch, emp] = await Promise.all([
        getChannels(companyId),
        getEmployees(),
      ]);

      setChannels(ch || []);

      // 🔥 FIX: filter employee theo company
      const filteredEmployees = (emp || []).filter(
        (e) => e.company_id === companyId
      );
      setEmployees(filteredEmployees);

      // 🔥 FIX: load mapping song song (không await từng cái)
      const mappingEntries = await Promise.all(
        (ch || []).map(async (c) => {
          const data = await getChannelEmployees(c.id);
          return [
            c.id,
            (data || []).sort((a, b) => a.priority - b.priority),
          ];
        })
      );

      const map = Object.fromEntries(mappingEntries);
      setMapping(map);

    } catch (err) {
      console.error("Load data error:", err);
    }
  };

  // =========================
  // CONNECT FACEBOOK / ZALO
  // =========================
  const API_BASE = import.meta.env.VITE_API_BASE;

  const handleConnectFacebook = () => {
    if (!companyId) return alert("Chọn company trước");

    window.location.href = `${API_BASE}/facebook/login?company_id=${companyId}`;
  };

  const handleConnectZalo = () => {
    if (!companyId) return alert("Chọn company trước");

    window.location.href = `/api/v1/channels/zalo/connect?company_id=${companyId}`;
  };

  // =========================
  // TOGGLE
  // =========================
  const handleToggle = async (id) => {
    setLoadingToggle((p) => ({ ...p, [id]: true }));

    try {
      const res = await toggleChannel(id);

      setChannels((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_active: res.is_active } : c
        )
      );
    } finally {
      setLoadingToggle((p) => ({ ...p, [id]: false }));
    }
  };

  // =========================
  // DELETE
  // =========================
  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xoá channel này?")) return;

    setLoadingDelete((p) => ({ ...p, [id]: true }));

    try {
      await deleteChannel(id);
      setChannels((p) => p.filter((c) => c.id !== id));
    } catch (err) {
      alert("Xoá thất bại: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingDelete((p) => ({ ...p, [id]: false }));
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={wrap}>
      <div style={header}>
        <h2 style={title}>📡 Channels</h2>

        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          style={select}
        >
          <option value="">Chọn company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* CREATE */}
      <div style={createCard}>
        <div style={createTop}>
          <b>Kết nối kênh</b>

          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            style={selectSmall}
          >
            <option value="facebook">Facebook</option>
            <option value="zalo">Zalo</option>
          </select>
        </div>

        {form.type === "facebook" && (
          <button style={fbBtn} onClick={handleConnectFacebook}>
            🔵 Connect Facebook
          </button>
        )}

        {form.type === "zalo" && (
          <button style={zaloBtn} onClick={handleConnectZalo}>
            🔷 Connect Zalo
          </button>
        )}
      </div>

      {/* GRID */}
      <div style={grid}>
        {channels.map((c) => {
          const assigned = mapping[c.id] || [];

          return (
            <div key={c.id} style={card}>
              <div style={cardHeader}>
                <div>
                  <div style={channelName}>{c.name}</div>
                  <div style={platform}>{c.platform}</div>
                </div>

                <div style={status(c.is_active)}>
                  {c.is_active ? "Active" : "Disabled"}
                </div>
              </div>

              {/* AI LIST */}
              <div style={aiList}>
                {assigned.length === 0 && (
                  <div style={emptyText}>Chưa có AI</div>
                )}

                {assigned.map((a) => {
                  const emp = employees.find(
                    (e) => e.id === a.employee_id
                  );

                  return (
                    <div key={a.employee_id} style={aiItem}>
                      🤖 {emp?.name || "Unknown"}
                    </div>
                  );
                })}
              </div>

              {/* ACTION */}
              <div style={actions}>
                <button onClick={() => setSelectedChannel(c)} style={primaryBtn}>
                  Assign
                </button>

                <button
                  onClick={() => handleToggle(c.id)}
                  style={toggleBtn(c.is_active)}
                >
                  {loadingToggle[c.id]
                    ? "..."
                    : c.is_active
                    ? "Disable"
                    : "Enable"}
                </button>

                <button
                  onClick={() => handleDelete(c.id)}
                  style={dangerBtn}
                >
                  {loadingDelete[c.id] ? "..." : "Delete"}
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

const wrap = {
  padding: 20,
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
};

const title = {
  fontSize: 22,
  fontWeight: 700,
};

const select = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
};

const selectSmall = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
};

const createCard = {
  background: "#fff",
  padding: 16,
  borderRadius: 14,
  marginBottom: 20,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
};

const createTop = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))",
  gap: 16,
};

const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const cardHeader = {
  display: "flex",
  justifyContent: "space-between",
};

const channelName = {
  fontWeight: 600,
  fontSize: 15,
};

const platform = {
  fontSize: 12,
  color: "#888",
};

const status = (active) => ({
  padding: "4px 10px",
  borderRadius: 20,
  fontSize: 12,
  background: active ? "#dcfce7" : "#fee2e2",
  color: active ? "#16a34a" : "#dc2626",
});

const aiList = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const aiItem = {
  fontSize: 13,
  padding: "4px 8px",
  background: "#f1f5f9",
  borderRadius: 8,
};

const emptyText = {
  color: "#999",
  fontSize: 13,
};

const actions = {
  display: "flex",
  gap: 8,
  marginTop: "auto",
};

const primaryBtn = {
  flex: 1,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px",
  borderRadius: 10,
  cursor: "pointer",
};

const toggleBtn = (active) => ({
  flex: 1,
  background: active ? "#f59e0b" : "#10b981",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
});

const dangerBtn = {
  flex: 1,
  background: "#ef4444",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const fbBtn = {
  background: "#1877F2",
  color: "#fff",
  padding: 10,
  borderRadius: 10,
  border: "none",
};

const zaloBtn = {
  background: "#0068FF",
  color: "#fff",
  padding: 10,
  borderRadius: 10,
  border: "none",
};