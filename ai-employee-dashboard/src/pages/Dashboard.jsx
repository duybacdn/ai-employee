import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [priorityFilter, setPriorityFilter] = useState("important");

  // ================= AUTH =================
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get("/auth/me");
        setUser(res.data);
      } catch {
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);

  // ================= LOAD =================
  const fetchNotifications = async () => {
    let data = [];

    if (priorityFilter === "important") {
      const [high, medium] = await Promise.all([
        api.get("/notifications?priority=high"),
        api.get("/notifications?priority=medium"),
      ]);
      data = [...high.data, ...medium.data];
    } else {
      const res = await api.get(`/notifications?priority=${priorityFilter}`);
      data = res.data;
    }

    // sort
    data.sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    setNotifications(data);
  };

  useEffect(() => {
    fetchNotifications();
  }, [priorityFilter]);

  // ================= GROUP =================
  const groupData = () => {
    const map = {};

    notifications.forEach((n) => {
      const company = n.company_name || "Không rõ công ty";
      const channel = n.channel_name || "Không rõ kênh";

      if (!map[company]) map[company] = {};
      if (!map[company][channel]) map[company][channel] = [];

      map[company][channel].push(n);
    });

    return map;
  };

  const grouped = groupData();

  // ================= CLICK =================
  const handleClick = async (n) => {
    await api.post(`/notifications/${n.id}/read`);

    if (n.conversation_id) {
      navigate(`/conversations?cid=${n.conversation_id}`);
    }
  };

  // ================= RENDER =================
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>No auth</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Dashboard</h2>

      <select
        value={priorityFilter}
        onChange={(e) => setPriorityFilter(e.target.value)}
      >
        <option value="important">🔥 Quan trọng</option>
        <option value="high">🔴 High</option>
        <option value="medium">🟠 Medium</option>
        <option value="low">🔵 Low</option>
      </select>

      {/* ================= DATA ================= */}
      {Object.entries(grouped).map(([company, channels]) => (
        <div key={company} style={{ marginTop: 20 }}>
          
          {/* COMPANY */}
          <div style={companyStyle}>
            🏢 {company}
          </div>

          {Object.entries(channels).map(([channel, list]) => (
            <div key={channel} style={{ marginTop: 10 }}>
              
              {/* CHANNEL */}
              <div style={channelStyle}>
                📡 {channel}
              </div>

              {/* TABLE */}
              <table style={table}>
                <thead>
                  <tr>
                    <th>Khách</th>
                    <th>Nội dung</th>
                    <th>AI</th>
                    <th>Loại</th>
                    <th>Thời gian</th>
                  </tr>
                </thead>

                <tbody>
                  {list.map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => handleClick(n)}
                      style={{
                        background: n.is_read ? "#fff" : "#eef6ff",
                        cursor: "pointer",
                      }}
                    >
                      <td>{n.customer_name || "Khách"}</td>

                      <td>{truncate(n.customer_text, 40)}</td>

                      <td style={{ color: "#2c7be5" }}>
                        {truncate(n.ai_reply, 40)}
                      </td>

                      <td>{getIcon(n.type)}</td>

                      <td>{formatTime(n.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================= STYLE ================= */

const companyStyle = {
  fontWeight: "bold",
  fontSize: 16,
  marginBottom: 6,
};

const channelStyle = {
  marginLeft: 10,
  fontWeight: "bold",
  fontSize: 14,
  opacity: 0.8,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  marginTop: 6,
};

/* ================= HELPER ================= */

const formatTime = (t) => new Date(t).toLocaleString();

const truncate = (text, max) =>
  text ? (text.length > max ? text.slice(0, max) + "..." : text) : "";

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};