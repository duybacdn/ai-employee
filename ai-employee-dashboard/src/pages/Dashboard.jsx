import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setLoading(true);

        const res = await api.get("/auth/me");
        const userData = res.data;

        setUser(userData);

        localStorage.setItem("user", JSON.stringify(userData));

      } catch (err) {
        console.error("ERROR:", err);

        setUser(null);

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  if (loading) {
    return (
      <div style={wrap}>
        <div style={card}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={wrap}>
        <div style={card}>Not authenticated</div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      {/* HEADER */}
      <div style={header}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ opacity: 0.7 }}>
          Welcome back, <b>{user.name || user.email}</b>
        </div>
      </div>

      {/* GRID */}
      <div style={grid}>
        {/* USER INFO */}
        <div style={card}>
          <h3>👤 Account</h3>
          <p><b>Email:</b> {user.email}</p>
          <p><b>Role:</b> {user.role}</p>
          {user.company_id && (
            <p><b>Company ID:</b> {user.company_id}</p>
          )}
        </div>

        {/* SYSTEM STATUS */}
        <div style={card}>
          <h3>⚙️ System</h3>
          <p>AI Employee System is running</p>
          <p>Mode: Active</p>
        </div>

        {/* QUICK ACTION */}
        <div style={card}>
          <h3>🚀 Quick Actions</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a href="/conversations" style={btn}>Open Conversations</a>
            <a href="/candidates" style={btn}>Review Approvals</a>
            <a href="/knowledge" style={btn}>Manage Knowledge</a>
          </div>
        </div>

        {/* NOTE */}
        <div style={card}>
          <h3>📌 Notes</h3>
          <p>
            - Tin nhắn & comment sẽ được xử lý tự động theo mode của AI employee.
          </p>
          <p>
            - Review mode: cần duyệt trước khi gửi.
          </p>
          <p>
            - Auto mode: gửi ngay lập tức.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const wrap = {
  padding: 20,
};

const header = {
  marginBottom: 20,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
  gap: 16,
};

const card = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};

const btn = {
  textDecoration: "none",
  padding: "10px 12px",
  background: "#2c3e50",
  color: "#fff",
  borderRadius: 8,
  textAlign: "center",
};