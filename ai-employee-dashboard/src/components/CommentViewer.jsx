import { useEffect, useState } from "react";
import api from "../services/api";

export default function CommentViewer({ conversation }) {
  const [comments, setComments] = useState([]);
  const [replyingId, setReplyingId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [sending, setSending] = useState(false);

  // ================= BUILD TREE =================
  function buildTree(list) {
    const map = {};
    const roots = [];

    // 🔥 dùng external_id
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
          params: { conversation_id: conversation.id }
        });

        console.log("🔥 messages API:", res.data);

        const list = res.data.filter((m) => m.kind === "comment");
        console.log("🔥 comment list:", list);

        // 🔥 FIX
        const tree = buildTree(list);
        // 🔥 LOG CHÍNH Ở ĐÂY
        console.log("🌳 TREE RAW:", tree);

        console.log(
          "🌳 TREE STRUCTURE:",
          tree.map(c => ({
            id: c.id,
            text: c.text,
            children: c.children?.length
          }))
        );

        setComments(tree);

      } catch (e) {
        console.error("❌ load messages error", e);
      }
    };

    loadMessages();
  }, [conversation?.id]); // 🔥 sửa luôn dependency

  // ================= SEND =================
  const handleReply = async (parentId = null) => {
    const text = replyText[parentId] || "";
    if (!text.trim() || sending) return;

    try {
      setSending(true);

      await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
        parent_id: parentId, // 🔥 gửi lên backend
      });

      setReplyText((prev) => ({ ...prev, [parentId]: "" }));
      setReplyingId(null);

      // reload lại
      const res = await api.get("/messages", {
        params: { conversation_id: conversation.id },
      });

      const list = res.data.filter((m) => m.kind === "comment");
      setComments(buildTree(list));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (t) =>
    new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ================= RENDER TREE =================
  const renderComment = (c, level = 0) => {
    return (
      <div
        key={c.id}
        style={{
          marginLeft: level * 20,
          borderLeft: level > 0 ? "2px solid #e4e6eb" : "none",
          paddingLeft: level > 0 ? 10 : 0,
        }}
      >
        <div style={row}>
          <div style={avatar}>👤</div>

          <div style={{ flex: 1 }}>
            <div style={bubble}>
              <div style={name}>{c.employee_name}</div>
              <div>{c.text}</div>
            </div>

            <div style={meta}>
              {formatTime(c.created_at)} ·{" "}
              <span
                style={replyBtn}
                onClick={() => setReplyingId(c.id)}
              >
                Trả lời
              </span>
            </div>

            {/* INPUT */}
            {replyingId === c.id && (
              <div style={replyBox}>
                <input
                  value={replyText[c.id] || ""}
                  onChange={(e) =>
                    setReplyText((prev) => ({
                      ...prev,
                      [c.id]: e.target.value,
                    }))
                  }
                  placeholder="Viết phản hồi..."
                  style={input}
                />
                <button
                  onClick={() => handleReply(c.id)}
                  style={btn}
                >
                  Gửi
                </button>
              </div>
            )}

            {/* CHILDREN */}
            {c.children?.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {c.children.map((child) =>
                  renderComment(child, level + 1)
                )}
              </div>
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
      {/* 🔥 STICKY POST */}
      <div style={postBox}>
        <div style={postContent}>
          {conversation.post_context || "Không có nội dung"}
        </div>
      </div>

      {/* COMMENTS */}
      <div style={body}>
        {comments.map((c) => renderComment(c))}
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const container = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

const postBox = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  padding: 12,
  background: "#fff",
  borderBottom: "1px solid #ddd",
};

const postContent = {
  background: "#f0f2f5",
  padding: 12,
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 500,
};

const body = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
  background: "#f5f6f7",
};

const row = {
  display: "flex",
  gap: 8,
  marginBottom: 10,
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
  background: "#e4e6eb",
  padding: 10,
  borderRadius: 14,
  maxWidth: "100%",
};

const name = {
  fontWeight: "600",
  fontSize: 13,
};

const meta = {
  fontSize: 11,
  color: "#65676b",
  display: "flex",
  gap: 10,
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
  background: "#1877f2",
  color: "#fff",
};

const empty = {
  padding: 20,
  textAlign: "center",
};