import { useState, useEffect, useRef, useMemo } from "react";
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
      const data = JSON.parse(event.data);

      if (data.type === "new_message") {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    return () => ws.close();
  }, [conversation?.id]);

  // ================= GROUP COMMENT THREAD =================
  const groupedComments = useMemo(() => {
    const groups = {};

    messages.forEach((m) => {
      if (m.kind !== "comment") return;

      const key = m.post_id || "unknown_post";

      if (!groups[key]) {
        groups[key] = {
          post_id: key,
          messages: [],
        };
      }

      groups[key].messages.push(m);
    });

    return Object.values(groups);
  }, [messages]);

  const inboxMessages = messages.filter((m) => m.kind !== "comment");

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
  const formatTime = (t) => new Date(t).toLocaleTimeString();

  const isRight = (m) => m.direction === "outbound";

  const getBubbleColor = (m) => {
    if (m.direction === "inbound") return "#f1f1f1";
    return "#d2f1ff";
  };

  // ================= RENDER MESSAGE =================
  const renderMessage = (m) => (
    <div
      key={m.id}
      style={{
        display: "flex",
        justifyContent: isRight(m) ? "flex-end" : "flex-start",
        marginBottom: 8,
      }}
    >
      <div style={{ ...bubble, background: getBubbleColor(m) }}>
        <div style={name}>
          {m.direction === "inbound"
            ? conversation.customer_name || "Khách"
            : "Bạn"}
        </div>

        <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>

        <div style={time}>{formatTime(m.created_at)}</div>
      </div>
    </div>
  );

  // ================= COMMENT THREAD FACEBOOK STYLE =================
  const renderCommentThread = (group) => {
    return (
      <div key={group.post_id} style={commentBox}>
        {/* POST HEADER */}
        <div style={postHeader}>
          📝 Bài viết #{group.post_id?.slice(-6)}
        </div>

        {/* COMMENTS LIST */}
        {group.messages.map((c) => (
          <div key={c.id} style={commentBubble}>
            <div style={name}>
              {conversation.customer_name || "Khách"}
            </div>

            <div>{c.text}</div>

            <div style={time}>{formatTime(c.created_at)}</div>
          </div>
        ))}
      </div>
    );
  };

  // ================= MAIN =================
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
        {/* INBOX */}
        {inboxMessages.map(renderMessage)}

        {/* COMMENT THREADS */}
        {groupedComments.map(renderCommentThread)}

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
  cursor: "pointer",
};

const empty = {
  padding: 20,
  textAlign: "center",
};

const commentBox = {
  marginBottom: 14,
  borderLeft: "3px solid #1877f2",
  paddingLeft: 10,
};

const postHeader = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#1877f2",
  marginBottom: 6,
};

const commentBubble = {
  background: "#fff",
  padding: 8,
  borderRadius: 8,
  border: "1px solid #eee",
  marginBottom: 6,
};