import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./KnowledgeManager.css";

const KnowledgeManager = () => {
  const navigate = useNavigate();

  // 🔥 REF SCROLL
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
  });

  // =========================
  // AUTH
  // =========================
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

  // =========================
  // LOAD META + AUTO SELECT
  // =========================
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
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadMeta();
  }, []);

  // =========================
  // FETCH
  // =========================
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

  // =========================
  // FILTER EMPLOYEE
  // =========================
  const filteredEmployees = employees.filter(
    (e) => e.company_id === filters.company_id
  );

  // =========================
  // CRUD
  // =========================
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      content: item.content,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    try {
      setSavingId(id);
      await api.put(`/knowledge/${id}`, editForm);
      setEditingId(null);
      fetchKnowledge();
    } catch {
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

  // =========================
  // ADD
  // =========================
  const handleAdd = async () => {
    if (!newItem.title.trim() || !newItem.content.trim()) {
      alert("Nhập đủ Title + Content");
      return;
    }

    try {
      await api.post("/knowledge/", {
        ...newItem,
        company_id: filters.company_id,
        employee_id: filters.employee_id,
      });

      setNewItem({ title: "", content: "" });

      fetchKnowledge();

      // 🔥 SCROLL LÊN HEADER SAU KHI ADD
      headerRef.current?.scrollIntoView({ behavior: "smooth" });

    } catch {
      alert("Create failed");
    }
  };

  return (
    <div className="km">

      {/* HEADER */}
      <div className="km-header" ref={headerRef}>
        <h2>Knowledge Manager</h2>

        <div className="km-actions">
          <button
            className="btn add"
            onClick={() =>
              addBoxRef.current?.scrollIntoView({ behavior: "smooth" })
            }
          >
            + Add
          </button>

          <button className="btn sync" onClick={handleResync}>
            {loadingSync ? "Sync..." : "Sync"}
          </button>
        </div>
      </div>

      {/* ADD */}
      <div className="km-add-box" ref={addBoxRef}>
        <h3>➕ Thêm Knowledge</h3>

        <input
          placeholder="Tiêu đề"
          value={newItem.title}
          onChange={(e) =>
            setNewItem((p) => ({ ...p, title: e.target.value }))
          }
        />

        <textarea
          placeholder="Nội dung"
          value={newItem.content}
          onChange={(e) =>
            setNewItem((p) => ({ ...p, content: e.target.value }))
          }
        />

        <div className="km-actions">
          <button onClick={handleAdd}>Add</button>
          <button onClick={() => setNewItem({ title: "", content: "" })}>
            Clear
          </button>
        </div>
      </div>

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
          <option value="">All Employee</option>
          {filteredEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <button onClick={fetchKnowledge}>Search</button>
      </div>

      {/* TABLE */}
      <div className="km-table">

        <div className="km-row km-head">
          <div className="col-index">#</div>
          <div className="col-title">Title</div>
          <div className="col-content">Content</div>
          <div className="col-action">Actions</div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p>{error}</p>}

        {knowledgeItems.map((item, index) => (
          <div className="km-row" key={item.id}>

            <div className="col-index">{index + 1}</div>

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