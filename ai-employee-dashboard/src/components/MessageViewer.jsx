import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { formatVNDateTimeSmart } from "../utils/datetime";

export default function MessageViewer({ conversation, highlightMessageId }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);
  const bodyRef = useRef(null);
  const shouldStickBottomRef = useRef(true);

  useEffect(() => {
    if (!conversation?.id) return;

    setMessages(conversation.messages || []);
    shouldStickBottomRef.current = true;

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, 0);
  }, [conversation?.id]);

  useEffect(() => {
    if (!shouldStickBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversation?.id) return;

    let interval;

    const fetchLatest = async () => {
      const res = await api.get(`/messages?conversation_id=${conversation.id}`);

      setMessages((prev) => {
        const map = new Map();
        prev.forEach((m) => map.set(m.id, m));
        res.data.forEach((m) => map.set(m.id, m));

        return Array.from(map.values()).sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
      });
    };

    fetchLatest();
    interval = setInterval(fetchLatest, 5000);

    return () => clearInterval(interval);
  }, [conversation?.id]);

  useEffect(() => {
    if (!highlightMessageId) return;

    // ❗ chặn auto scroll xuống đáy
    shouldStickBottomRef.current = false;

    scrollToMessage(highlightMessageId);
  }, [highlightMessageId, messages]);

  const scrollToMessage = (id, retry = 0) => {
    const el = document.getElementById(`msg-${id}`);

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      el.style.background = "#fff3cd";

      setTimeout(() => {
        el.style.background = "";
      }, 1500);

      return;
    }

    if (retry < 10) {
      setTimeout(() => scrollToMessage(id, retry + 1), 100);
    }
  };

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

    shouldStickBottomRef.current = true;
    setMessages((prev) => [...prev, newMsg]);
    setText("");

    try {
      setSending(true);

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
        kind: "inbox",
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: res.data.id, status: "sent" } : m))
      );
    } finally {
      setSending(false);
    }
  };

  const handleBodyScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickBottomRef.current = gap < 40;
  };

  const isRight = (m) => m.direction === "outbound";

  const getBubbleColor = (m) => {
    if (m.direction === "inbound") return "#f0f2f5";
    return "#d2f1ff";
  };

  if (!conversation) {
    return <div style={empty}>Chọn cuộc hội thoại</div>;
  }

  return (
    <div style={container}>
      <div style={header}>
        <b>{conversation.customer_name || "Khách"}</b>
      </div>

      <div style={body} ref={bodyRef} onScroll={handleBodyScroll}>
        {messages.map((m) => (
          <div
            key={m.id}
            id={`msg-${m.id}`}
            style={{
              display: "flex",
              justifyContent: isRight(m) ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                ...bubble,
                background: getBubbleColor(m),
              }}
            >
              <div style={name}>
                {m.direction === "inbound" ? conversation.customer_name || "Khách" : "Bạn"}
              </div>

              <div style={textStyle}>{m.text}</div>

              <div style={time}>{formatVNDateTimeSmart(m.created_at)}</div>
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

const container = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial",
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
  textAlign: "left",
  whiteSpace: "pre-wrap",
};

const time = {
  fontSize: 11,
  color: "#65676b",
  marginTop: 4,
  textAlign: "left",
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
