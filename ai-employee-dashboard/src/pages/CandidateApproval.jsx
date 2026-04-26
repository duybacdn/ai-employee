import { useEffect, useState } from "react";
import api from "../services/api";
import "./CandidateApproval.css";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    company_id: "",
    channel_id: "",
    status: "pending",
  });

  const [channels, setChannels] = useState([]);

  // LOAD CHANNEL
  useEffect(() => {
    api.get("/channels")
      .then(res => setChannels(res.data || []))
      .catch(() => setChannels([]));
  }, []);

  // FETCH
  const fetchCandidates = async () => {
    setLoading(true);

    try {
      const query = new URLSearchParams();

      if (filters.status) query.append("status", filters.status);
      if (filters.company_id) query.append("company_id", filters.company_id);
      if (filters.channel_id) query.append("channel_id", filters.channel_id);

      const res = await api.get(`/candidates?${query.toString()}`);
      setCandidates(Array.isArray(res.data) ? res.data : []);
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

  // ACTIONS
  const handleApprove = async (id) => {
    const finalText =
      edited[id] ??
      candidates.find(c => c.id === id)?.draft_text ??
      "";

    if (!finalText.trim()) {
      alert("Nội dung trả lời không được rỗng");
      return;
    }

    try {
      await api.post(`/candidates/${id}/approve`, {
        final_text: finalText,
      });

      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Approve lỗi");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/candidates/${id}/reject`);
      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Reject lỗi");
    }
  };

  // TIME
  const formatTime = (t) => {
    if (!t) return "-";
    const d = new Date(t);

    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}
     ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // STATUS BLOCK
  const renderStatus = (c) => {
    return (
      <div className="ca-status-wrap">

        {/* TRẠNG THÁI DUYỆT */}
        <span className={`ca-status ${c.status}`}>
          {c.status}
        </span>

        {/* TRẠNG THÁI GỬI */}
        <span
          className={`ca-send ${
            c.is_sent ? "sent" : "pending"
          }`}
        >
          {c.is_sent ? "Đã gửi" : "Chưa gửi"}
        </span>

      </div>
    );
  };

  return (
    <div className="ca-container">

      {/* FILTER */}
      <div className="ca-filter">

        <select
          value={filters.status}
          onChange={(e) =>
            setFilters({ ...filters, status: e.target.value })
          }
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={filters.channel_id}
          onChange={(e) =>
            setFilters({ ...filters, channel_id: e.target.value })
          }
        >
          <option value="">Tất cả kênh</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

      </div>

      {/* HEADER */}
      <div className="ca-header">
        <div>Thời gian</div>
        <div>Nội dung</div>
        <div>Trạng thái</div>
        <div>Hành động</div>
      </div>

      {loading && <div>Đang tải...</div>}

      {/* ROW */}
      {candidates.map((c) => (
        <div className="ca-row" key={c.id}>

          <div className="col-time">
            {formatTime(c.created_at)}
          </div>

          <div className="col-content">
            <div className={`ca-msg ${c.kind}`}>
              <span className="tag">
                {c.kind === "comment" ? "💬 Comment: " : "📩 Message: "}
              </span>
              {c.message_text}
            </div>

            <textarea
              value={edited[c.id] ?? c.draft_text ?? ""}
              onChange={(e) =>
                setEdited({
                  ...edited,
                  [c.id]: e.target.value,
                })
              }
            />
          </div>

          <div className="col-status">
            {renderStatus(c)}
          </div>

          <div className="col-action">
            {c.status === "pending" ? (
              <>
                <button
                  className="ca-btn approve"
                  onClick={() => handleApprove(c.id)}
                >
                  Duyệt
                </button>

                <button
                  className="ca-btn reject"
                  onClick={() => handleReject(c.id)}
                >
                  Từ chối
                </button>
              </>
            ) : (
              <span className="ca-btn disabled">
                Hoàn tất
              </span>
            )}
          </div>

        </div>
      ))}

    </div>
  );
}