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
  // META
  // =====================
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [channels, setChannels] = useState([]);

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
  // LOAD META
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
  // FETCH KNOWLEDGE
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
      setError("Failed to fetch knowledge items.");
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
  // MODAL CONTROL
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

  // ✅ FIX: đóng modal đúng chuẩn (KHÔNG gọi lại save logic)
  const closeModal = () => {
    if (submitting) return;

    const ok = window.confirm("Bạn có muốn thoát mà chưa lưu?");
    if (!ok) return;

    resetModal();
  };

  // ✅ dùng chung reset
  const resetModal = () => {
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

      // ✅ FIX: save xong đóng luôn KHÔNG confirm
      resetModal();
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
    <div className="knowledge-page">

      {/* HEADER */}
      <div className="header">
        <h2>Knowledge Manager</h2>

        <div className="header-actions">
          <button onClick={openCreateModal} className="btn primary">
            + Add
          </button>

          <button onClick={handleResync} className="btn warning">
            {loadingSync ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className="filter-box">

        <select
          value={filters.company_id}
          onChange={(e) =>
            setFilters((p) => ({ ...p, company_id: e.target.value }))
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
            setFilters((p) => ({ ...p, employee_id: e.target.value }))
          }
        >
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <button onClick={fetchKnowledge} className="btn">
          Search
        </button>
      </div>

      {/* CONTENT */}
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <div className="grid">
        {knowledgeItems.map((item) => (
          <div className="card" key={item.id}>
            <div className="card-header">
              <strong>{item.title}</strong>
            </div>

            <div className="card-body">
              {item.content}
            </div>

            <div className="card-footer">
              <small>
                {new Date(item.created_at).toLocaleString()}
              </small>

              <div className="actions">
                <button onClick={() => openEditModal(item)}>
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="danger"
                >
                  {deletingId === item.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">

            <h3>{modalMode === "create" ? "Create" : "Edit"}</h3>

            <form onSubmit={handleSubmit}>

              <input
                placeholder="Title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, title: e.target.value }))
                }
              />

              <textarea
                placeholder="Content"
                value={formData.content}
                rows={6}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, content: e.target.value }))
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