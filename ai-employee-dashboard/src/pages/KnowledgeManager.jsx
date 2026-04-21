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

  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [filters, setFilters] = useState({
    company_id: "",
    employee_id: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
  });

  const [loadingSync, setLoadingSync] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

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

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      content: item.content,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id) => {
    try {
      setSavingId(id);

      await api.put(`/knowledge/${id}`, editForm);

      setEditingId(null);
      fetchKnowledge();
    } catch (err) {
      alert("Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete?")) return;

    try {
      setDeletingId(id);
      await api.delete(`/knowledge/${id}`);
      fetchKnowledge();
    } finally {
      setDeletingId(null);
    }
  };

  const handleResync = async () => {
    try {
      setLoadingSync(true);
      const res = await api.post("/knowledge/resync");
      alert(res.data.message);
    } finally {
      setLoadingSync(false);
    }
  };

  const handleAdd = async () => {
    const title = prompt("Title?");
    const content = prompt("Content?");

    if (!title || !content) return;

    await api.post("/knowledge/", { title, content });
    fetchKnowledge();
  };

  return (
    <div className="km">

      {/* HEADER */}
      <div className="km-header">
        <div>
          <h2>Knowledge Manager</h2>
        </div>

        <div className="km-actions">
          <button className="btn add" onClick={handleAdd}>
            + Add
          </button>

          <button className="btn sync" onClick={handleResync}>
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
          <option value="">All Employee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <button onClick={fetchKnowledge}>Search</button>
      </div>

      {/* TABLE */}
      <div className="km-table">

        {/* HEADER */}
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
                    setEditForm((p) => ({ ...p, title: e.target.value }))
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
                  value={editForm.content}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, content: e.target.value }))
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
                    {savingId === item.id ? "..." : "Save"}
                  </button>

                  <button onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(item)}>Edit</button>

                  <button
                    className="danger"
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