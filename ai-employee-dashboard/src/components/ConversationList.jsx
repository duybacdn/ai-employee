import { useEffect, useState } from "react";
import api from "../services/api";

export default function ConversationList({
  conversations = [],
  onSelect,
  companyId,
}) {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  // =========================
  // LOAD CHANNELS
  // =========================
  useEffect(() => {
    if (!companyId) return;

    const fetchChannels = async () => {
      try {
        const res = await api.get(
          `/channels?company_id=${companyId}&is_active=true`
        );
        setChannels(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load channels:", err);
        setChannels([]);
      }
    };

    fetchChannels();
  }, [companyId]);

  // =========================
  // HANDLE CHANGE CHANNEL
  // =========================
  const handleChannelChange = (e) => {
    const channelId = e.target.value;
    setSelectedChannel(channelId);

    if (onSelect) onSelect(null, channelId);
  };

  const safeConversations = Array.isArray(conversations)
    ? conversations
    : [];

  // =========================
  // FORMAT TIME
  // =========================
  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);

    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return "vừa xong";
    if (diff < 3600) return Math.floor(diff / 60) + "m";
    if (diff < 86400) return Math.floor(diff / 3600) + "h";

    return d.toLocaleDateString();
  };

  return (
    <div style={styles.container}>
      {/* ===== FILTER ===== */}
      <div style={styles.filterBox}>
        <select
          value={selectedChannel}
          onChange={handleChannelChange}
          style={styles.select}
        >
          <option value="">Tất cả kênh</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>
      </div>

      {/* ===== LIST ===== */}
      <div style={styles.list}>
        {safeConversations.length === 0 && (
          <div style={styles.empty}>Không có hội thoại</div>
        )}

        {safeConversations.map((conv) => {
          const isComment = conv.kind === "comment";

          const title = isComment
            ? `Bài viết`
            : conv.customer_name || "Khách";

          const subtitle = isComment
            ? `Post ID: ${conv.post_id?.slice(-6) || ""}`
            : "Tin nhắn";

          return (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedId(conv.id);
                onSelect(conv, selectedChannel);
              }}
              style={{
                ...styles.item,
                ...(selectedId === conv.id ? styles.active : {}),
              }}
            >
              {/* AVATAR */}
              <div style={styles.avatar}>
                {isComment ? "📝" : "👤"}
              </div>

              {/* CONTENT */}
              <div style={styles.content}>
                <div style={styles.topRow}>
                  <div style={styles.name}>{title}</div>
                  <div style={styles.time}>
                    {formatTime(conv.updated_at)}
                  </div>
                </div>

                <div style={styles.bottomRow}>
                  <div style={styles.preview}>
                    {conv.last_message || "..."}
                  </div>

                  <div
                    style={{
                      ...styles.badge,
                      background: isComment ? "#ffe6f0" : "#e7f3ff",
                      color: isComment ? "#d63384" : "#1877f2",
                    }}
                  >
                    {isComment ? "COMMENT" : "INBOX"}
                  </div>
                </div>

                <div style={styles.sub}>{subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const styles = {
  container: {
    width: "100%",
    maxWidth: 340,
    borderRight: "1px solid #e4e6eb",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#fff",
  },

  filterBox: {
    padding: 10,
    borderBottom: "1px solid #eee",
  },

  select: {
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "1px solid #ddd",
  },

  list: {
    flex: 1,
    overflowY: "auto",
  },

  empty: {
    padding: 20,
    textAlign: "center",
    color: "#999",
  },

  item: {
    display: "flex",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f0f2f5",
    transition: "0.2s",
  },

  active: {
    background: "#e7f3ff",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#f0f2f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    marginRight: 10,
    flexShrink: 0,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  name: {
    fontWeight: 600,
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  time: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },

  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },

  preview: {
    fontSize: 13,
    color: "#65676b",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    maxWidth: "70%",
  },

  badge: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 6,
  },

  sub: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
};