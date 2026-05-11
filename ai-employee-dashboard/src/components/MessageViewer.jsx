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
    if (!conversation?.id) return;

    // đóng ws cũ nếu có
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(
      `wss://ai-employee-api.onrender.com/ws/${conversation.id}`
    );

    ws.onopen = () => {
      console.log("🟢 WS connected:", conversation.id);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // ================= NEW MESSAGE =================
      if (data.type === "new_message") {
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              m.id === data.message.id ||
              (m.text === data.message.text &&
              m.status === "pending")
          );

          if (exists) return prev;

          return [
            ...prev,
            {
              ...data.message,
              kind: "inbox",
            },
          ];
        });
      }

      // ================= UPDATE STATUS =================
      if (data.type === "update_status") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.message_id
              ? { ...m, status: data.status }
              : m
          )
        );
      }
    };

    ws.onclose = () => {
      console.log("🔴 WS disconnected");
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [conversation]);

  useEffect(() => {
    if (!conversation?.id) return;

    // chỉ set khi đổi conversation (reset)
    setMessages(conversation.messages || []);
  }, [conversation?.id]);

  // ================= AUTO SCROLL =================
  useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
    if (!conversation?.id) return;

    let interval;

    const fetchLatest = async () => {
      const msgs = await api.get(
        `/messages?conversation_id=${conversation.id}`
      );

      setMessages((prev) => {
        const map = new Map();

        prev.forEach((m) => map.set(m.id, m));
        msgs.data.forEach((m) => map.set(m.id, m));

        return Array.from(map.values()).sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
      });
    };

    // 🔥 polling mỗi 5s
    interval = setInterval(fetchLatest, 5000);

    return () => clearInterval(interval);
  }, [conversation]);

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
        kind: "inbox"
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

  const formatTime = (t) =>
    new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getBubbleColor = (m) => {
    if (m.direction === "inbound") return "#f0f2f5";
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
            id={`msg-${m.id}`}
            style={{
              display: "flex",
              justifyContent: isRight(m)
                ? "flex-end"
                : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                ...bubble,
                background: getBubbleColor(m),
              }}
            >
              {/* NAME */}
              <div style={name}>
                {m.direction === "inbound"
                  ? conversation.customer_name || "Khách"
                  : "Bạn"}
              </div>

              {/* TEXT (🔥 LUÔN CĂN TRÁI) */}
              <div style={textStyle}>
                {m.text}
              </div>

              {/* TIME */}
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

/* ================= STYLE ================= */

const container = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
};

const header = {
  padding: 12,
  borderBottom: "1px solid #eee",
  background: "#fff",
  fontSize: 14,
};

const body = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
  background: "#f5f6f7",
};

const bubble = {
  maxWidth: "75%",
  padding: "10px 12px",
  borderRadius: 14,
  fontSize: 14,
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const name = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  color: "#65676b",
};

const textStyle = {
  textAlign: "left",          // 🔥 QUAN TRỌNG
  whiteSpace: "pre-wrap",
};

const time = {
  fontSize: 11,
  color: "#65676b",
  marginTop: 4,
  textAlign: "left",          // 🔥 bỏ right
};

const inputBox = {
  display: "flex",
  padding: 8,
  borderTop: "1px solid #eee",
  gap: 6,
  background: "#fff",
};

const input = {
  flex: 1,
  padding: 10,
  borderRadius: 20,
  border: "1px solid #ddd",
  fontSize: 14,
};

const btn = {
  padding: "8px 14px",
  borderRadius: 20,
  border: "none",
  background: "#1877f2",
  color: "#fff",
  fontSize: 14,
};

const empty = {
  padding: 20,
  textAlign: "center",
};