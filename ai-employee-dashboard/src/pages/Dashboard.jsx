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

  // 🔥 TOOLTIP
  const [tooltip, setTooltip] = useState({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  });

  // ================= AUTH =================
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
    } catch (err) {
      console.error(err);
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
      const company = n.company_name || "Công ty chưa rõ";
      const channel = n.channel_name || "Kênh chưa rõ";

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

    const rect = e.currentTarget.getBoundingClientRect();

    let x = rect.left;
    let y = rect.bottom + 6;

    if (x + 400 > window.innerWidth) {
      x = window.innerWidth - 420;
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
    try {
      await api.post(`/notifications/${n.id}/read`);

      if (n.conversation_id) {
        navigate(`/conversations?cid=${n.conversation_id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ================= RENDER =================
  if (loading) return <div style={wrap}>Loading...</div>;
  if (!user) return <div style={wrap}>Not authenticated</div>;

  return (
    <div style={wrap}>
      <h2>Dashboard</h2>

      {/* FILTER */}
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

      {/* DATA */}
      {Object.entries(grouped).map(([company, channels]) => (
        <div key={company} style={companyBlock}>
          <div style={companyTitle}>🏢 {company}</div>

          {Object.entries(channels).map(([channel, list]) => (
            <div key={channel} style={channelBlock}>
              <div style={channelTitle}>📡 {channel}</div>

              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={{ ...thTd, width: "140px" }}>Khách</th>
                      <th style={{ ...thTd, width: "30%" }}>Nội dung KH</th>
                      <th style={{ ...thTd, width: "30%" }}>AI trả lời</th>
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
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#e6f0ff")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = n.is_read
                            ? "#fff"
                            : "#eef6ff")
                        }
                      >
                        <td style={{ ...thTd, width: "140px" }}>
                          {n.customer_name || "Khách"}
                        </td>

                        <td
                          style={{ ...thTd, width: "30%" }}
                          onMouseEnter={(e) =>
                            showTooltip(e, n.customer_text)
                          }
                          onMouseLeave={hideTooltip}
                        >
                          {n.customer_text || "-"}
                        </td>

                        <td
                          style={{
                            ...thTd,
                            width: "30%",
                            color: "#2c7be5",
                          }}
                          onMouseEnter={(e) =>
                            showTooltip(e, n.ai_reply)
                          }
                          onMouseLeave={hideTooltip}
                        >
                          {n.ai_reply || "-"}
                        </td>

                        <td style={{ ...thTd, width: "70px" }}>
                          {getIcon(n.type)}
                        </td>

                        <td
                          style={{
                            ...thTd,
                            width: "140px",
                            fontSize: 11,
                          }}
                        >
                          {formatTime(n.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 12,
            maxWidth: 400,
            zIndex: 9999,
            whiteSpace: "normal",
            lineHeight: 1.4,
            boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

/* ================= STYLE ================= */

const wrap = {
  padding: 12,
  maxWidth: 1200,
  margin: "0 auto",
};

const select = {
  marginBottom: 12,
  padding: 8,
  borderRadius: 6,
  width: 200,
};

const companyBlock = {
  marginBottom: 20,
};

const companyTitle = {
  fontWeight: "bold",
  fontSize: 16,
  marginBottom: 8,
};

const channelBlock = {
  marginBottom: 12,
};

const channelTitle = {
  fontSize: 14,
  fontWeight: "bold",
  marginBottom: 6,
};

const tableWrap = {
  overflowX: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  tableLayout: "fixed",
};

const thTd = {
  padding: "6px 8px",
  borderBottom: "1px solid #eee",
  textAlign: "left",

  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",

  maxWidth: 0,
};

/* ================= HELPER ================= */

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};

const formatTime = (t) => {
  return new Date(t).toLocaleString();
};