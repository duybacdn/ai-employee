import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./KnowledgeManager.css";

const KnowledgeManager = () => {
  const navigate = useNavigate();
  const mountedRef = useRef(false);

  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  // FETCH
  // =====================
  const fetchKnowledge = async () => {
    try {
      setLoading(true);

      const res = await api.get("/knowledge/");

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
  }, []);

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
    };

    if (!payload.content) {
      alert("Content không được để trống");
      return;
    }

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

      alert(
        err.response?.data?.detail ||
          "Submit failed - kiểm tra API"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =====================
  // DELETE
  // =====================
  const handleDelete = async (item) => {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;

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
      alert("Sync failed");
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

      <div className="actions">
        <button onClick={openCreateModal}>Add</button>
        <button onClick={fetchKnowledge}>Refresh</button>
        <button onClick={handleResync} disabled={loadingSync}>
          {loadingSync ? "Syncing..." : "🔄 Sync"}
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <table className="knowledge-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Content</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {knowledgeItems.length === 0 && (
              <tr>
                <td colSpan="5">No data</td>
              </tr>
            )}

            {knowledgeItems.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.title}</td>
                <td>{item.content}</td>
                <td>
                  {new Date(item.created_at).toLocaleString()}
                </td>
                <td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MODAL */}
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
                  {submitting
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create"
                    : "Update"}
                </button>

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                >
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