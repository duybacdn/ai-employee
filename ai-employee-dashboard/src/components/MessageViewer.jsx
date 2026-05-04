import { useState, useEffect, useRef } from "react";
import api from "../services/api";

export default function MessageViewer({ conversation }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);
  const wsRef = useRef(null);

  // ================= LOAD =================
  useEffect(() => {
    setMessages(conversation?.messages || []);
  }, [conversation]);

  // ================= AUTO SCROLL =================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ================= REALTIME =================
  useEffect(() => {
    if (!conversation?.id) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/${conversation.id}`
    );

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "new_message") {
          setMessages((prev) => [...prev, data.message]);
        }

        if (data.type === "update_status") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.message_id
                ? { ...m, status: data.status }
                : m
            )
          );
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    ws.onclose = () => {
      console.log("WS disconnected");
    };

    return () => {
      ws.close();
    };
  }, [conversation?.id]);

  // ================= SEND =================
  const handleSend = async () => {
    if (!text.trim() || sending) return;

    const tempId = "tmp_" + Date.now();
    const now = new Date().toISOString();

    const newMsg = {
      id: tempId,
      text,
      direction: "outbound",
      employee_id: "me",
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

      // 🔥 replace temp → id thật
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                id: res.data.id,
                status: res.data.status || "sent",
              }
            : m
        )
      );
    } catch (err) {
      console.error("SEND FAIL:", err);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // ================= RETRY =================
  const handleRetry = async (msg) => {
    try {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: "pending" } : m
        )
      );

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text: msg.text,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, status: res.data.status || "sent" }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, status: "failed" } : m
        )
      );
    }
  };

  // ================= HELPER =================

  const isRight = (m) => m.direction === "outbound";

  const getSenderName = (m) => {
    if (m.direction === "inbound") {
      return conversation.customer_name || "Khách";
    }

    if (m.employee_id === "me") return "Bạn";

    return m.employee_name || "AI";
  };

  const getBubbleColor = (m) => {
    if (m.direction === "inbound") return "#f1f1f1";
    if (m.employee_id === "me") return "#d2f1ff";
    return "#fff3cd";
  };

  const getStatusIcon = (m) => {
    if (m.direction !== "outbound") return null;

    if (m.status === "pending") return "🟡";   // sending
    if (m.status === "failed") return "❌";    // fail
    return "✔️";                               // sent
  };

  if (!conversation) {
    return <div style={empty}>Chọn cuộc hội thoại</div>;
  }

  // ================= UI =================
  return (
    <div style={container}>
      <div style={header}>
        <b>{conversation.customer_name || "Khách"}</b>
      </div>

      <div style={body}>
        {messages.map((m) => (
          <div
            key={m.id}
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
              <div style={name}>{getSenderName(m)}</div>

              <div style={{ whiteSpace: "pre-wrap" }}>
                {m.text}
              </div>

              <div style={time}>
                {formatTime(m.created_at)} {getStatusIcon(m)}
              </div>

              {m.status === "failed" && (
                <div
                  style={retry}
                  onClick={() => handleRetry(m)}
                >
                  Gửi lại
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

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

/* STYLE giữ nguyên */

const container = { display: "flex", flexDirection: "column", height: "100%" };
const header = { padding: 10, borderBottom: "1px solid #eee", background: "#fff" };
const body = { flex: 1, overflowY: "auto", padding: 10 };
const bubble = { maxWidth: "75%", padding: 8, borderRadius: 10, fontSize: 13 };
const name = { fontSize: 11, fontWeight: "bold", marginBottom: 3, opacity: 0.6 };
const time = { fontSize: 10, opacity: 0.5, marginTop: 4, textAlign: "right" };
const retry = { marginTop: 4, fontSize: 11, color: "#e55353", cursor: "pointer" };
const inputBox = { display: "flex", padding: 8, borderTop: "1px solid #eee", gap: 6 };
const input = { flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ddd" };
const btn = { padding: "8px 12px", borderRadius: 6, border: "none", background: "#2c7be5", color: "#fff", cursor: "pointer" };
const empty = { padding: 20, textAlign: "center" };

const formatTime = (t) => new Date(t).toLocaleTimeString();