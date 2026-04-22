import { useEffect, useState } from "react";
import api from "../services/api";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [filterStatus, setFilterStatus] = useState("all");

  const [filters, setFilters] = useState({
    company_id: "",
    channel_id: "",
  });

  const [user, setUser] = useState(null);

  const [channels, setChannels] = useState([]);

  const totalPages = Math.max(
    1,
    Math.ceil(candidates.length / pageSize)
  );

  // =========================
  // USER
  // =========================
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // =========================
  // LOAD CHANNELS (NEW)
  // =========================
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await api.get("/channels");
        setChannels(res.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchChannels();
  }, []);

  // =========================
  // FETCH CANDIDATES
  // =========================
  const fetchCandidates = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams();

      if (filterStatus !== "all") {
        query.append("status", filterStatus);
      }

      if (user?.role === "superadmin") {
        if (filters.company_id) {
          query.append("company_id", filters.company_id);
        }
      } else if (user?.company_id) {
        query.append("company_id", user.company_id);
      }

      if (filters.channel_id) {
        query.append("channel_id", filters.channel_id);
      }

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
  }, [filterStatus, filters, user]);

  // =========================
  // APPROVE
  // =========================
  const handleApprove = async (id) => {
    const finalText =
      edited[id] ??
      candidates.find((c) => c.id === id)?.draft_text ??
      "";

    if (!finalText.trim()) return alert("Empty reply");

    try {
      await api.post(`/candidates/${id}/approve`, {
        final_text: finalText,
      });

      fetchCandidates();
    } catch (err) {
      alert("Approve failed");
    }
  };

  // =========================
  // REJECT
  // =========================
  const handleReject = async (id) => {
    try {
      await api.post(`/candidates/${id}/reject`);
      fetchCandidates();
    } catch {
      alert("Reject failed");
    }
  };

  // =========================
  // PAGINATION
  // =========================
  const paginated = candidates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="km">

      {/* HEADER */}
      <div className="km-header">
        <h2>Candidate Approval</h2>
      </div>

      {/* FILTER */}
      <div className="km-filter">

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        {/* COMPANY */}
        {user?.role === "superadmin" && (
          <input
            placeholder="Company ID"
            value={filters.company_id}
            onChange={(e) =>
              setFilters((p) => ({
                ...p,
                company_id: e.target.value,
              }))
            }
          />
        )}

        {/* CHANNEL COMBOBOX FIX */}
        <select
          value={filters.channel_id}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              channel_id: e.target.value,
            }))
          }
        >
          <option value="">All Channels</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name}
            </option>
          ))}
        </select>

        <button onClick={fetchCandidates}>Search</button>
      </div>

      {/* HEADER GRID */}
      <div className="km-table-header">
        <div>STT</div>
        <div>Candidate</div>
        <div>Content</div>
        <div>Status</div>
        <div>Actions</div>
      </div>

      {/* ROWS */}
      {loading && <p>Loading...</p>}

      {paginated.map((c, index) => (
        <div className="km-table-row" key={c.id}>

          {/* STT */}
          <div>
            {(currentPage - 1) * pageSize + index + 1}
          </div>

          {/* CANDIDATE */}
          <div>
            <div><b>{c.message_id}</b></div>
            <small>{c.created_at}</small>
          </div>

          {/* CONTENT */}
          <div className="km-content">
            <div style={{ wordBreak: "break-word" }}>
              {c.message_text}
            </div>
            <textarea
              value={edited[c.id] ?? c.draft_text}
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
            <span className={`status ${c.status}`}>
              {c.status}
            </span>
          </div>

          {/* ACTIONS */}
          <div className="col-action">
            {c.status === "pending" && (
              <>
                <button onClick={() => handleApprove(c.id)}>
                  Approve
                </button>

                <button onClick={() => handleReject(c.id)}>
                  Reject
                </button>
              </>
            )}
          </div>

        </div>
      ))}

    </div>
  );
}