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

      if (filters.company_id)
        query.append("company_id", filters.company_id);

      if (filters.employee_id)
        query.append("employee_id", filters.employee_id);

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
      title: item.title,
      content: item.content,
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
      alert("Save failed");
    } finally {
      setSavingId(null);
    }
  };

  // =====================
  // DELETE
  // =====================
  const handleDelete = async (item) => {
    if (!window.confirm("Delete?")) return;

    try {
      setDeletingId(item.id);
      await api.delete(`/knowledge/${item.id}`);
      fetchKnowledge();
    } finally {
      setDeletingId(null);
    }
  };

  // =====================
  // SYNC
  // =====================
  const handleResync = async () => {
    if (!window.confirm("Sync?")) return;

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
    <div className="knowledge-page">

      {/* HEADER */}
      <div className="header">
        <h2>Knowledge Manager</h2>

        <button onClick={handleResync}>
          {loadingSync ? "Syncing..." : "Sync"}
        </button>
      </div>

      {/* FILTER */}
      <div className="filter-box">
        <select
          value={filters.company_id}
          onChange={(e) =>
            setFilters({ ...filters, company_id: e.target.value })
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
            setFilters({ ...filters, employee_id: e.target.value })
          }
        >
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="knowledge-table">
          <thead>
            <tr>
              <th style={{ width: "20%" }}>Title</th>
              <th>Content</th>
              <th style={{ width: "200px" }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {knowledgeItems.map((item) => {
              const isEditing = editingId === item.id;

              return (
                <tr key={item.id}>

                  {/* TITLE */}
                  <td>
                    {isEditing ? (
                      <input
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            title: e.target.value,
                          })
                        }
                      />
                    ) : (
                      item.title
                    )}
                  </td>

                  {/* CONTENT */}
                  <td>
                    {isEditing ? (
                      <textarea
                        value={editForm.content}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            content: e.target.value,
                          })
                        }
                      />
                    ) : (
                      item.content
                    )}
                  </td>

                  {/* ACTIONS */}
                  <td>
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(item.id)}>
                          {savingId === item.id ? "..." : "Save"}
                        </button>

                        <button onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(item)}>
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      )}

    </div>
  );
};

export default KnowledgeManager;