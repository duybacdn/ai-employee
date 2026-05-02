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

  const [tooltip, setTooltip] = useState({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  });

  // 🔥 detect mobile
  const isMobile = window.innerWidth < 768;

  // ================= AUTH =================
  useEffect(() => {
    const fetchMe = async () => {
      try {
        setLoading(true);
        const res = await api.get("/auth/me");

        setUser(res.data);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  // ================= LOAD =================
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

      data.sort((a, b) => {
        if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setNotifications(data);
    } finally {
      setLoadingNoti(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [priorityFilter]);

  // ================= GROUP =================
  const groupData = (data) => {
    const result = {};

    data.forEach((n) => {
      const company = n.company_name || "Công ty";
      const channel = n.channel_name || "Kênh";

      if (!result[company]) result[company] = {};
      if (!result[company][channel]) result[company][channel] = [];

      result[company][channel].push(n);
    });

    return result;
  };

  const grouped = groupData(notifications);

  // ================= TOOLTIP =================
  const showTooltip = (e, text) => {
    if (!text) return;

    let x = e.clientX + 12;
    let y = e.clientY + 12;

    // tránh tràn màn hình
    if (x + 320 > window.innerWidth) {
      x = window.innerWidth - 330;
    }

    if (y + 120 > window.innerHeight) {
      y = window.innerHeight - 130;
    }

    setTooltip({
      visible: true,
      text,
      x,
      y,
    });
  };

  const hideTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  // ================= CLICK =================
  const handleClick = async (n) => {
    await api.post(`/notifications/${n.id}/read`);

    // 🔥 giảm số chưa đọc ngay lập tức
    setNotifications((prev) =>
      prev.map((x) =>
        x.id === n.id ? { ...x, is_read: true } : x
      )
    );

    if (n.conversation_id) {
      navigate(`/conversations?cid=${n.conversation_id}`);
    }
  };

  // ================= RENDER =================
  if (loading) return <div style={wrap}>Loading...</div>;

  return (
    <div style={wrap}>
      <h2>Dashboard</h2>

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

      {Object.entries(grouped).map(([company, channels]) => (
        <div key={company} style={companyBlock}>
          <div style={companyTitle}>🏢 {company}</div>

          {Object.entries(channels).map(([channel, list]) => {
            const unread = list.filter((x) => !x.is_read).length;

            return (
              <div key={channel} style={channelBlock}>
                <div style={channelHeader}>
                  📡 {channel}
                  <span style={badge}>
                    {unread}/{list.length}
                  </span>
                </div>

                <div style={tableWrap}>
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={{ ...thTd, width: "140px" }}>Khách</th>
                        <th style={{ ...thTd }}>Nội dung KH</th>
                        <th style={{ ...thTd }}>AI trả lời</th>
                        <th style={{ ...thTd, width: "70px" }}>Loại</th>
                        <th style={{ ...thTd, width: "140px" }}>Thời gian</th>
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
                          <td style={{ ...td, width: "140px" }}>
                            {n.customer_name || "Khách"}
                          </td>

                          <td
                            style={td}
                            onMouseMove={(e) =>
                              showTooltip(e, n.customer_text)
                            }
                            onMouseLeave={hideTooltip}
                          >
                            {n.customer_text || "-"}
                          </td>

                          <td
                            style={{ ...td, color: "#2c7be5" }}
                            onMouseMove={(e) =>
                              showTooltip(e, n.ai_reply)
                            }
                            onMouseLeave={hideTooltip}
                          >
                            {n.ai_reply || "-"}
                          </td>

                          <td style={{ ...td, width: "70px" }}>
                            {getIcon(n.type)}
                          </td>

                          <td style={{ ...td, width: "140px", fontSize: 11 }}>
                            {formatTime(n.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* TOOLTIP */}
      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y,
            left: tooltip.x,
            background: "#111",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 320,
            zIndex: 999999,
            pointerEvents: "none",
            lineHeight: 1.4,
            boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

/* ================= STYLE ================= */

const wrap = { padding: 12, maxWidth: 1200, margin: "0 auto" };

const select = { marginBottom: 12, padding: 8 };

const companyBlock = { marginBottom: 20 };

const companyTitle = { fontWeight: "bold", marginBottom: 8 };

const channelBlock = { marginBottom: 12 };

const channelHeader = {
  fontWeight: "bold",
  marginBottom: 6,
  display: "flex",
  justifyContent: "space-between",
};

const badge = {
  background: "red",
  color: "#fff",
  borderRadius: 12,
  padding: "2px 8px",
  fontSize: 12,
};

const tableWrap = { overflowX: "auto" };

const table = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  minWidth: 700,
};

const thTd = {
  padding: 6,
  borderBottom: "1px solid #eee",
  textAlign: "left",
};

const td = {
  padding: 6,
  borderBottom: "1px solid #eee",
  textAlign: "left",

  whiteSpace: window.innerWidth < 768 ? "normal" : "nowrap", // 🔥 key fix
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/* ================= TOOLTIP ================= */

const tooltipBox = {
  position: "fixed",
  background: "#111",
  color: "#fff",
  padding: "8px",
  borderRadius: 6,
  fontSize: 12,
  maxWidth: 300,
  zIndex: 99999,
  pointerEvents: "none",
};

/* ================= HELPER ================= */

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};

const formatTime = (t) => new Date(t).toLocaleString();