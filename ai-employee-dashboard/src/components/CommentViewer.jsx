import { useEffect, useState } from "react";
import api from "../services/api";

export default function CommentViewer({ conversation }) {
  const [tree, setTree] = useState([]);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [sending, setSending] = useState(false);

  // ================= BUILD TREE =================
  function buildTree(list) {
    const map = {};
    const roots = [];

    list.forEach((c) => {
      map[c.external_id] = { ...c, children: [] };
    });

    list.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(map[c.external_id]);
      } else {
        roots.push(map[c.external_id]);
      }
    });

    return roots;
  }

  // ================= LOAD =================
  useEffect(() => {
    if (!conversation?.id) return;

    const loadMessages = async () => {
      try {
        const res = await api.get("/messages", {
          params: { conversation_id: conversation.id },
        });

        const list = res.data.filter((m) => m.kind === "comment");

        const built = buildTree(list);

        console.log("🌳 TREE:", built);

        setTree(built);
      } catch (e) {
        console.error("❌ load messages error", e);
      }
    };

    loadMessages();
  }, [conversation]);

  // ================= SEND =================
  const handleReply = async (parentExternalId = null) => {
    const text = replyText[parentExternalId] || "";
    if (!text.trim() || sending) return;

    try {
      setSending(true);

      await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
        parent_id: parentExternalId,
      });

      setReplyText((prev) => ({ ...prev, [parentExternalId]: "" }));
      setReplyingId(null);

      // reload
      const res = await api.get("/messages", {
        params: { conversation_id: conversation.id },
      });

      const list = res.data.filter((m) => m.kind === "comment");
      setTree(buildTree(list));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (t) =>
    new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ================= RENDER =================
  const renderComment = (c, level = 0) => {
    return (
      <div
        key={c.id}
        style={{
          marginLeft: level * 16,
          marginBottom: 10,
        }}
      >
        <div style={row}>
          <div style={avatar}>👤</div>

          <div style={{ flex: 1 }}>
            <div style={bubble}>
              <div style={name}>{c.employee_name}</div>

              {/* TEXT luôn căn trái */}
              <div style={textStyle}>{c.text}</div>

              <div style={time}>{formatTime(c.created_at)}</div>
            </div>

            <div style={meta}>
              <span
                style={replyBtn}
                onClick={() => setReplyingId(c.external_id)}
              >
                Trả lời
              </span>
            </div>

            {/* INPUT */}
            {replyingId === c.external_id && (
              <div style={replyBox}>
                <input
                  value={replyText[c.external_id] || ""}
                  onChange={(e) =>
                    setReplyText((prev) => ({
                      ...prev,
                      [c.external_id]: e.target.value,
                    }))
                  }
                  placeholder="Viết phản hồi..."
                  style={input}
                />
                <button
                  onClick={() => handleReply(c.external_id)}
                  style={btn}
                >
                  Gửi
                </button>
              </div>
            )}

            {/* CHILDREN */}
            {c.children?.map((child) =>
              renderComment(child, level + 1)
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!conversation) {
    return <div style={empty}>Chọn hội thoại</div>;
  }

  return (
    <div style={container}>
      {/* POST (STICKY) */}
      <div style={postBox}>
        <div style={postContent}>
          {conversation.post_context || "Không có nội dung"}
        </div>
      </div>

      {/* COMMENTS */}
      <div style={body}>
        {tree.map((c) => renderComment(c))}
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const container = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "Arial, sans-serif",
};

const postBox = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  padding: 12,
  background: "#fff",
  borderBottom: "1px solid #eee",
};

const postContent = {
  background: "#f1f1f1",
  padding: 12,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
};

const body = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
  background: "#fafafa",
};

const row = {
  display: "flex",
  gap: 8,
};

const avatar = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const bubble = {
  background: "#f1f1f1",
  padding: 10,
  borderRadius: 12,
  maxWidth: "100%",
  textAlign: "left",
};

const name = {
  fontSize: 12,
  fontWeight: "bold",
  marginBottom: 4,
  opacity: 0.7,
};

const textStyle = {
  fontSize: 14,
  textAlign: "left",
  whiteSpace: "pre-wrap",
};

const time = {
  fontSize: 10,
  opacity: 0.5,
  marginTop: 4,
  textAlign: "left",
};

const meta = {
  fontSize: 11,
  color: "#65676b",
  marginTop: 4,
};

const replyBtn = {
  cursor: "pointer",
  color: "#1877f2",
};

const replyBox = {
  display: "flex",
  gap: 6,
  marginTop: 6,
};

const input = {
  flex: 1,
  padding: 8,
  borderRadius: 20,
  border: "1px solid #ddd",
  fontSize: 14,
};

const btn = {
  padding: "6px 12px",
  borderRadius: 20,
  border: "none",
  background: "#2c7be5",
  color: "#fff",
};

const empty = {
  padding: 20,
  textAlign: "center",
};