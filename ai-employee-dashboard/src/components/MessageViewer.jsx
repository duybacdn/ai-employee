import { useState, useEffect, useRef } from "react";
import api from "../services/api";

export default function MessageViewer({ conversation }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);

  // ================= LOAD =================
  useEffect(() => {
    setMessages(conversation?.messages || []);
  }, [conversation]);

  // ================= AUTO SCROLL =================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ================= SEND =================
  const handleSend = async () => {
    if (!text.trim() || sending) return;

    const tempId = "tmp_" + Date.now();
    const now = new Date().toISOString();

    const newMsg = {
      id: tempId,
      text,
      direction: "outbound",
      kind: "inbox",
      created_at: now,
      status: "pending",
    };

    setMessages((prev) => [...prev, newMsg]);
    setText("");

    try {
      setSending(true);

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
      });

      setMessages((prev) =>
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

  const formatTime = (t) => new Date(t).toLocaleTimeString();

  const getBubbleColor = (m) => {
    if (m.direction === "inbound") return "#f1f1f1";
    return "#d2f1ff";
  };

  // ================= RENDER =================
  if (!conversation) {
    return <div style={empty}>Chọn cuộc hội thoại</div>;
  }

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <b>{conversation.customer_name || "Khách"}</b>
      </div>

      {/* BODY */}
      <div style={body}>
        {messages.map((m) => (
          <div
            key={m.id}
            id={`msg-${m.id}`} // 🔥 để scroll từ dashboard
            style={{
              display: "flex",
              justifyContent: isRight(m)
                ? "flex-end"
                : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                ...bubble,
                background: getBubbleColor(m),
              }}
            >
              <div style={name}>
                {m.direction === "inbound"
                  ? conversation.customer_name || "Khách"
                  : "Bạn"}
              </div>

              <div style={{ whiteSpace: "pre-wrap" }}>
                {m.text}
              </div>

              <div style={time}>
                {formatTime(m.created_at)}
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div style={inputBox}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          style={input}
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />

        <button onClick={handleSend} style={btn}>
          {sending ? "..." : "Gửi"}
        </button>
      </div>
    </div>
  );
}

/* ========== STYLE ========== */

const container = { display: "flex", flexDirection: "column", height: "100%" };

const header = {
  padding: 10,
  borderBottom: "1px solid #eee",
  background: "#fff",
};

const body = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
};

const bubble = {
  maxWidth: "75%",
  padding: 8,
  borderRadius: 10,
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

const inputBox = {
  display: "flex",
  padding: 8,
  borderTop: "1px solid #eee",
  gap: 6,
};

const input = {
  flex: 1,
  padding: 8,
  borderRadius: 6,
  border: "1px solid #ddd",
};

const btn = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "none",
  background: "#2c7be5",
  color: "#fff",
};

const empty = {
  padding: 20,
  textAlign: "center",
};