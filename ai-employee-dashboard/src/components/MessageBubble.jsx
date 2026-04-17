export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: "10px",
      }}
    >
      <div
        style={{
          background: isUser ? "#007bff" : "#e5e5ea",
          color: isUser ? "#fff" : "#000",
          padding: "10px 14px",
          borderRadius: "16px",
          maxWidth: "60%",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}