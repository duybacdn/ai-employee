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
      const data = JSON.parse(event.data);

      if (data.type === "new_message") {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    return () => ws.close();
  }, [conversation?.id]);

  // ================= SEND =================
  const handleSend = async () => {
    if (!text.trim() || sending) return;

    const tempId = "tmp_" + Date.now();

    const newMsg = {
      id: tempId,
      text,
      direction: "outbound",
      kind: "inbox",
      created_at: new Date().toISOString(),
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

  // ================= GROUP THREAD =================
  const buildThreads = (messages) => {
    const inbox = [];
    const commentMap = {};

    messages.forEach((m) => {
      if (m.kind === "comment") {
        if (!commentMap[m.post_id]) {
          commentMap[m.post_id] = [];
        }
        commentMap[m.post_id].push(m);
      } else {
        inbox.push(m);
      }
    });

    const threads = [];

    // inbox thread
    if (inbox.length) {
      threads.push({
        type: "inbox",
        messages: inbox,
      });
    }

    // comment threads
    Object.keys(commentMap).forEach((post_id) => {
      threads.push({
        type: "comment",
        post_id,
        messages: commentMap[post_id],
      });
    });

    return threads;
  };

  const threads = buildThreads(messages);

  // ================= RENDER =================
  const renderInbox = (msgs) =>
    msgs.map((m) => (
      <div key={m.id} style={bubbleWrap}>
        <div style={bubble(m.direction)}>
          {m.text}
        </div>
      </div>
    ));

  const renderCommentThread = (thread) => (
    <div key={thread.post_id} style={commentBox}>
      {/* POST HEADER */}
      <div style={postHeader}>
        📝 Bài viết #{thread.post_id?.slice(-6)}
      </div>

      {/* COMMENTS */}
      {thread.messages.map((m) => (
        <div key={m.id} style={commentBubble}>
          <div style={commentName}>
            {conversation.customer_name || "Khách"}
          </div>

          <div>{m.text}</div>

          <div style={time}>
            {new Date(m.created_at).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );

  if (!conversation) {
    return <div style={empty}>Chọn cuộc hội thoại</div>;
  }

  return (
    <div style={container}>
      <div style={header}>
        <b>{conversation.customer_name || "Khách"}</b>
      </div>

      <div style={body}>
        {threads.map((t) =>
          t.type === "inbox"
            ? renderInbox(t.messages)
            : renderCommentThread(t)
        )}

        <div ref={bottomRef} />
      </div>

      <div style={inputBox}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          style={input}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        <button onClick={handleSend} style={btn}>
          Gửi
        </button>
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const container = { display: "flex", flexDirection: "column", height: "100%" };
const header = { padding: 10, borderBottom: "1px solid #eee" };
const body = { flex: 1, overflowY: "auto", padding: 10 };
const inputBox = { display: "flex", gap: 6, padding: 8, borderTop: "1px solid #eee" };
const input = { flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6 };
const btn = { padding: "8px 12px", background: "#2c7be5", color: "#fff", border: "none", borderRadius: 6 };

const bubbleWrap = { display: "flex", marginBottom: 6 };
const bubble = (dir) => ({
  background: dir === "outbound" ? "#d2f1ff" : "#f1f1f1",
  padding: 8,
  borderRadius: 10,
  maxWidth: "70%",
});

const commentBox = {
  marginBottom: 12,
  borderLeft: "3px solid #1877f2",
  paddingLeft: 8,
};

const postHeader = {
  fontSize: 12,
  fontWeight: "bold",
  color: "#1877f2",
  marginBottom: 6,
};

const commentBubble = {
  background: "#fff",
  border: "1px solid #eee",
  padding: 8,
  borderRadius: 8,
  marginBottom: 6,
};

const commentName = { fontSize: 11, fontWeight: "bold", opacity: 0.6 };

const time = { fontSize: 10, opacity: 0.5, textAlign: "right" };

const empty = { padding: 20, textAlign: "center" };