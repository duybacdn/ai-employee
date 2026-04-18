import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [filterStatus, setFilterStatus] = useState("all");

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, []);

  const reviewerId = user?.id;

  // =========================
  // FETCH
  // =========================
  const fetchCandidates = async () => {
    if (!token) return;

    try {
      setLoading(true);

      const res = await api.get("/candidates", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCandidates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch error:", err);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [token]);

  // =========================
  // APPROVE
  // =========================
  const handleApprove = async (id) => {
    if (!reviewerId || !token) {
      alert("User not logged in");
      return;
    }

    try {
      await api.post(
        `/candidates/${id}/approve`,
        {
          final_text: edited[id] || "",
          reviewer_id: reviewerId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      fetchCandidates();
    } catch (err) {
      console.error("Approve error:", err);
      alert("Approve failed!");
    }
  };

  // =========================
  // REJECT
  // =========================
  const handleReject = async (id) => {
    if (!token) {
      alert("User not logged in");
      return;
    }

    try {
      await api.post(
        `/candidates/${id}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      fetchCandidates();
    } catch (err) {
      console.error("Reject error:", err);
      alert("Reject failed!");
    }
  };

  // =========================
  // FILTER + PAGINATION
  // =========================
  const filteredCandidates = candidates.filter((c) =>
    filterStatus === "all" ? true : c.status === filterStatus
  );

  const totalPages = Math.ceil(filteredCandidates.length / pageSize);

  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // =========================
  // UI (GIỮ NGUYÊN)
  // =========================
  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h2>Candidate Approval</h2>

      <div style={{ marginBottom: 15 }}>
        <b>Filter by status:</b>{" "}
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <p>Total candidate(s): {filteredCandidates.length}</p>

      {!token && <p style={{ color: "red" }}>⚠ User not logged in</p>}
      {loading && <p>Loading...</p>}

      {paginatedCandidates.map((c) => (
        <div key={c.id} style={{ border: "1px solid #ddd", padding: 15 }}>
          <p>
            <b>User:</b> {c.message?.content || "—"}
          </p>

          <textarea
            value={edited[c.id] ?? c.draft_text}
            onChange={(e) =>
              setEdited({ ...edited, [c.id]: e.target.value })
            }
            style={{ width: "100%", height: 80 }}
          />

          <p>
            <b>Status:</b> {c.status}
          </p>

          {c.status === "pending" && user && (
            <div>
              <button onClick={() => handleApprove(c.id)}>Approve</button>
              <button onClick={() => handleReject(c.id)}>Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}