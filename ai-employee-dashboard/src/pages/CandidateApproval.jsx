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
  // FETCH CANDIDATES
  // =====================
  const fetchCandidates = async () => {
    setLoading(true);

    try {
      const query = new URLSearchParams();

      if (filters.status) {
        query.append("status", filters.status);
      }

      if (filters.company_id) {
        query.append("company_id", filters.company_id);
      }

      if (filters.channel_id) {
        query.append("channel_id", filters.channel_id);
      }

      const res = await api.get(
        `/candidates?${query.toString()}`
      );

      setCandidates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch candidates error:", err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  // trigger fetch when filters change
  useEffect(() => {
    fetchCandidates();
  }, [filters.status, filters.company_id, filters.channel_id]);

  // =====================
  // APPROVE
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

  // =====================
  // REJECT
  // =====================
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

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const MM = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();

    return `${hh}:${mm} ${dd}/${MM}/${yyyy}`;
  };

  return (
    <div className="ca-container">

      {/* FILTER */}
      <div className="ca-filter">

        {/* STATUS */}
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

        {/* CHANNEL */}
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
        <div>STT</div>
        <div>Time</div>
        <div>Content</div>
        <div>Status</div>
        <div>Action</div>
      </div>

      {/* LOADING */}
      {loading && <div>Loading...</div>}

      {/* ROWS */}
      {candidates.map((c, i) => (
        <div className="ca-row" key={c.id}>

          {/* STT */}
          <div>{i + 1}</div>

          {/* TIME */}
          <div className="ca-time">
            {formatTime(c.created_at)}
          </div>

          {/* CONTENT */}
          <div className="ca-content">
            <div style={{ wordBreak: "break-word" }}>
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
          <div>
            <span className={`ca-status ${c.status}`}>
              {c.status}
            </span>
          </div>

          {/* ACTION */}
          <div className="ca-actions">

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