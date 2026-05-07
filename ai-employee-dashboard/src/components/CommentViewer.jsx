import { useEffect, useState, useRef } from "react";
import api from "../services/api";

export default function CommentViewer({ conversation }) {
  const [comments, setComments] = useState([]);
  const [replyingId, setReplyingId] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  // ================= LOAD =================
  useEffect(() => {
    setComments(conversation?.comments || []);
  }, [conversation]);

  // ================= AUTO SCROLL =================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // ================= SEND REPLY =================
  const handleReply = async (comment) => {
    if (!text.trim() || sending) return;

    const tempId = "tmp_" + Date.now();
    const now = new Date().toISOString();

    const newMsg = {
      id: tempId,
      text,
      direction: "outbound",
      kind: "comment",
      created_at: now,
      status: "pending",
    };

    setComments((prev) => [...prev, newMsg]);
    setText("");
    setReplyingId(null);

    try {
      setSending(true);

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
      });

      setComments((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: res.data.id, status: "sent" }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // ================= HELPERS =================
  const isRight = (m) => m.direction === "outbound";

  const formatTime = (t) =>
    new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ================= RENDER =================
  if (!conversation) {
    return <div style={empty}>Chọn hội thoại</div>;
  }

  return (
    <div style={container}>
      {/* ================= POST ================= */}
      <div style={postBox}>
        <div style={postHeader}>📝 Bài viết</div>
        <div style={postContent}>
          {conversation.post_context || "Không có nội dung"}
        </div>
      </div>

      {/* ================= COMMENTS ================= */}
      <div style={body}>
        {comments.map((m) => (
          <div key={m.id} style={row}>
            {/* LEFT (avatar) */}
            {!isRight(m) && <div style={avatar}>👤</div>}

            {/* BUBBLE */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  ...bubble,
                  background: isRight(m) ? "#d2f1ff" : "#f0f2f5",
                  alignSelf: isRight(m) ? "flex-end" : "flex-start",
                }}
              >
                <div style={name}>
                  {isRight(m)
                    ? "Bạn"
                    : conversation.customer_name || "Khách"}
                </div>

                <div>{m.text}</div>

                <div style={time}>{formatTime(m.created_at)}</div>
              </div>

              {/* ACTION */}
              {!isRight(m) && (
                <div style={actionRow}>
                  <span
                    style={replyBtn}
                    onClick={() => setReplyingId(m.id)}
                  >
                    Trả lời
                  </span>
                </div>
              )}

              {/* REPLY BOX */}
              {replyingId === m.id && (
                <div style={replyBox}>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Trả lời bình luận..."
                    style={input}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleReply(m);
                    }}
                  />
                  <button
                    onClick={() => handleReply(m)}
                    style={btn}
                  >
                    {sending ? "..." : "Gửi"}
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT avatar */}
            {isRight(m) && <div style={avatar}>🧑</div>}
          </div>
        ))}

        <div ref={bottomRef} />
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
  padding: 10,
  borderBottom: "1px solid #eee",
  background: "#fff",
};

const postHeader = {
  fontWeight: "bold",
  marginBottom: 6,
};

const postContent = {
  background: "#f5f5f5",
  padding: 8,
  borderRadius: 8,
  fontSize: 13,
  whiteSpace: "pre-wrap",
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
  fontSize: 14,
};

const bubble = {
  padding: 8,
  borderRadius: 12,
  maxWidth: "75%",
  fontSize: 13,
};

const name = {
  fontSize: 11,
  fontWeight: "bold",
  marginBottom: 3,
  opacity: 0.6,
};

const time = {
  fontSize: 10,
  opacity: 0.5,
  marginTop: 4,
  textAlign: "right",
};

const actionRow = {
  fontSize: 11,
  marginTop: 4,
  marginLeft: 4,
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
  padding: 6,
  borderRadius: 6,
  border: "1px solid #ddd",
  fontSize: 13,
};

const btn = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  background: "#1877f2",
  color: "#fff",
};

const empty = {
  padding: 20,
  textAlign: "center",
};