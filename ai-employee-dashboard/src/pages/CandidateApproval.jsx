import { useEffect, useState, useRef } from "react";
import api from "../services/api";
import "./CandidateApproval.css";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filters]);

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
      alert("Nội dung trả lời không được rỗng");
      return;
    }

    try {
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

    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selected) return;

    try {
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

    } catch (err) {
      console.error(err);
    }
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
            <option value="">Tất cả công ty</option>
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
            <option value="">Tất cả kênh</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="ca2-list">
          {candidates.map((c) => (
            <div
              key={c.id}
              className={`ca2-item ${selected?.id === c.id ? "active" : ""}`}
              onClick={() => setSelected(c)}
            >
              <div className="avatar">
                {c.kind === "comment" ? "📝" : "👤"}
              </div>

              <div className="content">
                <div className="top">
                  <div className="name">
                    {c.kind === "comment"
                      ? "Bình luận bài viết"
                      : c.customer_name || "Khách"}
                  </div>

                  <div className="time">
                    {new Date(c.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="preview">{c.message_text}</div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* CENTER */}
      <div className="ca2-center">

        {!selected && <div className="empty">Chọn item</div>}

        {selected?.kind === "inbox" && (
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

        {selected?.kind === "comment" && (
          <div className="comment-box">
            <div className="post">
              <b>📌 Bài viết</b>
              <div>{selected.post_context}</div>
            </div>

            <div className="comment">
              <b>💬 Bình luận</b>
              <div>{selected.message_text}</div>
            </div>
          </div>
        )}

      </div>

      {/* RIGHT */}
      <div className="ca2-right">
        {selected && (
          <>
            <div className="label">AI đề xuất</div>

            <textarea
              value={edited[selected.id] ?? selected.draft_text ?? ""}
              onChange={(e) =>
                setEdited({
                  ...edited,
                  [selected.id]: e.target.value,
                })
              }
            />

            <div className="actions">
              {selected.status === "pending" && (
                <>
                  <button onClick={handleApprove}>Duyệt</button>
                  <button onClick={handleReject}>Từ chối</button>
                </>
              )}
            </div>

            <div className="status-box">
              {selected.is_sent ? "Đã gửi" : "Chưa gửi"}
            </div>
          </>
        )}
      </div>

    </div>
  );
}