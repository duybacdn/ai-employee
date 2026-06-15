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
  const hasScrolledRef = useRef(false);

  const [attachments, setAttachments] = useState([]);
  
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
      if (!highlightMessageId) {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      }
    }, 0);
  }, [conversation?.id]);

  // auto scroll bottom
  useEffect(() => {
    if (!shouldStickBottomRef.current) return;

    // ❗ nếu đang highlight thì KHÔNG auto scroll
    if (highlightMessageId && !hasScrolledRef.current) return;

    bottomRef.current?.scrollIntoView({ behavior: "auto" });
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
    if (hasScrolledRef.current) return;

    shouldStickBottomRef.current = false;

    requestAnimationFrame(() => {
      scrollToMessage(highlightMessageId);
      hasScrolledRef.current = true;
    });
  }, [highlightMessageId, messages.length]);

  useEffect(() => {
    hasScrolledRef.current = false;
    shouldStickBottomRef.current = true;
  }, [conversation?.id]);

  const scrollToMessage = (id, retry = 0) => {
    const container = bodyRef.current;
    const el = container?.querySelector(`#msg-${id}`);

    if (el && container) {
      const offsetTop = el.offsetTop;
      const containerHeight = container.clientHeight;
      const elHeight = el.clientHeight;

      const scrollTop = offsetTop - containerHeight / 2 + elHeight / 2;

      container.scrollTo({
        top: scrollTop,
        behavior: "auto", // ❗ KHÔNG dùng smooth
      });

      el.style.background = "#fff3cd";

      setTimeout(() => {
        el.style.background = "";
      }, 1200);

      return;
    }

    if (retry < 10) {
      setTimeout(() => scrollToMessage(id, retry + 1), 80);
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && attachments.length === 0) || sending) return;

    const tempId = "tmp_" + Date.now();
    const now = new Date().toISOString();

    const newMsg = {
      id: tempId,
      text,
      attachments,
      direction: "outbound",
      kind: "inbox",
      created_at: now,
      status: "pending",
    };

    shouldStickBottomRef.current = true;
    setMessages((prev) => [...prev, newMsg]);
    setText("");
    setAttachments([]);

    try {
      setSending(true);

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
        attachments,
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

  const handleSelectFile = (e) => {
    const files = Array.from(e.target.files || []);

    const newAttachments = files.map((file) => {
      let type = "file";

      if (file.type.startsWith("image")) type = "image";
      else if (file.type.startsWith("video")) type = "video";
      else if (file.type.startsWith("audio")) type = "audio";

      return {
        type,
        url: URL.createObjectURL(file),
      };
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
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

              {m.attachments?.map((att, i) => {
                if (att.type === "image") {
                  return <img key={i} src={att.url} style={{ maxWidth: 200, borderRadius: 8 }} />;
                }

                if (att.type === "video") {
                  return <video key={i} src={att.url} controls style={{ maxWidth: 200 }} />;
                }

                if (att.type === "audio") {
                  return <audio key={i} src={att.url} controls />;
                }

                return (
                  <a key={i} href={att.url} target="_blank">
                    📎 File
                  </a>
                );
              })}
              <div style={time}>{formatVNDateTimeSmart(m.created_at)}</div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      <div style={inputBox}>
        <input
          type="file"
          multiple
          onChange={handleSelectFile}
        />
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