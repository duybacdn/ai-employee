import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { formatVNDateTimeSmart } from "../utils/datetime";

export default function ConversationList({
  conversations = [],
  onSelect,
  companyId,
  selectedChannel,
  onChannelChange,
}) {
  const [channels, setChannels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [unreadMap, setUnreadMap] = useState({});
  const [prevById, setPrevById] = useState({});

  useEffect(() => {
    if (!companyId) return;

    const fetchChannels = async () => {
      try {
        const res = await api.get(`/channels?company_id=${companyId}&is_active=true`);
        const list = Array.isArray(res.data) ? res.data : [];
        setChannels(list);

        if (!selectedChannel && list.length && onChannelChange) {
          onChannelChange(list[0].id);
        }
      } catch (err) {
        console.error("Failed to load channels:", err);
        setChannels([]);
      }
    };

    fetchChannels();
  }, [companyId]);

  useEffect(() => {
    const nextPrev = {};
    const nextUnread = { ...unreadMap };

    conversations.forEach((c) => {
      const old = prevById[c.id];
      const oldMsg = old?.last_inbox_message || old?.last_comment_message;
      const newMsg = c.last_inbox_message || c.last_comment_message;

      if (old && oldMsg !== newMsg && selectedId !== c.id) {
        nextUnread[c.id] = true;
      }

      nextPrev[c.id] = c;
    });

    setPrevById(nextPrev);
    setUnreadMap(nextUnread);
  }, [conversations]);

  const saveName = async (conv) => {
    try {
      await api.patch(`/contacts/${conv.contact_id}`, {
        display_name: editName,
      });

      setEditingId(null);
      setEditName("");
    } catch (err) {
      console.error("Update contact failed:", err);
    }
  };

  const displayedConversations = useMemo(() => {
    const list = Array.isArray(conversations) ? [...conversations] : [];
    if (selectedChannel) {
      return list.filter((c) => c.channel_id === selectedChannel);
    }
    return list;
  }, [conversations, selectedChannel]);

  return (
    <div style={styles.container}>
      <div style={styles.filterBox}>
        <select
          value={selectedChannel || ""}
          onChange={(e) => onChannelChange && onChannelChange(e.target.value)}
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

      <div style={styles.list}>
        {displayedConversations.length === 0 && (
          <div style={styles.empty}>Không có hội thoại</div>
        )}

        {displayedConversations.map((conv) => {
          const isComment = conv.kind === "comment";

          let title = "";
          if (isComment) {
            const raw = conv.post_context || "";
            const oneLine = raw.split("\n")[0];
            title = oneLine?.slice(0, 60) || "Bài viết";
          } else {
            title = conv.customer_name || "Khách";
          }

          const subtitle = isComment ? "Bình luận bài viết" : "Tin nhắn Messenger";
          const preview = conv.last_comment_message || conv.last_inbox_message || "...";

          return (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedId(conv.id);
                setUnreadMap((prev) => ({ ...prev, [conv.id]: false }));
                onSelect(conv);
              }}
              style={{
                ...styles.item,
                ...(selectedId === conv.id ? styles.active : {}),
              }}
            >
              <div style={styles.avatar}>{isComment ? "📝" : "👤"}</div>

              <div style={styles.content}>
                <div style={styles.topRow}>
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
                        if (isComment) return;
                        e.stopPropagation();
                        setEditingId(conv.contact_id);
                        setEditName(title);
                      }}
                    >
                      {title}
                    </div>
                  )}

                  <div style={styles.time}>{formatVNDateTimeSmart(conv.updated_at)}</div>
                </div>

                <div style={styles.bottomRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <div
                      style={{
                        ...styles.preview,
                        fontWeight: unreadMap[conv.id] ? "bold" : "normal",
                      }}
                    >
                      {preview}
                    </div>
                    {unreadMap[conv.id] && <div style={styles.dot} />}
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
    gap: 8,
  },
  name: {
    fontWeight: 600,
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 190,
  },
  time: {
    fontSize: 11,
    color: "#999",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
    minWidth: 0,
  },
  preview: {
    fontSize: 13,
    color: "#65676b",
    width: 190,
    overflow: "hidden",
    whiteSpace: "normal",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    lineClamp: 2,
    textOverflow: "ellipsis",
  },
  badge: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    flexShrink: 0,
    height: "fit-content",
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#ff4d4f",
    marginLeft: 6,
    flexShrink: 0,
  },
};
