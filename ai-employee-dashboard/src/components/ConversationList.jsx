// ai-employee-dashboard/src/components/ConversationList.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import { formatVNDateTimeSmart } from "../utils/datetime";

export default function ConversationList({
  conversations = [],
  onSelect,
}) {
  const [selectedId, setSelectedId] = useState(null);

  // edit contact name
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  // unread badge map
  const [unreadMap, setUnreadMap] = useState({});
  const [prevById, setPrevById] = useState({});

  // detect new message in existed conversation
  useEffect(() => {
    const nextPrev = {};
    const nextUnread = { ...unreadMap };

    (Array.isArray(conversations) ? conversations : []).forEach((c) => {
      const old = prevById[c.id];

      const oldMsg =
        old?.last_inbox_message || old?.last_comment_message;

      const newMsg =
        c.last_inbox_message || c.last_comment_message;

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

  const list = Array.isArray(conversations) ? conversations : [];

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {list.length === 0 && (
          <div style={styles.empty}>Không có hội thoại</div>
        )}

        {list.map((conv) => {
          const isComment = conv.kind === "comment";

          // title
          let title = "";
          if (isComment) {
            const raw = conv.post_context || "";
            const oneLine = raw.split("\n")[0];
            title = oneLine?.slice(0, 60) || "Bài viết";
          } else {
            title = conv.customer_name || "Khách";
          }

          // subtitle
          const subtitle = isComment
            ? "Bình luận bài viết"
            : "Tin nhắn Messenger";

          // preview
          const preview =
            conv.last_comment_message ||
            conv.last_inbox_message ||
            "...";

          return (
            <div
              key={conv.id}
              onClick={() => {
                setSelectedId(conv.id);
                setUnreadMap((prev) => ({
                  ...prev,
                  [conv.id]: false,
                }));
                onSelect(conv);
              }}
              style={{
                ...styles.item,
                ...(selectedId === conv.id ? styles.active : {}),
              }}
            >
              {/* avatar */}
              <div style={styles.avatar}>
                {isComment ? "📝" : "👤"}
              </div>

              {/* content */}
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

                  <div style={styles.time}>
                    {formatVNDateTimeSmart(conv.updated_at)}
                  </div>
                </div>

                <div style={styles.bottomRow}>
                  <div style={styles.previewWrap}>
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

/* STYLE */
const styles = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    textAlign: "left",
  },
  list: {
    flex: 1,
    overflowY: "auto",
    textAlign: "left",
  },
  empty: {
    padding: 20,
    textAlign: "left",
    color: "#999",
  },
  item: {
    display: "flex",
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #f0f2f5",
    textAlign: "left",
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
    textAlign: "left",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  name: {
    fontWeight: 600,
    fontSize: 14,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 190,
    textAlign: "left",
  },
  time: {
    fontSize: 11,
    color: "#999",
    whiteSpace: "nowrap",
    flexShrink: 0,
    textAlign: "left",
  },
  bottomRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
    minWidth: 0,
  },
  previewWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
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
    textAlign: "left",
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
    textAlign: "left",
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
