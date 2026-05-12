import { useEffect, useState } from "react";
import api from "../services/api";
import "./CandidateApproval.css";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    channel_id: "",
    status: "pending",
  });

  const [channels, setChannels] = useState([]);

  // ================= LOAD CHANNEL =================
  useEffect(() => {
    api.get("/channels")
      .then(res => setChannels(res.data || []))
      .catch(() => setChannels([]));
  }, []);

  // ================= FETCH =================
  const fetchCandidates = async () => {
    setLoading(true);

    try {
      const query = new URLSearchParams();

      if (filters.status) query.append("status", filters.status);
      if (filters.channel_id) query.append("channel_id", filters.channel_id);

      const res = await api.get(`/candidates?${query.toString()}`);

      const list = Array.isArray(res.data) ? res.data : [];

      setCandidates(list);

      if (!selected && list.length) {
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

  // ================= ACTION =================
  const handleApprove = async () => {
    if (!selected) return;

    const text =
      edited[selected.id] ?? selected.draft_text ?? "";

    if (!text.trim()) {
      alert("Không được để trống");
      return;
    }

    await api.post(`/candidates/${selected.id}/approve`, {
      final_text: text,
    });

    fetchCandidates();
  };

  const handleReject = async () => {
    if (!selected) return;

    await api.post(`/candidates/${selected.id}/reject`);
    fetchCandidates();
  };

  // ================= RENDER =================

  return (
    <div className="ca2-container">

      {/* LEFT */}
      <div className="ca2-left">

        <div className="ca2-filter">
          <select
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        {candidates.map((c) => (
          <div
            key={c.id}
            className={`ca2-item ${
              selected?.id === c.id ? "active" : ""
            }`}
            onClick={() => setSelected(c)}
          >
            <div className="name">
              {c.kind === "comment"
                ? "📝 Comment"
                : c.customer_name}
            </div>

            <div className="preview">
              {c.message_text}
            </div>

            <div className={`status ${c.status}`}>
              {c.status}
            </div>
          </div>
        ))}

      </div>

      {/* CENTER */}
      <div className="ca2-center">

        {!selected && <div>Chọn item</div>}

        {selected && selected.kind === "inbox" && (
          <div className="chat-box">
            {selected.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.direction === "outbound"
                    ? "msg right"
                    : "msg left"
                }
              >
                {m.text}
              </div>
            ))}
          </div>
        )}

        {selected && selected.kind === "comment" && (
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
              value={
                edited[selected.id] ?? selected.draft_text ?? ""
              }
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
                  <button onClick={handleApprove}>
                    Duyệt
                  </button>
                  <button onClick={handleReject}>
                    Từ chối
                  </button>
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