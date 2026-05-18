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
    console.log("MessageViewer received:", {
      conversation,
      highlightMessageId,
    });
  }, [conversation, highlightMessageId]);

  // load conversation
  useEffect(() => {
    if (!conversation?.id) return;

    setMessages(conversation.messages || []);
    shouldStickBottomRef.current = true;

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, 0);
  }, [conversation?.id]);

  // auto scroll bottom
  useEffect(() => {
    if (!shouldStickBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // polling
  useEffect(() => {
    if (!conversation?.id) return;

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
    const interval = setInterval(fetchLatest, 5000);

    return () => clearInterval(interval);
  }, [conversation?.id]);

  // highlight message
  useEffect(() => {
    if (!highlightMessageId) return;

    shouldStickBottomRef.current = false;
    scrollToMessage(highlightMessageId);
  }, [highlightMessageId, messages]);

  const scrollToMessage = (id, retry = 0) => {
    const el = document.getElementById(`msg-${id}`);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

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
        prev.map((m) =>
          m.id === tempId ? { ...m, id: res.data.id, status: "sent" } : m
        )
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
                {m.direction === "inbound"
                  ? conversation.customer_name || "Khách"
                  : "Bạn"}
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

const container = { display: "flex", flexDirection: "column", height: "100%" };
const header = { padding: 12, borderBottom: "1px solid #eee", background: "#fff" };
const body = { flex: 1, overflowY: "auto", padding: 10, background: "#f5f6f7" };
const bubble = { maxWidth: "75%", padding: 10, borderRadius: 14 };
const name = { fontSize: 12, marginBottom: 4 };
const textStyle = { whiteSpace: "pre-wrap" };
const time = { fontSize: 11, marginTop: 4 };
const inputBox = { display: "flex", padding: 8, borderTop: "1px solid #eee" };
const input = { flex: 1, padding: 10 };
const btn = { padding: "8px 14px" };
const empty = { padding: 20, textAlign: "center" };