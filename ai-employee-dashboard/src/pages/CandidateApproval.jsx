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
    status: "",
  });

  const [channels, setChannels] = useState([]);

  // =====================
  // LOAD CHANNELS
  // =====================
  useEffect(() => {
    api.get("/channels")
      .then(res => setChannels(res.data || []))
      .catch(() => setChannels([]));
  }, []);

  // =====================
  // FETCH
  // =====================
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

  // =====================
  // ACTIONS
  // =====================
  const handleApprove = async (id) => {
    const finalText =
      edited[id] ??
      candidates.find(c => c.id === id)?.draft_text ??
      "";

    if (!finalText.trim()) {
      alert("Reply không được rỗng");
      return;
    }

    try {
      await api.post(`/candidates/${id}/approve`, {
        final_text: finalText,
      });

      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Approve failed");
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/candidates/${id}/reject`);
      fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Reject failed");
    }
  };

  // =====================
  // FORMAT TIME
  // =====================
  const formatTime = (t) => {
    if (!t) return "-";
    const d = new Date(t);

    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}
     ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // =====================
  // STATUS RENDER
  // =====================
  const renderStatus = (c) => {
    return (
      <div className="ca-status-wrap">

        {/* MODE */}
        <span className={`ca-mode ${c.autoreply_mode}`}>
          {c.autoreply_mode || "-"}
        </span>

        {/* STATUS */}
        <span className={`ca-status ${c.status}`}>
          {c.status}
        </span>

        {/* SEND */}
        {c.status === "approved" && (
          <span className={`ca-send ${c.is_sent ? "sent" : "pending"}`}>
            {c.is_sent ? "Sent" : "Not sent"}
          </span>
        )}

        {c.status === "pending" && (
          <span className="ca-send waiting">
            Waiting
          </span>
        )}

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
          <option value="">All Status</option>
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
          <option value="">All Channels</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

      </div>

      {/* HEADER */}
      <div className="ca-header">
        <div className="col-time">Time</div>
        <div className="col-content">Content</div>
        <div className="col-status">Status</div>
        <div className="col-action">Action</div>
      </div>

      {/* LOADING */}
      {loading && <div>Loading...</div>}

      {/* ROW */}
      {candidates.map((c) => (
        <div className="ca-row" key={c.id}>

          {/* TIME */}
          <div className="col-time">
            {formatTime(c.created_at)}
          </div>

          {/* CONTENT */}
          <div className="col-content">
            <div className="ca-msg">
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

          {/* STATUS */}
          <div className="col-status">
            {renderStatus(c)}
          </div>

          {/* ACTION */}
          <div className="col-action">

            {c.status === "pending" ? (
              <>
                <button
                  className="ca-btn approve"
                  onClick={() => handleApprove(c.id)}
                >
                  Approve
                </button>

                <button
                  className="ca-btn reject"
                  onClick={() => handleReject(c.id)}
                >
                  Reject
                </button>
              </>
            ) : (
              <span className="ca-btn disabled">
                Done
              </span>
            )}

          </div>

        </div>
      ))}

    </div>
  );
}