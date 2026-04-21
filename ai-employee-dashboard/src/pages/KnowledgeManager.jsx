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

  const [filters, setFilters] = useState({
    company_id: "",
    employee_id: "",
    channel_id: "",
  });

  // =====================
  // INLINE EDIT STATE
  // =====================
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
  });

  // =====================
  // ACTION STATE
  // =====================
  const [loadingSync, setLoadingSync] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // =====================
  // AUTH
  // =====================
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login");
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
  // FETCH
  // =====================
  const fetchKnowledge = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams();
      if (filters.company_id) query.append("company_id", filters.company_id);
      if (filters.employee_id) query.append("employee_id", filters.employee_id);

      const url = `/knowledge/${query.toString() ? `?${query}` : ""}`;
      const res = await api.get(url);

      setKnowledgeItems(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchKnowledge();
    return () => (mountedRef.current = false);
  }, [filters]);

  // =====================
  // INLINE EDIT
  // =====================
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title || "",
      content: item.content || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", content: "" });
  };

  const saveEdit = async (id) => {
    try {
      setSavingId(id);

      await api.put(`/knowledge/${id}`, {
        title: editForm.title,
        content: editForm.content,
      });

      cancelEdit();
      fetchKnowledge();
    } catch (err) {
      alert(err.response?.data?.detail || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  // =====================
  // DELETE
  // =====================
  const handleDelete = async (id) => {
    if (!window.confirm("Delete?")) return;

    try {
      setDeletingId(id);
      await api.delete(`/knowledge/${id}`);
      fetchKnowledge();
    } catch (err) {
      alert("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  // =====================
  // SYNC
  // =====================
  const handleResync = async () => {
    if (!window.confirm("Sync all?")) return;

    try {
      setLoadingSync(true);
      const res = await api.post("/knowledge/resync");
      alert(res.data.message);
    } finally {
      setLoadingSync(false);
    }
  };

  // =====================
  // UI
  // =====================
  return (
    <div className="km">

      {/* HEADER */}
      <div className="km-header">
        <h2>Knowledge</h2>

        <div className="km-actions">
          <button onClick={handleResync}>
            {loadingSync ? "Sync..." : "Sync"}
          </button>
        </div>
      </div>

      {/* FILTER */}
      <div className="km-filter">
        <select
          value={filters.company_id}
          onChange={(e) =>
            setFilters((p) => ({ ...p, company_id: e.target.value }))
          }
        >
          <option value="">All Company</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.employee_id}
          onChange={(e) =>
            setFilters((p) => ({ ...p, employee_id: e.target.value }))
          }
        >
          <option value="">All Employee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      <div className="km-table">

        <div className="km-row km-head">
          <div className="col-title">Title</div>
          <div className="col-content">Content</div>
          <div className="col-action">Actions</div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p>{error}</p>}

        {knowledgeItems.map((item) => (
          <div className="km-row" key={item.id}>

            {/* TITLE */}
            <div className="col-title">
              {editingId === item.id ? (
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      title: e.target.value,
                    }))
                  }
                />
              ) : (
                <strong>{item.title}</strong>
              )}
            </div>

            {/* CONTENT */}
            <div className="col-content">
              {editingId === item.id ? (
                <textarea
                  rows={4}
                  value={editForm.content}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      content: e.target.value,
                    }))
                  }
                />
              ) : (
                <div className="text">{item.content}</div>
              )}
            </div>

            {/* ACTION */}
            <div className="col-action">

              {editingId === item.id ? (
                <>
                  <button onClick={() => saveEdit(item.id)}>
                    {savingId === item.id ? "Saving..." : "Save"}
                  </button>

                  <button onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(item)}>Edit</button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                  >
                    Delete
                  </button>
                </>
              )}

            </div>

          </div>
        ))}
      </div>

    </div>
  );
};

export default KnowledgeManager;