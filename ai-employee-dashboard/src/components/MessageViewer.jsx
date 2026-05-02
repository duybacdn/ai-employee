import { useState } from "react";
import api from "../services/api";

export default function MessageViewer({ conversation }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  if (!conversation) {
    return <div style={empty}>Chọn cuộc hội thoại</div>;
  }

  const messages = conversation.messages || [];

  // ================= SEND =================
  const handleSend = async () => {
    if (!text.trim()) return;

    try {
      setSending(true);

      await api.post("/messages/send", {
        conversation_id: conversation.id,
        content: text,
      });

      // 🔥 append ngay UI (optimistic)
      conversation.messages.push({
        id: Date.now(),
        content: text,
        direction: "outbound",
        created_at: new Date().toISOString(),
      });

      setText("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // ================= UI =================
  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <div style={{ fontWeight: "bold" }}>
          {conversation.customer_name || "Khách"}
        </div>
      </div>

      {/* MESSAGES */}
      <div style={body}>
        {messages.map((m) => {
          const isMe = m.direction === "outbound";

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  ...bubble,
                  background: isMe ? "#d2f1ff" : "#f1f1f1",
                  alignSelf: isMe ? "flex-end" : "flex-start",
                }}
              >
                {/* 👤 tên người gửi */}
                <div style={name}>
                  {isMe ? "Bạn" : conversation.customer_name || "Khách"}
                </div>

                {/* nội dung */}
                <div>{m.content}</div>

                {/* time */}
                <div style={time}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT */}
      <div style={inputBox}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          style={input}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />

        <button onClick={handleSend} style={btn} disabled={sending}>
          Gửi
        </button>
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
  maxWidth: "70%",
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
  opacity: 0.4,
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
  cursor: "pointer",
};

const empty = {
  padding: 20,
  textAlign: "center",
};

/* ================= HELPER ================= */

const formatTime = (t) => {
  return new Date(t).toLocaleTimeString();
};