import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatVNDateTimeSmart } from "../utils/datetime";

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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

  // ================= RESPONSIVE =================
  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ================= LOAD =================
  const fetchNotifications = async () => {
    try {
      setLoadingNoti(true);

      let data = [];

      if (priorityFilter === "important") {
        const [high, medium, low] = await Promise.all([
          api.get("/notifications?priority=high&unread_only=true&limit=50"),
          api.get("/notifications?priority=medium&unread_only=true&limit=50"),
          api.get("/notifications?priority=low&unread_only=true&limit=50"),
        ]);

        data = [
          ...(high.data || []),
          ...(medium.data || []),
          ...(low.data || []),
        ];
      } else {
        const res = await api.get(
          `/notifications?priority=${priorityFilter}&unread_only=true&limit=50`
        );
        data = res.data || [];
      }

      data.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      setNotifications(data);
    } finally {
      setLoadingNoti(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [priorityFilter]);

  useEffect(() => {
    const onFocus = () => fetchNotifications();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [priorityFilter]);

  // ================= GROUP =================
  const groupData = (data) => {
    const result = {};

    data.forEach((n) => {
      const company = n.company_name || "Không xác định";
      const channel = n.channel_name || "Không xác định";

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

    if (x + 320 > window.innerWidth) x = window.innerWidth - 330;
    if (y + 120 > window.innerHeight) y = window.innerHeight - 130;

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
    setNotifications((prev) =>
      prev.filter((x) => x.conversation_id !== n.conversation_id)
    );

    api.post(`/notifications/${n.id}/read`);

    if (!n.conversation_id) return;

    const params = new URLSearchParams();
    params.set("cid", n.conversation_id);

    if (n.message_id) params.set("mid", n.message_id);
    if (n.channel_id) params.set("chid", n.channel_id);

    navigate(`/conversations?${params.toString()}`);
  };

  const getEmptyText = () => {
    if (priorityFilter === "important") return "🎉 Không còn việc cần xử lý";
    if (priorityFilter === "high") return "🎉 Không còn thông báo khẩn cấp";
    if (priorityFilter === "medium") return "🎉 Không còn thông báo quan trọng";
    if (priorityFilter === "low") return "🎉 Không còn thông báo";
    return "🎉 Không có dữ liệu";
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
        <option value="important">🔥 Cần xử lý</option>
        <option value="high">🔴 Khẩn cấp</option>
        <option value="medium">🟠 Quan trọng</option>
        <option value="low">🔵 Thông thường</option>
      </select>

      {Object.keys(grouped).length === 0 && !loadingNoti && (
        <div style={emptyBox}>{getEmptyText()}</div>
      )}

      {Object.entries(grouped).map(([company, channels]) => (
        <div key={company} style={companyBlock}>
          <div style={companyTitle}>🏢 {company}</div>

          {Object.entries(channels).map(([channel, list]) => {
            const unread = list.length;

            return (
              <div key={channel} style={channelBlock}>
                <div style={channelHeader}>
                  📡 {channel}
                  <span style={badge}>{unread}/{list.length}</span>
                </div>

                <div
                  style={{
                    ...tableWrap,
                    overflowX: isMobile ? "auto" : "visible",
                  }}
                >
                  <table style={table}>
                    <thead>
                      <tr>
                        <th style={{ ...thTd, width: "140px" }}>Khách</th>
                        <th style={thTd}>Nội dung KH</th>
                        <th style={thTd}>AI trả lời</th>
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
                          onMouseEnter={(e) => {
                            if (!isMobile)
                              e.currentTarget.style.background = "#f5f6f7";
                          }}
                          onMouseLeave={(e) => {
                            if (!isMobile)
                              e.currentTarget.style.background = n.is_read
                                ? "#fff"
                                : "#eef6ff";
                          }}
                        >
                          <td style={{ ...td, width: "140px" }}>
                            {n.customer_name || "Khách"}
                          </td>

                          <td
                            style={td}
                            onMouseMove={
                              !isMobile
                                ? (e) => showTooltip(e, n.customer_text)
                                : undefined
                            }
                            onMouseLeave={!isMobile ? hideTooltip : undefined}
                          >
                            {n.customer_text || "-"}
                          </td>

                          <td
                            style={{ ...td, color: "#2c7be5" }}
                            onMouseMove={
                              !isMobile
                                ? (e) => showTooltip(e, n.ai_reply)
                                : undefined
                            }
                            onMouseLeave={!isMobile ? hideTooltip : undefined}
                          >
                            {n.ai_reply || "-"}
                          </td>

                          <td style={{ ...td, width: "70px" }}>
                            {getIcon(n.type)}
                          </td>

                          <td style={{ ...td, width: "140px", fontSize: 11 }}>
                            {formatVNDateTimeSmart(n.created_at)}
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

const wrap = {
  width: "100%",
  padding: "16px 20px",
  boxSizing: "border-box",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
  fontSize: 13,
};

const select = {
  marginBottom: 12,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 13,
};

const companyBlock = {
  marginBottom: 20,
  background: "#fff",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
  border: "1px solid #eef2f7",
};

const companyTitle = {
  fontWeight: 600,
  marginBottom: 8,
  fontSize: 13,
  color: "#111",
};

const channelBlock = {
  marginBottom: 12,
};

const channelHeader = {
  fontWeight: 600,
  marginBottom: 8,
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
  alignItems: "center",
};

const badge = {
  background: "#ef4444",
  color: "#fff",
  borderRadius: 999,
  padding: "2px 10px",
  fontSize: 11,
  fontWeight: 600,
};

const tableWrap = {
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid #f1f5f9",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 700,
  background: "#fff",
};

const thTd = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  textAlign: "left",
  fontSize: 12,
  color: "#64748b",
  fontWeight: 600,
  background: "#f8fafc",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 0,
};

const emptyBox = {
  textAlign: "center",
  padding: 40,
  color: "#94a3b8",
  fontSize: 14,
  background: "#fff",
  borderRadius: 16,
  marginTop: 20,
  border: "1px dashed #e2e8f0",
};

const getIcon = (type) => {
  if (type === "order") return "🛒";
  if (type === "support") return "⚠️";
  return "💬";
};