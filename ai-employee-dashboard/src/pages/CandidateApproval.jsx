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
    status: "all",
  });

  const [channels, setChannels] = useState([]);

  // =====================
  // LOAD CHANNELS
  // =====================
  useEffect(() => {
    api.get("/channels")
      .then(res => setChannels(res.data || []));
  }, []);

  // =====================
  // FETCH
  // =====================
  const fetchCandidates = async () => {
    setLoading(true);

    const query = new URLSearchParams();

    if (filters.status !== "all") {
      query.append("status", filters.status);
    }

    if (filters.company_id) {
      query.append("company_id", filters.company_id);
    }

    if (filters.channel_id) {
      query.append("channel_id", filters.channel_id);
    }

    const res = await api.get(`/candidates?${query.toString()}`);
    setCandidates(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCandidates();
  }, [filters]);

  // =====================
  // APPROVE
  // =====================
  const handleApprove = async (id) => {
    const finalText = edited[id];

    await api.post(`/candidates/${id}/approve`, {
      final_text: finalText,
    });

    fetchCandidates();
  };

  // =====================
  // REJECT
  // =====================
  const handleReject = async (id) => {
    await api.post(`/candidates/${id}/reject`);
    fetchCandidates();
  };

  // =====================
  // FORMAT TIME
  // =====================
  const formatTime = (t) => {
    const d = new Date(t);
    return `${d.getHours()}:${d.getMinutes()} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
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
          <option value="all">All</option>
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
        <div>STT</div>
        <div>Time</div>
        <div>Content</div>
        <div>Status</div>
        <div>Action</div>
      </div>

      {/* ROWS */}
      {loading && <div>Loading...</div>}

      {candidates.map((c, i) => (
        <div className="ca-row" key={c.id}>

          <div>{i + 1}</div>

          {/* TIME */}
          <div className="ca-time">
            {formatTime(c.created_at)}
          </div>

          {/* CONTENT */}
          <div className="ca-content">
            {c.message_text}

            <textarea
              value={edited[c.id] || c.draft_text}
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

            {c.status === "pending" && (
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
            )}

            {c.status !== "pending" && (
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