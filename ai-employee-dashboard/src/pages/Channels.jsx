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

    window.location.href = `${API_BASE}/api/v1/facebook/login?company_id=${companyId}`;
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
  // UI (GIỮ NGUYÊN)
  // =========================
  return (
    <div style={container}>
      <h2>Channels</h2>

      {/* COMPANY SELECT */}
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

      {/* CREATE BOX */}
      <div style={createBox}>
        <h3>Create New Channel</h3>

        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="facebook">Facebook</option>
          <option value="zalo">Zalo</option>
        </select>

        {form.type === "facebook" && (
          <button style={fbBtn} onClick={handleConnectFacebook}>
            Connect Facebook
          </button>
        )}

        {form.type === "zalo" && (
          <button style={zaloBtn} onClick={handleConnectZalo}>
            Connect Zalo
          </button>
        )}
      </div>

      {/* CHANNEL GRID */}
      <div style={grid}>
        {channels.map((c) => {
          const assigned = mapping[c.id] || [];

          return (
            <div key={c.id} style={card}>
              <div style={row}>
                <h3>{c.name}</h3>
                <span style={badge(c.is_active)}>
                  {c.is_active ? "Active" : "Disabled"}
                </span>
              </div>

              <p>Platform: {c.platform}</p>

              {assigned.map((a) => {
                const emp = employees.find((e) => e.id === a.employee_id);

                return (
                  <div key={a.employee_id}>
                    → {emp?.name || "Unknown"}
                  </div>
                );
              })}

              <div style={row}>
                <button onClick={() => setSelectedChannel(c)}>
                  Assign AI
                </button>

                <button onClick={() => handleToggle(c.id)}>
                  {loadingToggle[c.id]
                    ? "Loading..."
                    : c.is_active
                    ? "Disable"
                    : "Enable"}
                </button>

                <button onClick={() => handleDelete(c.id)}>
                  {loadingDelete[c.id] ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
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

/* styles giữ nguyên */
const container = { padding: 20 };
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: 20,
};
const card = { border: "1px solid #ddd", padding: 15, borderRadius: 12 };
const row = { display: "flex", justifyContent: "space-between" };
const badge = (active) => ({
  padding: "4px 8px",
  background: active ? "green" : "gray",
  color: "#fff",
});
const fbBtn = { background: "#1877F2", color: "#fff" };
const zaloBtn = { background: "#0068FF", color: "#fff" };
const createBox = { padding: 15, border: "1px solid #ddd", marginBottom: 20 };