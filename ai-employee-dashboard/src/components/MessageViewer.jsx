import { useEffect, useRef, useMemo } from "react";
import MessageBubble from "./MessageBubble";

export default function MessageViewer({ conversation }) {
  const bottomRef = useRef(null);

  // =========================
  // SORT MESSAGES (SAFE)
  // =========================
  const sortedMessages = useMemo(() => {
    if (!conversation?.messages) return [];

    return [...conversation.messages].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
  }, [conversation?.messages]);

  // =========================
  // AUTO SCROLL (FIX CHUẨN)
  // =========================
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sortedMessages]);

  if (!conversation) {
    return <div style={{ padding: 20 }}>Select a conversation</div>;
  }

  return (
    <div
      style={{
        flex: 1,
        padding: "20px",
        overflowY: "auto",
        height: "100%", // ✅ FIX: không phá layout
      }}
    >
      {sortedMessages.length === 0 ? (
        <div>Chưa có tin nhắn</div>
      ) : (
        sortedMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))
      )}

      <div ref={bottomRef}></div>
    </div>
  );
}