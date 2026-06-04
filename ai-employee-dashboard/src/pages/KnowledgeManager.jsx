import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./KnowledgeManager.css";

function extractAnswer(content) {
  if (!content) return "";

  const marker = "Câu trả lời:";
  const index = content.indexOf(marker);

  if (index === -1) return content;

  return content.slice(index + marker.length).trim();
}

const KnowledgeManager = () => {
  const navigate = useNavigate();

  const addBoxRef = useRef(null);
  const headerRef = useRef(null);

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

  const [newItem, setNewItem] = useState({
    title: "",
    content: "",
    employee_id: "",
  });

  const [showAddBox, setShowAddBox] = useState(false);

  // AUTH
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

  // LOAD META + AUTO SELECT
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [c, e] = await Promise.all([
          api.get("/companies/"),
          api.get("/employees/"),
        ]);

        const companyList = c.data || [];
        const employeeList = e.data || [];

        setCompanies(companyList);
        setEmployees(employeeList);

        if (companyList.length > 0) {
          const firstCompany = companyList[0];

          const employeesOfCompany = employeeList.filter(
            (emp) => emp.company_id === firstCompany.id
          );

          setFilters({
            company_id: firstCompany.id,
            employee_id: employeesOfCompany[0]?.id || "",
          });

          setNewItem((p) => ({
            ...p,
            employee_id: employeesOfCompany[0]?.id || "",
          }));
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadMeta();
  }, []);

  // FETCH
  const fetchKnowledge = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams();

      if (filters.company_id) query.append("company_id", filters.company_id);
      if (filters.employee_id) query.append("employee_id", filters.employee_id);

      const url = `/knowledge/${query.toString() ? `?${query}` : ""}`;
      const res = await api.get(url);

      const data = Array.isArray(res.data) ? res.data : [];

      // 🔥 SORT FRONTEND (mới → cũ)
      data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setKnowledgeItems(data);

      setError(null);
    } catch {
      setError("Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!filters.company_id) return;
    fetchKnowledge();
  }, [filters]);

  const filteredEmployees = employees.filter(
    (e) => e.company_id === filters.company_id
  );

  // CRUD
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      content: extractAnswer(item.content), // 🔥 FIX
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    try {
      setSavingId(id);

      const item = knowledgeItems.find((x) => x.id === id);

      await api.put(`/knowledge/${id}`, {
        title: editForm.title,
        content: editForm.content,
        employee_id: item?.employee_id,   // 🔥 FIX NULL BUG
        company_id: item?.company_id,
      });

      setEditingId(null);
      fetchKnowledge();
    } catch (err) {
      console.error(err);
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

      const query = new URLSearchParams();

      if (filters.employee_id) {
        query.append("employee_id", filters.employee_id);
      }

      if (filters.company_id) {
        query.append("company_id", filters.company_id);
      }

      const url = `/knowledge/resync${query.toString() ? `?${query}` : ""}`;

      const res = await api.post(url);

      alert(res.data.message);
    } finally {
      setLoadingSync(false);
    }
  };

  // ADD
  const handleAdd = async () => {
    if (!newItem.title.trim() || !newItem.content.trim()) {
      alert("Nhập đủ Title + Content");
      return;
    }

    if (!newItem.employee_id) {
      alert("Vui lòng chọn AI Employee");
      return;
    }

    try {
      await api.post("/knowledge/", {
        title: newItem.title,
        content: newItem.content,
        company_id: filters.company_id,
        employee_id: newItem.employee_id,
      });

      setNewItem({
        title: "",
        content: "",
        employee_id: filteredEmployees[0]?.id || "",
      });

      fetchKnowledge();

      setShowAddBox(false);

      setTimeout(() => {
        headerRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      alert("Create failed");
    }
  };

  return (
    <div className="km">

      {/* HEADER */}
      <div className="km-header" ref={headerRef}>
        <div>
          <h2 className="km-title">Knowledge</h2>
          <div className="km-sub">Manage AI knowledge base</div>
        </div>

        <div className="km-actions">
          <button
            className="btn primary"
            onClick={() => {
              setShowAddBox(true);
              setTimeout(() => {
                addBoxRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
          >
            + Add
          </button>

          <button className="btn secondary" onClick={handleResync}>
            {loadingSync ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* ADD BOX */}
      {showAddBox && (
        <div className="km-card km-add-box" ref={addBoxRef}>
          <div className="km-card-title">➕ Add Knowledge</div>

          <div className="km-form">
            <select
              value={newItem.employee_id}
              onChange={(e) =>
                setNewItem((p) => ({ ...p, employee_id: e.target.value }))
              }
            >
              <option value="">Select AI</option>
              {filteredEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Title"
              value={newItem.title}
              onChange={(e) =>
                setNewItem((p) => ({ ...p, title: e.target.value }))
              }
            />

            <textarea
              placeholder="Content"
              value={newItem.content}
              onChange={(e) =>
                setNewItem((p) => ({ ...p, content: e.target.value }))
              }
            />
          </div>

          <div className="km-actions">
            <button className="btn primary" onClick={handleAdd}>
              Save
            </button>

            <button
              className="btn secondary"
              onClick={() =>
                setNewItem({
                  title: "",
                  content: "",
                  employee_id: "",
                })
              }
            >
              Clear
            </button>

            <button
              className="btn ghost"
              onClick={() => setShowAddBox(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MAIN CARD */}
      <div className="km-card">

        {/* FILTER */}
        <div className="km-filter">
          <select
            value={filters.company_id}
            onChange={(e) => {
              const companyId = e.target.value;
              const employeesOfCompany = employees.filter(
                (emp) => emp.company_id === companyId
              );

              setFilters({
                company_id: companyId,
                employee_id: employeesOfCompany[0]?.id || "",
              });

              setNewItem((p) => ({
                ...p,
                employee_id: employeesOfCompany[0]?.id || "",
              }));
            }}
          >
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
            <option value="">All AI</option>
            {filteredEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          <button className="btn secondary" onClick={fetchKnowledge}>
            Search
          </button>
        </div>

        {/* TABLE */}
        <div className="km-table">

          <div className="km-table-header">
            <div>#</div>
            <div>Title</div>
            <div>Content</div>
            <div>Actions</div>
          </div>

          {loading && <p>Loading...</p>}
          {error && <p>{error}</p>}

          {knowledgeItems.map((item, index) => (
            <div className="km-table-row" key={item.id}>

              <div className="km-center">{index + 1}</div>

              <div className="km-left">
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
                  item.title
                )}
              </div>

              <div className="km-left km-wrap">
                {editingId === item.id ? (
                  <textarea
                    value={editForm.content}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        content: e.target.value,
                      }))
                    }
                  />
                ) : (
                  extractAnswer(item.content)
                )}
              </div>

              <div className="km-actions-cell">
                {editingId === item.id ? (
                  <>
                    <button
                      className="btn primary"
                      onClick={() => saveEdit(item.id)}
                    >
                      Save
                    </button>

                    <button className="btn ghost" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn secondary"
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>

                    <button
                      className="btn danger"
                      onClick={() => handleDelete(item.id)}
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
    </div>
  );
}

export default KnowledgeManager;