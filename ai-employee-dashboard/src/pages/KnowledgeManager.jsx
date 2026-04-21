import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./KnowledgeManager.css";

const KnowledgeManager = () => {
  const navigate = useNavigate();
  const mountedRef = useRef(false);

  // =====================
  // DATA
  // =====================
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // =====================
  // FILTERS (NEW)
  // =====================
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [filters, setFilters] = useState({
    company_id: "",
    employee_id: "",
    channel_id: "",
    search: "",
  });

  // =====================
  // MODAL
  // =====================
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [currentItem, setCurrentItem] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });

  const [loadingSync, setLoadingSync] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // =====================
  // AUTH CHECK
  // =====================
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  // =====================
  // LOAD FILTER DATA (SUPERADMIN ONLY)
  // =====================
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [c, e] = await Promise.all([
          api.get("/companies/"),
          api.get("/employees/"),
        ]);

        setCompanies(c.data || []);
        setEmployees(e.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    loadMeta();
  }, []);

  // =====================
  // FETCH KNOWLEDGE (WITH FILTERS)
  // =====================
  const fetchKnowledge = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams();

      if (filters.company_id)
        query.append("company_id", filters.company_id);

      if (filters.employee_id)
        query.append("employee_id", filters.employee_id);

      if (filters.channel_id)
        query.append("channel_id", filters.channel_id);

      const url = `/knowledge/${query.toString() ? `?${query}` : ""}`;

      const res = await api.get(url);

      const safeData = Array.isArray(res.data) ? res.data : [];

      if (mountedRef.current) {
        setKnowledgeItems(safeData);
        setError(null);
      }
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        setError("Failed to fetch knowledge items.");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchKnowledge();

    return () => {
      mountedRef.current = false;
    };
  }, [filters]);

  // =====================
  // MODAL
  // =====================
  const openCreateModal = () => {
    setModalMode("create");
    setCurrentItem(null);
    setFormData({ title: "", content: "" });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setModalMode("edit");
    setCurrentItem(item);

    setFormData({
      title: item.title || "",
      content: item.content || "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;

    const confirmClose = window.confirm("Đóng mà không lưu?");
    if (!confirmClose) return;

    setModalOpen(false);
    setCurrentItem(null);
    setFormData({ title: "", content: "" });
  };

  // =====================
  // SUBMIT
  // =====================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      title: formData.title.trim(),
      content: formData.content.trim(),
      company_id: filters.company_id || undefined,
      employee_id: filters.employee_id || undefined,
    };

    try {
      setSubmitting(true);

      if (modalMode === "create") {
        await api.post("/knowledge/", payload);
      } else {
        await api.put(`/knowledge/${currentItem.id}`, payload);
      }

      closeModal();
      fetchKnowledge();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  // =====================
  // DELETE
  // =====================
  const handleDelete = async (item) => {
    if (!window.confirm("Delete this item?")) return;

    try {
      setDeletingId(item.id);

      await api.delete(`/knowledge/${item.id}`);

      fetchKnowledge();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  // =====================
  // SYNC
  // =====================
  const handleResync = async () => {
    if (!window.confirm("Sync toàn bộ knowledge?")) return;

    try {
      setLoadingSync(true);

      const res = await api.post("/knowledge/resync");

      alert(`Sync done: ${res.data.message}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSync(false);
    }
  };

  // =====================
  // UI
  // =====================
  return (
    <div className="knowledge-manager">
      <h2>Knowledge Manager</h2>

      {/* ================= FILTER BAR ================= */}
      <div className="filter-bar">
        <select
          value={filters.company_id}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              company_id: e.target.value,
            }))
          }
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filters.employee_id}
          onChange={(e) =>
            setFilters((p) => ({
              ...p,
              employee_id: e.target.value,
            }))
          }
        >
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <button onClick={fetchKnowledge}>Search</button>
      </div>

      {/* ================= ACTIONS ================= */}
      <div className="actions">
        <button onClick={openCreateModal}>Add</button>
        <button onClick={handleResync} disabled={loadingSync}>
          {loadingSync ? "Syncing..." : "Sync"}
        </button>
      </div>

      {/* ================= TABLE / MOBILE ================= */}
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="knowledge-grid">
          {knowledgeItems.length === 0 && <p>No data</p>}

          {knowledgeItems.map((item) => (
            <div key={item.id} className="knowledge-card">
              <h4>{item.title}</h4>
              <p className="content">{item.content}</p>

              <small>
                {new Date(item.created_at).toLocaleString()}
              </small>

              <div className="card-actions">
                <button onClick={() => openEditModal(item)}>
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= MODAL ================= */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>
              {modalMode === "create" ? "Add" : "Edit"}
            </h3>

            <form onSubmit={handleSubmit}>
              <input
                placeholder="Title"
                value={formData.title}
                disabled={submitting}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    title: e.target.value,
                  }))
                }
              />

              <textarea
                placeholder="Content"
                value={formData.content}
                disabled={submitting}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    content: e.target.value,
                  }))
                }
              />

              <div className="modal-actions">
                <button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </button>

                <button type="button" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeManager;