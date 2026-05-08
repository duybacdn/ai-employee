import { useEffect, useState } from "react";
import api from "../services/api";

export default function CommentViewer({ conversation }) {
  const [comments, setComments] = useState([]);
  const [replyingId, setReplyingId] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // ================= LOAD =================
  useEffect(() => {
    setComments(conversation?.messages || []);
  }, [conversation]);

  // ================= SEND REPLY =================
  const handleReply = async (parent) => {
    if (!text.trim() || sending) return;

    const tempId = "tmp_" + Date.now();

    const newComment = {
      id: tempId,
      text,
      direction: "outbound",
      kind: "comment",
      created_at: new Date().toISOString(),
      parent_id: parent?.id || null,
      employee_name: "Bạn",
    };

    setComments((prev) => [...prev, newComment]);
    setText("");
    setReplyingId(null);

    try {
      setSending(true);

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
      });

      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? { ...c, id: res.data.id }
            : c
        )
      );
    } finally {
      setSending(false);
    }
  };

  // ================= FORMAT =================
  const formatTime = (t) =>
    new Date(t).toLocaleString();

  const getName = (m) => {
    if (m.direction === "outbound") {
      return m.employee_name || "Nhân viên";
    }
    return conversation.customer_name || "Khách";
  };

  // ================= BUILD TREE =================
  const buildTree = () => {
    const map = {};
    const roots = [];

    comments.forEach((c) => {
      map[c.id] = { ...c, children: [] };
    });

    comments.forEach((c) => {
      if (c.parent_id && map[c.parent_id]) {
        map[c.parent_id].children.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });

    return roots;
  };

  const tree = buildTree();

  // ================= RENDER NODE =================
  const renderComment = (c, level = 0) => {
    return (
      <div key={c.id} style={{ marginLeft: level * 32, marginBottom: 10 }}>
        <div style={row}>
          <div style={avatar}>👤</div>

          <div style={content}>
            <div style={bubble}>
              <div style={name}>{getName(c)}</div>
              <div>{c.text}</div>
            </div>

            <div style={meta}>
              <span>{formatTime(c.created_at)}</span>
              <span
                style={replyBtn}
                onClick={() => setReplyingId(c.id)}
              >
                Trả lời
              </span>
            </div>

            {/* reply box */}
            {replyingId === c.id && (
              <div style={replyBox}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Trả lời bình luận..."
                  style={input}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReply(c);
                  }}
                />
                <button onClick={() => handleReply(c)} style={btn}>
                  {sending ? "..." : "Gửi"}
                </button>
              </div>
            )}

            {/* children */}
            {c.children.map((child) =>
              renderComment(child, level + 1)
            )}
          </div>
        </div>
      </div>
    );
  };

  // ================= RENDER =================
  if (!conversation) {
    return <div style={empty}>Chọn hội thoại</div>;
  }

  return (
    <div style={container}>
      {/* POST */}
      <div style={postBox}>
        <div style={postTitle}>📝 Bài viết</div>
        <div style={postContent}>
          {conversation.post_context || "Không có nội dung"}
        </div>
      </div>

      {/* COMMENTS */}
      <div style={body}>
        {tree.map((c) => renderComment(c))}
      </div>

      {/* ROOT REPLY */}
      <div style={rootReply}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Viết bình luận..."
          style={input}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleReply(null);
          }}
        />
        <button onClick={() => handleReply(null)} style={btn}>
          {sending ? "..." : "Đăng"}
        </button>
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const container = { display: "flex", flexDirection: "column", height: "100%" };

const postBox = {
  padding: 10,
  borderBottom: "1px solid #eee",
  background: "#fff",
};

const postTitle = { fontWeight: "bold", marginBottom: 6 };

const postContent = {
  background: "#f0f2f5",
  padding: 10,
  borderRadius: 10,
  fontSize: 14,
  whiteSpace: "pre-wrap",
};

const body = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
  background: "#fafafa",
};

const row = { display: "flex", gap: 8 };

const avatar = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const content = { flex: 1 };

const bubble = {
  background: "#f0f2f5",
  padding: 8,
  borderRadius: 12,
  display: "inline-block",
  maxWidth: "80%",
};

const name = { fontWeight: "bold", fontSize: 12 };

const meta = {
  fontSize: 11,
  color: "#65676b",
  display: "flex",
  gap: 10,
  marginTop: 3,
};

const replyBtn = { cursor: "pointer", color: "#1877f2" };

const replyBox = { display: "flex", gap: 6, marginTop: 6 };

const rootReply = {
  display: "flex",
  gap: 6,
  padding: 10,
  borderTop: "1px solid #eee",
};

const input = {
  flex: 1,
  padding: 8,
  borderRadius: 20,
  border: "1px solid #ddd",
};

const btn = {
  padding: "6px 12px",
  borderRadius: 20,
  border: "none",
  background: "#1877f2",
  color: "#fff",
};

const empty = { padding: 20, textAlign: "center" };