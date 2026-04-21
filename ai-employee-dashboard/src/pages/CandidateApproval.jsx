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

  const [isMobile, setIsMobile] = useState(false);

  const totalPages = Math.max(
    1,
    Math.ceil(candidates.length / pageSize)
  );

  // =========================
  // MOBILE
  // =========================
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // =========================
  // USER
  // =========================
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // =========================
  // FETCH
  // =========================
  const fetchCandidates = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams();

      // FILTER STATUS
      if (filterStatus !== "all") {
        query.append("status", filterStatus);
      }

      // FILTER COMPANY (SUPERADMIN ONLY)
      if (user?.role === "superadmin") {
        if (filters.company_id) {
          query.append("company_id", filters.company_id);
        }
      } else if (user?.company_id) {
        query.append("company_id", user.company_id);
      }

      // FILTER CHANNEL
      if (filters.channel_id) {
        query.append("channel_id", filters.channel_id);
      }

      const url = `/candidates?${query.toString()}`;

      const res = await api.get(url);

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
  // PAGINATION FIX
  // =========================
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [candidates]);

  const paginated = candidates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // =========================
  // UI
  // =========================
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
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

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

        <input
          placeholder="Channel ID"
          value={filters.channel_id}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              channel_id: e.target.value,
            }))
          }
        />

        <button onClick={fetchCandidates}>Search</button>
      </div>

      {/* TABLE HEADER */}
      <div className="km-table">

        <div className="km-row km-head">
          <div>Message</div>
          <div>Draft / Edit</div>
          <div>Actions</div>
        </div>

        {loading && <p>Loading...</p>}

        {/* ROWS */}
        {paginated.map((c) => (
          <div className="km-row" key={c.id}>

            {/* MESSAGE */}
            <div>
              <div><b>{c.message_text}</b></div>
              <small>
                {new Date(c.created_at).toLocaleString()}
              </small>
              <div><b>Status:</b> {c.status}</div>
            </div>

            {/* DRAFT EDIT */}
            <div>
              <textarea
                value={edited[c.id] ?? c.draft_text}
                onChange={(e) =>
                  setEdited({
                    ...edited,
                    [c.id]: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  minHeight: 100,
                }}
              />
            </div>

            {/* ACTIONS */}
            <div className="col-action">
              {c.status === "pending" && user && (
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

      {/* PAGINATION */}
      <div style={{ marginTop: 15 }}>
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          Prev
        </button>

        <span style={{ margin: "0 10px" }}>
          {currentPage} / {totalPages}
        </span>

        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

    </div>
  );
}