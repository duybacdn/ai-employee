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

  // ===== EDIT CONTACT =====
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

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
  // UPDATE CONTACT NAME
  // =========================
  const saveName = async (conv) => {
    try {
      await api.patch(`/contacts/${conv.contact_id}`, {
        display_name: editName,
      });

      conv.customer_name = editName;

      setEditingId(null);
      setEditName("");
    } catch (err) {
      console.error("Update contact failed:", err);
    }
  };

  // =========================
  // FORMAT TIME
  // =========================
  const formatTime = (iso) => {
    if (!iso) return "";

    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;

    if (diff < 60) return "vừa xong";
    if (diff < 3600) return Math.floor(diff / 60) + " phút";
    if (diff < 86400) return Math.floor(diff / 3600) + " giờ";

    return d.toLocaleString(); // ✅ timezone browser
  };

  const safeConversations = Array.isArray(conversations)
    ? conversations
    : [];

  return (
    <div style={styles.container}>
      {/* FILTER */}
      <div style={styles.filterBox}>
        <select
          value={selectedChannel}
          onChange={(e) => {
            setSelectedChannel(e.target.value);
            if (onSelect) onSelect(null, e.target.value);
          }}
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

      {/* LIST */}
      <div style={styles.list}>
        {safeConversations.length === 0 && (
          <div style={styles.empty}>Không có hội thoại</div>
        )}

        {safeConversations.map((conv) => {
          // ✅ detect đúng loại
          const isComment = !!conv.post_id;

          // =========================
          // TITLE
          // =========================
          let title = "";

          if (isComment) {
            title =
              conv.post_content ||
              (conv.post_id
                ? `Post ${conv.post_id.slice(-6)}`
                : "Bài viết");
          } else {
            title = conv.customer_name || "Khách";
          }

          // =========================
          // SUBTITLE
          // =========================
          const subtitle = isComment
            ? "Bình luận bài viết"
            : "Tin nhắn Messenger";

          // =========================
          // PREVIEW
          // =========================
          const preview =
            conv.last_comment_message ||
            conv.last_inbox_message ||
            "...";

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
                  {/* NAME / TITLE */}
                  {!isComment && editingId === conv.contact_id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => saveName(conv)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName(conv);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={styles.input}
                    />
                  ) : (
                    <div
                      style={styles.name}
                      onClick={(e) => {
                        if (isComment) return; // ❌ không edit comment
                        e.stopPropagation();
                        setEditingId(conv.contact_id);
                        setEditName(title);
                      }}
                    >
                      {title}
                    </div>
                  )}

                  <div style={styles.time}>
                    {formatTime(conv.updated_at)}
                  </div>
                </div>

                <div style={styles.bottomRow}>
                  <div style={styles.preview}>{preview}</div>

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
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 4,
  },
  preview: {
    fontSize: 13,
    color: "#65676b",
    maxWidth: "70%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
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
  input: {
    fontSize: 14,
    padding: 4,
    width: "100%",
    border: "1px solid #ddd",
    borderRadius: 4,
  },
};