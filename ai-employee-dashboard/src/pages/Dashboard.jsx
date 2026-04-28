import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔔 NOTIFICATION
  const [notifications, setNotifications] = useState([]);
  const [loadingNoti, setLoadingNoti] = useState(false);

  // =========================
  // AUTH
  // =========================
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

  // =========================
  // LOAD NOTIFICATION
  // =========================
  const fetchNotifications = async () => {
    try {
      setLoadingNoti(true);
      const res = await api.get("/notifications/");
      setNotifications(res.data || []);
    } catch (err) {
      console.error("Load notification error:", err);
    } finally {
      setLoadingNoti(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // 🔥 AUTO REFRESH 10s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // =========================
  // CLICK NOTIFICATION
  // =========================
  const handleClickNotification = async (n) => {
    try {
      await api.put(`/notifications/${n.id}/read`);

      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, is_read: true } : x
        )
      );

      // 👉 mở conversation nếu có
      if (n.conversation_id) {
        window.location.href = `/conversations/${n.conversation_id}`;
      }

    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // RENDER
  // =========================
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

  const unreadCount = notifications.filter(n => !n.is_read).length;

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

        {/* USER */}
        <div style={card}>
          <h3>👤 Account</h3>
          <p><b>Email:</b> {user.email}</p>
          <p><b>Role:</b> {user.role}</p>
          {user.company_id && (
            <p><b>Company ID:</b> {user.company_id}</p>
          )}
        </div>

        {/* SYSTEM */}
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

        {/* 🔔 NOTIFICATION */}
        <div style={card}>
          <h3>
            🔔 Notifications{" "}
            {unreadCount > 0 && (
              <span style={badge}>{unreadCount}</span>
            )}
          </h3>

          {loadingNoti && <p>Loading...</p>}

          {!loadingNoti && notifications.length === 0 && (
            <p>Không có thông báo</p>
          )}

          <div style={notiList}>
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClickNotification(n)}
                style={{
                  ...notiItem,
                  background: n.is_read ? "#f5f5f5" : "#eaf4ff",
                  borderLeft: `4px solid ${getColor(n.type)}`,
                }}
              >
                <div style={{ fontWeight: "bold" }}>
                  {getIcon(n.type)} {n.title}
                </div>

                <div style={notiContent}>
                  {n.content}
                </div>

                <div style={notiTime}>
                  {formatTime(n.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NOTE */}
        <div style={card}>
          <h3>📌 Notes</h3>
          <p>- Tin nhắn & comment xử lý tự động theo mode.</p>
          <p>- Review mode: cần duyệt trước.</p>
          <p>- Auto mode: gửi ngay.</p>
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

const badge = {
  background: "red",
  color: "#fff",
  borderRadius: 20,
  padding: "2px 8px",
  fontSize: 12,
};

const notiList = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const notiItem = {
  padding: 12,
  borderRadius: 10,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const notiContent = {
  fontSize: 13,
  lineHeight: "1.4",
  wordBreak: "break-word",
};

const notiTime = {
  fontSize: 11,
  opacity: 0.5,
};

/* ================= HELPER ================= */

const getColor = (type) => {
  if (type === "order") return "#27ae60";
  if (type === "support") return "#e67e22";
  return "#3498db";
};

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};

const formatTime = (t) => {
  if (!t) return "";
  return new Date(t).toLocaleString();
};