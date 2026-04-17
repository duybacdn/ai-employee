import { useEffect, useState } from "react";
import axios from "axios";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Filter
  const [filterStatus, setFilterStatus] = useState("all"); // all / pending / approved / rejected

  // ===== LẤY USER LOGIN =====
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
  // FETCH DATA
  // =========================
  const fetchCandidates = async () => {
    if (!token) return; // nếu chưa login thì không fetch
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:8000/api/v1/candidates", {
        headers: { Authorization: `Bearer ${token}` },
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
      await axios.post(
        `http://localhost:8000/api/v1/candidates/${id}/approve`,
        {
          final_text: edited[id] || "",
          reviewer_id: reviewerId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      fetchCandidates(); // reload data
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
      await axios.post(
        `http://localhost:8000/api/v1/candidates/${id}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      fetchCandidates();
    } catch (err) {
      console.error("Reject error:", err);
      alert("Reject failed!");
    }
  };

  // =========================
  // FILTERED + PAGINATED
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
  // UI
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
            setCurrentPage(1); // reset page
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

      {!loading && filteredCandidates.length === 0 && (
        <p style={{ fontStyle: "italic", color: "#777" }}>
          Không có candidate nào
        </p>
      )}

      {paginatedCandidates.map((c) => (
        <div
          key={c.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 15,
            marginBottom: 15,
            backgroundColor:
              c.status === "pending"
                ? "#fff8dc"
                : c.status === "approved"
                ? "#dcffe4"
                : "#ffe0e0",
          }}
        >
          <p>
            <b>👤 User:</b> {c.message?.content || "—"}
          </p>

          <p>
            <b>🤖 Draft:</b>
          </p>
          <textarea
            value={edited[c.id] ?? c.draft_text}
            onChange={(e) =>
              setEdited({
                ...edited,
                [c.id]: e.target.value,
              })
            }
            style={{ width: "100%", height: 80, marginBottom: 10 }}
          />

          <p>
            <b>Status:</b>{" "}
            <span
              style={{
                color:
                  c.status === "pending"
                    ? "#b8860b"
                    : c.status === "approved"
                    ? "green"
                    : "red",
                fontWeight: "bold",
              }}
            >
              {c.status.toUpperCase()}
            </span>
          </p>

          {c.status === "pending" && user && (
            <div style={{ marginTop: 10 }}>
              <button onClick={() => handleApprove(c.id)}>✅ Approve</button>
              <button
                onClick={() => handleReject(c.id)}
                style={{ marginLeft: 10 }}
              >
                ❌ Reject
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ marginTop: 20 }}>
          <b>Page:</b>{" "}
          {[...Array(totalPages)].map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx + 1)}
              style={{
                marginLeft: 5,
                fontWeight: currentPage === idx + 1 ? "bold" : "normal",
              }}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}