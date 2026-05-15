import { useEffect, useState, useRef } from "react";
import api from "../services/api";
import "./CandidateApproval.css";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState({});

  const [filters, setFilters] = useState({
    company_id: "",
    channel_id: "",
    status: "pending",
  });

  const [companies, setCompanies] = useState([]);
  const [channels, setChannels] = useState([]);

  const chatRef = useRef(null);

  // ================= LOAD =================
  useEffect(() => {
    api.get("/companies")
      .then(res => setCompanies(res.data || []))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!filters.company_id) {
      setChannels([]);
      return;
    }

    api.get(`/channels?company_id=${filters.company_id}`)
      .then(res => setChannels(res.data || []))
      .catch(() => setChannels([]));
  }, [filters.company_id]);

  // ================= FETCH =================
  const fetchCandidates = async () => {
    try {
      const query = new URLSearchParams();

      if (filters.status) query.append("status", filters.status);
      if (filters.channel_id) query.append("channel_id", filters.channel_id);
      if (filters.company_id) query.append("company_id", filters.company_id);

      const res = await api.get(`/candidates?${query.toString()}`);
      const list = Array.isArray(res.data) ? res.data : [];

      setCandidates(list);

      if (selected) {
        const found = list.find(c => c.id === selected.id);
        if (found) setSelected(found);
      } else if (list.length) {
        setSelected(list[0]);
      }

    } catch (err) {
      console.error(err);
      setCandidates([]);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filters]);

  // ================= REALTIME =================
  useEffect(() => {
    const ws = new WebSocket(`wss://ai-employee-api.onrender.com/ws/global`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type !== "new_message") return;

      const msg = data.message;

      setCandidates(prev => {
        const list = [...prev];

        // tìm conversation
        const idx = list.findIndex(
          c => c.conversation_id === msg.conversation_id
        );

        if (idx === -1) return prev;

        const conv = { ...list[idx] };

        // push message mới
        conv.messages = [...(conv.messages || []), {
          id: msg.id,
          text: msg.text,
          direction: msg.direction,
          created_at: msg.created_at,
        }];

        // update message preview
        conv.message_text = msg.text;
        conv.created_at = msg.created_at;

        // mark unread lại
        conv.status = "pending";

        // move lên đầu
        list.splice(idx, 1);
        list.unshift(conv);

        return list;
      });
    };

    return () => ws.close();
  }, []);

  // ================= AUTO SCROLL =================
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [selected]);

  // ================= ACTION =================
  const handleApprove = async () => {
    if (!selected) return;

    const finalText =
      edited[selected.id] ?? selected.draft_text ?? "";

    if (!finalText.trim()) {
      alert("Không được để trống");
      return;
    }

    await api.post(`/candidates/${selected.id}/approve`, {
      final_text: finalText,
    });

    setCandidates(prev =>
      prev.map(c =>
        c.id === selected.id
          ? { ...c, status: "approved", is_sent: true }
          : c
      )
    );

    setSelected(prev => ({
      ...prev,
      status: "approved",
      is_sent: true,
    }));
  };

  const handleReject = async () => {
    if (!selected) return;

    await api.post(`/candidates/${selected.id}/reject`);

    setCandidates(prev =>
      prev.map(c =>
        c.id === selected.id
          ? { ...c, status: "rejected" }
          : c
      )
    );

    setSelected(prev => ({
      ...prev,
      status: "rejected",
    }));
  };

  // ================= GROUP =================
  const groupedList = Object.values(
    candidates.reduce((acc, c) => {
      const key = c.conversation_id;

      if (!acc[key]) {
        acc[key] = { ...c };
      } else {
        if (new Date(c.created_at) > new Date(acc[key].created_at)) {
          acc[key] = { ...acc[key], ...c };
        }
      }

      return acc;
    }, {})
  );

  // ================= HELPER =================
  const isUnread = (c) => c.status === "pending";

  const getPreviewText = (c) => {
    const lastMsg =
      c.messages?.[c.messages.length - 1]?.text || c.message_text || "";

    if (c.kind === "comment") {
      const post = (c.post_context || "").split("\n")[0].slice(0, 60);
      return `${c.customer_name || "Khách"} đã bình luận bài đăng: "${post}"`;
    }

    return `${c.customer_name || "Khách"}: "${lastMsg.slice(0, 60)}"`;
  };

  // ================= RENDER =================
  return (
    <div className="ca2-container">

      {/* LEFT */}
      <div className="ca2-left">

        <div className="ca2-filter">

          <select
            value={filters.company_id}
            onChange={(e) =>
              setFilters({
                ...filters,
                company_id: e.target.value,
                channel_id: "",
              })
            }
          >
            <option value="">Công ty</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.channel_id}
            onChange={(e) =>
              setFilters({ ...filters, channel_id: e.target.value })
            }
          >
            <option value="">Kênh</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

        </div>

        <div className="ca2-list">
          {groupedList.map((c) => (
            <div
              key={c.conversation_id}
              className={`ca2-item ${selected?.conversation_id === c.conversation_id ? "active" : ""}`}
              onClick={() => setSelected(c)}
            >
              <div className="avatar">
                {c.kind === "comment" ? "📝" : "👤"}
              </div>

              <div className="content">
                <div className="top">
                  <div className={`name ${isUnread(c) ? "bold" : ""}`}>
                    {c.customer_name || "Khách"}
                  </div>

                  <div className="time">
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className={`preview ${isUnread(c) ? "bold" : ""}`}>
                  {getPreviewText(c)}
                </div>
              </div>

              {isUnread(c) && <div className="dot" />}
            </div>
          ))}
        </div>

      </div>

      {/* RIGHT */}
      <div className="ca2-main">

        {!selected && <div className="empty">Chọn hội thoại</div>}

        {selected && (
          <>
            {selected.kind === "inbox" && (
              <div className="chat-box" ref={chatRef}>
                {(selected.messages || []).map((m) => (
                  <div
                    key={m.id}
                    className={`msg ${m.direction === "outbound" ? "right" : "left"}`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>
            )}

            {selected.kind === "comment" && (
              <div className="comment-box">
                <div className="post">{selected.post_context}</div>
                <div className="comment">{selected.message_text}</div>
              </div>
            )}

            <div className="reply-box">

              <textarea
                value={edited[selected.id] ?? selected.draft_text ?? ""}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    [selected.id]: e.target.value,
                  })
                }
              />

              {selected.status === "pending" && (
                <div className="actions">
                  <button onClick={handleApprove}>Duyệt</button>
                  <button onClick={handleReject}>Từ chối</button>
                </div>
              )}

              <div className="status-box">
                {selected.is_sent ? "Đã gửi" : "Chưa gửi"}
              </div>

            </div>
          </>
        )}

      </div>

    </div>
  );
}