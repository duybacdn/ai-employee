import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState([]);
  const [loadingNoti, setLoadingNoti] = useState(false);

  const [priorityFilter, setPriorityFilter] = useState("important");

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

      // sort: unread trước + mới nhất trước
      data.sort((a, b) => {
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

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

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [priorityFilter]);

  // =========================
  // CLICK
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div style={wrap}>
      {/* HEADER */}
      <div style={header}>
        <h2>Dashboard</h2>
        <div>
          Welcome, <b>{user.name || user.email}</b>
        </div>
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

      {/* TABLE */}
      <div style={tableWrap}>
        <h3>
          🔔 Notifications{" "}
          {unreadCount > 0 && <span style={badge}>{unreadCount}</span>}
        </h3>

        {loadingNoti && <p>Loading...</p>}

        {!loadingNoti && notifications.length === 0 && (
          <p>Không có thông báo</p>
        )}

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Công ty</th>
              <th style={th}>Kênh</th>
              <th style={th}>Khách</th>
              <th style={th}>Tin KH</th>
              <th style={th}>AI</th>
              <th style={th}>Loại</th>
              <th style={th}>Time</th>
            </tr>
          </thead>

          <tbody>
            {notifications.slice(0, 50).map((n) => (
              <tr
                key={n.id}
                onClick={() => handleClickNotification(n)}
                style={{
                  cursor: "pointer",
                  background: n.is_read ? "#fff" : "#eef6ff",
                }}
              >
                <td style={td}>
                  {n.company_name || `#${n.company_id?.slice(0, 6)}`}
                </td>

                <td style={td}>
                  {n.channel_name || n.platform || "Messenger"}
                </td>

                <td style={td}>
                  {n.customer_name || "Khách"}
                </td>

                <td style={td}>
                  {truncate(n.customer_text, 40)}
                </td>

                <td style={{ ...td, color: "#2c7be5" }}>
                  {truncate(n.ai_reply, 40)}
                </td>

                <td style={td}>
                  <span style={priorityBadge(n.priority)}>
                    {getIcon(n.type)}
                  </span>
                </td>

                <td style={tdSmall}>
                  {formatTime(n.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const wrap = {
  padding: 12,
  maxWidth: 1100,
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

const badge = {
  background: "red",
  color: "#fff",
  borderRadius: 20,
  padding: "2px 8px",
  fontSize: 12,
};

const tableWrap = {
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th = {
  textAlign: "left",
  padding: 8,
  borderBottom: "2px solid #eee",
};

const td = {
  padding: 8,
  borderBottom: "1px solid #eee",
};

const tdSmall = {
  padding: 8,
  fontSize: 11,
  opacity: 0.7,
};

/* ================= HELPER ================= */

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};

const priorityBadge = (priority) => {
  let color = "#3498db";
  if (priority === "high") color = "#e74c3c";
  if (priority === "medium") color = "#f39c12";

  return {
    background: color,
    color: "#fff",
    padding: "2px 6px",
    borderRadius: 6,
    fontSize: 11,
  };
};

const formatTime = (t) => {
  return new Date(t).toLocaleString();
};

const truncate = (text, max) => {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
};