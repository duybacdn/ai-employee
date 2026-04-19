import { useEffect, useState } from "react";
import api from "../services/api";

export default function CandidateApproval() {
  const [candidates, setCandidates] = useState([]);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [filterStatus, setFilterStatus] = useState("all");

  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // =========================
  // MOBILE DETECT
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
  // LOAD USER
  // =========================
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // =========================
  // FETCH
  // =========================
  const fetchCandidates = async () => {
    try {
      setLoading(true);

      const res = await api.get("/candidates");
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
  }, []);

  // =========================
  // APPROVE
  // =========================
  const handleApprove = async (id) => {
    if (!user) {
      alert("User not logged in");
      return;
    }

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
      console.error("Approve error:", err);
      alert("Approve failed!");
    }
  };

  // =========================
  // REJECT
  // =========================
  const handleReject = async (id) => {
    if (!user) {
      alert("User not logged in");
      return;
    }

    try {
      await api.post(`/candidates/${id}/reject`);
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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCandidates.length / pageSize)
  );

  // 🔥 FIX: tránh vượt page
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages]);

  const paginatedCandidates = filteredCandidates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // =========================
  // UI
  // =========================
  return (
    <div
      style={{
        padding: isMobile ? 10 : 20,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h2 style={{ fontSize: isMobile ? 18 : 24 }}>
        Candidate Approval
      </h2>

      {/* FILTER */}
      <div style={{ marginBottom: 15 }}>
        <b>Filter:</b>{" "}
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

      <p>Total: {filteredCandidates.length}</p>

      {loading && <p>Loading...</p>}

      {/* LIST */}
      {paginatedCandidates.map((c) => (
        <div
          key={c.id}
          style={{
            border: "1px solid #ddd",
            padding: isMobile ? 10 : 15,
            marginBottom: 10,
            borderRadius: 8,
            background:
              c.status === "pending" ? "#fff7e6" : "white",
          }}
        >
          <p style={{ marginBottom: 6 }}>
            <b>User:</b> {c.message_text || "—"}
          </p>

          <p style={{ fontSize: 12, color: "#888" }}>
            {c.created_at
              ? new Date(c.created_at).toLocaleString("vi-VN")
              : ""}
          </p>

          <textarea
            value={edited[c.id] ?? c.draft_text}
            onChange={(e) =>
              setEdited({ ...edited, [c.id]: e.target.value })
            }
            style={{
              width: "100%",
              height: isMobile ? 60 : 80,
              fontSize: 14,
              marginTop: 8,
            }}
          />

          <p>
            <b>Status:</b> {c.status}
          </p>

          {c.status === "pending" && user && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <button onClick={() => handleApprove(c.id)}>
                Approve
              </button>
              <button onClick={() => handleReject(c.id)}>
                Reject
              </button>
            </div>
          )}
        </div>
      ))}

      {/* PAGINATION */}
      <div style={{ marginTop: 20 }}>
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