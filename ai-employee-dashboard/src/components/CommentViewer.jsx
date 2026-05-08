import { useEffect, useState } from "react";
import api from "../services/api";

// ================= BUILD TREE =================
function buildCommentTree(comments) {
  const map = {};
  const roots = [];

  comments.forEach((c) => {
    map[c.id] = { ...c, children: [] };
  });

  comments.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) {
      map[c.parent_id].children.push(map[c.id]);
    } else {
      roots.push(map[c.id]);
    }
  });

  return roots;
}

// ================= COMPONENT =================
export default function CommentViewer({ conversation }) {
  const [comments, setComments] = useState([]);
  const [replyingId, setReplyingId] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // ================= LOAD =================
  useEffect(() => {
    console.log("🔥 conversation:", conversation);
    console.log("🔥 messages:", conversation?.messages);
    const list = (conversation?.messages || []).filter(
      (m) => m.kind === "comment"
    );
    console.log("🔥 comment list:", list);
    const tree = buildCommentTree(list);
    console.log("🔥 tree:", tree);
    setComments(tree);
  }, [conversation]);

  // ================= SEND =================
  const handleReply = async () => {
    if (!text.trim() || sending) return;

    const tempId = "tmp_" + Date.now();

    const newMsg = {
      id: tempId,
      text,
      direction: "outbound",
      kind: "comment",
      created_at: new Date().toISOString(),
      employee_name: "Bạn",
      parent_id: replyingId, // 🔥 QUAN TRỌNG
      children: [],
    };

    // 👉 add vào UI ngay (optimistic)
    setComments((prev) => {
      const flat = flattenTree(prev);
      flat.push(newMsg);
      return buildCommentTree(flat);
    });

    setText("");
    setReplyingId(null);

    try {
      setSending(true);

      const res = await api.post("/messages/send", {
        conversation_id: conversation.id,
        text,
        parent_id: replyingId, // 🔥 FIX
      });

      // update id thật
      setComments((prev) => {
        const flat = flattenTree(prev).map((m) =>
          m.id === tempId ? { ...m, id: res.data.id } : m
        );
        return buildCommentTree(flat);
      });
    } finally {
      setSending(false);
    }
  };

  // ================= UTIL =================
  function flattenTree(tree) {
    let result = [];

    function walk(nodes) {
      nodes.forEach((n) => {
        const { children, ...rest } = n;
        result.push(rest);
        if (children && children.length) walk(children);
      });
    }

    walk(tree);
    return result;
  }

  const formatTime = (t) =>
    new Date(t).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ================= RENDER ITEM =================
  function CommentItem({ c, level = 0 }) {
    return (
      <div style={{ marginLeft: level * 20, marginTop: 10 }}>
        <div style={commentRow}>
          <div style={avatar}>👤</div>

          <div style={{ flex: 1 }}>
            <div style={bubble}>
              <div style={name}>{c.employee_name}</div>
              <div>{c.text}</div>
            </div>

            <div style={meta}>
              {formatTime(c.created_at)} ·{" "}
              <span
                style={replyBtn}
                onClick={() => setReplyingId(c.id)}
              >
                Trả lời
              </span>
            </div>

            {/* BOX REPLY */}
            {replyingId === c.id && (
              <div style={replyBox}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Viết phản hồi..."
                  style={input}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReply();
                  }}
                />
                <button onClick={handleReply} style={btn}>
                  Gửi
                </button>
              </div>
            )}

            {/* CHILDREN */}
            {c.children?.map((child) => (
              <CommentItem
                key={child.id}
                c={child}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return <div style={empty}>Chọn hội thoại</div>;
  }

  return (
    <div style={container}>
      {/* POST */}
      <div style={postBox}>
        <div style={postContent}>
          {conversation.post_context || "Không có nội dung"}
        </div>
      </div>

      {/* COMMENTS */}
      <div style={body}>
        {comments.map((c) => (
          <CommentItem key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

/* ================= STYLE ================= */

const container = { display: "flex", flexDirection: "column", height: "100%" };

const postBox = {
  padding: 10,
  borderBottom: "1px solid #eee",
  background: "#fff",
};

const postContent = {
  background: "#f0f2f5",
  padding: 10,
  borderRadius: 10,
  fontSize: 14,
  whiteSpace: "pre-wrap",
};

const body = {
  flex: 1,
  overflowY: "auto",
  padding: 10,
  background: "#fafafa",
};

const commentRow = { display: "flex", gap: 8 };

const avatar = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#ddd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const bubble = {
  background: "#f0f2f5",
  padding: 8,
  borderRadius: 12,
  display: "inline-block",
  maxWidth: "80%",
};

const name = { fontWeight: "bold", fontSize: 12 };

const meta = {
  fontSize: 11,
  color: "#65676b",
  display: "flex",
  gap: 10,
  marginTop: 3,
};

const replyBtn = { cursor: "pointer", color: "#1877f2" };

const replyBox = { display: "flex", gap: 6, marginTop: 6 };

const input = {
  flex: 1,
  padding: 8,
  borderRadius: 20,
  border: "1px solid #ddd",
};

const btn = {
  padding: "6px 12px",
  borderRadius: 20,
  border: "none",
  background: "#1877f2",
  color: "#fff",
};

const empty = { padding: 20, textAlign: "center" };