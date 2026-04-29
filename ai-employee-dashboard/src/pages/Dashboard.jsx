import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [loadingNoti, setLoadingNoti] = useState(false);

  // 🔥 FILTER
  const [priorityFilter, setPriorityFilter] = useState("important"); 
  // important = high + medium

  // =========================
  // AUTH
  // =========================
  useEffect(() => {
    const fetchMe = async () => {
      try {
        setLoading(true);
        const res = await api.get("/auth/me");

        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));

      } catch (err) {
        localStorage.clear();
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

      let data = [];

      if (priorityFilter === "important") {
        const [high, medium] = await Promise.all([
          api.get("/notifications?priority=high"),
          api.get("/notifications?priority=medium"),
        ]);

        data = [...(high.data || []), ...(medium.data || [])];
      } else {
        const res = await api.get(`/notifications?priority=${priorityFilter}`);
        data = res.data || [];
      }

      // 🔥 sort lại (phòng backend chưa chuẩn)
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setNotifications(data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNoti(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [priorityFilter]);

  // auto refresh
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [priorityFilter]);

  // =========================
  // CLICK NOTIFICATION
  // =========================
  const handleClickNotification = async (n) => {
    try {
      await api.post(`/notifications/${n.id}/read`);

      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, is_read: true } : x
        )
      );

      if (n.conversation_id) {
        navigate(`/conversations?cid=${n.conversation_id}`);
      } else {
        navigate("/conversations");
      }

    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // RENDER
  // =========================
  if (loading) return <div style={wrap}>Loading...</div>;
  if (!user) return <div style={wrap}>Not authenticated</div>;

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const parseContent = (content) => {
    if (!content) return { user: "", ai: "" };

    const parts = content.split("AI:");
    const userPart = parts[0]?.replace("Khách:", "").trim();
    const aiPart = parts[1]?.trim();

    return {
      user: userPart,
      ai: aiPart,
    };
  };

  return (
    <div style={wrap}>

      {/* HEADER */}
      <div style={header}>
        <h2>Dashboard</h2>
        <div>Welcome, <b>{user.name || user.email}</b></div>
      </div>

      {/* FILTER */}
      <div style={filterWrap}>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={select}
        >
          <option value="important">🔥 Quan trọng</option>
          <option value="high">🔴 High</option>
          <option value="medium">🟠 Medium</option>
          <option value="low">🔵 Low</option>
        </select>
      </div>

      {/* NOTIFICATIONS */}
      <div style={card}>
        <h3>
          🔔 Notifications{" "}
          {unreadCount > 0 && <span style={badge}>{unreadCount}</span>}
        </h3>

        {loadingNoti && <p>Loading...</p>}

        {!loadingNoti && notifications.length === 0 && (
          <p>Không có thông báo</p>
        )}

        <div style={notiList}>
          {notifications.slice(0, 20).map((n) => (
            <div
              key={n.id}
              onClick={() => handleClickNotification(n)}
              style={{
                ...notiItem,
                background: n.is_read ? "#f5f5f5" : "#eaf4ff",
                borderLeft: `4px solid ${getColor(n.priority)}`,
              }}
            >
              <div style={notiHeader}>
                <span>{getIcon(n.type)}</span>
                <span style={{ fontWeight: "bold" }}>{n.title}</span>
              </div>

              const { user, ai } = parseContent(n.content);

              <div style={notiContent}>
                <div style={msgUser}>
                  👤 {user}
                </div>

                <div style={msgAI}>
                  🤖 {ai}
                </div>
              </div>

              <div style={notiTime}>
                {formatTime(n.created_at)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const wrap = {
  padding: 12,
  maxWidth: 900,
  margin: "0 auto",
};

const header = {
  marginBottom: 12,
};

const filterWrap = {
  marginBottom: 12,
};

const select = {
  padding: 8,
  borderRadius: 8,
  width: "100%",
};

const card = {
  background: "#fff",
  padding: 12,
  borderRadius: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
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
  gap: 8,
};

const notiItem = {
  padding: 10,
  borderRadius: 10,
  cursor: "pointer",
};

const notiHeader = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const notiContent = {
  fontSize: 13,
  opacity: 0.8,
  marginTop: 4,
};

const notiTime = {
  fontSize: 11,
  opacity: 0.5,
  marginTop: 4,
};

/* ================= HELPER ================= */

const getColor = (priority) => {
  if (priority === "high") return "#e74c3c";
  if (priority === "medium") return "#f39c12";
  return "#3498db";
};

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};

const formatTime = (t) => {
  return new Date(t).toLocaleString();
};

const truncate = (text, max) => {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
};

const msgUser = {
  background: "#f1f1f1",
  padding: "6px 8px",
  borderRadius: 6,
  fontSize: 13,
};

const msgAI = {
  background: "#eaf4ff",
  padding: "6px 8px",
  borderRadius: 6,
  fontSize: 13,
};