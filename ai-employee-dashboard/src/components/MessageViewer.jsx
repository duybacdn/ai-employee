import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

export default function MessageViewer({ conversation }) {
  const bottomRef = useRef(null);

  // 👉 AUTO SCROLL
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  if (!conversation) {
    return <div style={{ padding: 20 }}>Select a conversation</div>;
  }

  // 👉 SORT theo thời gian (RẤT QUAN TRỌNG)
  const sortedMessages = [...conversation].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  return (
    <div
      style={{
        flex: 1,
        padding: "20px",
        overflowY: "auto",
        height: "100vh",
      }}
    >
      {sortedMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* 👇 điểm cuối để scroll */}
      <div ref={bottomRef}></div>
    </div>
  );
}