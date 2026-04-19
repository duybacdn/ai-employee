import { useEffect, useMemo, useState } from "react";
import {
  getChannelEmployees,
  assignEmployeesBulk,
} from "../services/api";

export default function AssignModal({ channel, employees, onClose }) {
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load mapping
  useEffect(() => {
    if (!channel) return;

    getChannelEmployees(channel.id).then((data) => {
      const mapped = data.map((a) => {
        const emp = employees.find((e) => String(e.id) === String(a.employee_id));

        return {
          ...a,
          name: emp?.name || `AI (${a.employee_id?.slice(0, 6)})`, // 🔥 FIX fallback đẹp hơn
        };
      });

      setAssigned(
        mapped.sort((a, b) => a.priority - b.priority)
      );
    });
  }, [channel, employees]);

  // Available employees (not assigned)
  const available = useMemo(() => {
    if (!Array.isArray(employees)) return [];
    if (!Array.isArray(assigned)) return [];

    return employees.filter(
      (e) => !assigned.find((a) => a.employee_id === e.id)
    );
  }, [employees, assigned]);

  // Add employee
  const addEmployee = (emp) => {
    setAssigned([
      ...assigned,
      {
        employee_id: emp.id,
        name: emp.name,
        priority: assigned.length + 1,
        autoreply_mode: "auto",
        is_active: true,
      },
    ]);
  };

  // Remove employee
  const removeEmployee = (id) => {
    if (!window.confirm("Remove AI này?")) return;

    const newList = assigned.filter((a) => a.employee_id !== id);

    setAssigned(
      newList.map((a, i) => ({
        ...a,
        priority: i + 1,
      }))
    );
  };

  // Move up
  const moveUp = (index) => {
    if (index === 0) return;

    const newList = [...assigned];
    [newList[index - 1], newList[index]] = [
      newList[index],
      newList[index - 1],
    ];

    setAssigned(
      newList.map((a, i) => ({
        ...a,
        priority: i + 1,
      }))
    );
  };

  // Move down
  const moveDown = (index) => {
    if (index === assigned.length - 1) return;

    const newList = [...assigned];
    [newList[index + 1], newList[index]] = [
      newList[index],
      newList[index + 1],
    ];

    setAssigned(
      newList.map((a, i) => ({
        ...a,
        priority: i + 1,
      }))
    );
  };

  // Change mode
  const changeMode = (id, mode) => {
    setAssigned(
      assigned.map((a) =>
        a.employee_id === id ? { ...a, autoreply_mode: mode } : a
      )
    );
  };

  // Toggle active
  const toggleActive = (id) => {
    setAssigned(
      assigned.map((a) =>
        a.employee_id === id
          ? { ...a, is_active: !a.is_active }
          : a
      )
    );
  };

  // Save (bulk)
  const save = async () => {
    setLoading(true);

    await assignEmployeesBulk(channel.id, {
      employees: assigned.map((a) => ({
        employee_id: a.employee_id,
        priority: a.priority,
        autoreply_mode: a.autoreply_mode,
        is_active: a.is_active,
      })),
    });

    setLoading(false);
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2>Assign AI → {channel.name}</h2>

        {/* ASSIGNED */}
        <div style={section}>
          <h3>Assigned AI</h3>

          {assigned.length === 0 && (
            <p style={{ color: "#888" }}>Chưa có AI</p>
          )}

          {assigned.map((a, index) => (
            <div
              key={a.employee_id}
              style={{
                ...card,
                opacity: a.is_active ? 1 : 0.5,
              }}
            >
              <div style={row}>
                <div>
                  <b>{a.name}</b>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {a.priority === 1 ? "PRIMARY" : "Fallback"}
                  </div>
                </div>

                <div>
                  <button onClick={() => moveUp(index)}>↑</button>
                  <button onClick={() => moveDown(index)}>↓</button>
                </div>
              </div>

              <div style={row}>
                <span>Priority: {a.priority}</span>

                <select
                  value={a.autoreply_mode}
                  onChange={(e) =>
                    changeMode(a.employee_id, e.target.value)
                  }
                >
                  <option value="auto">Auto Reply</option>
                  <option value="review">Suggest (Need Approval)</option>
                  <option value="off">Off</option>
                </select>

                <label>
                  <input
                    type="checkbox"
                    checked={a.is_active}
                    onChange={() => toggleActive(a.employee_id)}
                  />
                  Active
                </label>

                <button
                  style={dangerBtn}
                  onClick={() => removeEmployee(a.employee_id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* AVAILABLE */}
        <div style={section}>
          <h3>Add AI</h3>

          {available.length === 0 && (
            <p style={{ color: "#888" }}>Tất cả AI đã được gán</p>
          )}

          {available.map((e) => (
            <div key={e.id} style={row}>
              {e.name}
              <button onClick={() => addEmployee(e)}>Add</button>
            </div>
          ))}
        </div>

        {/* ACTION */}
        <div style={footer}>
          <button style={primaryBtn} onClick={save} disabled={loading}>
            {loading ? "Saving..." : "💾 Save"}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ===== STYLE ===== */

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
};

const modal = {
  background: "#fff",
  padding: 20,
  margin: "40px auto",
  width: 600,
  borderRadius: 12,
};

const section = {
  marginBottom: 20,
};

const card = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 10,
  marginBottom: 10,
  background: "#fafafa",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 5,
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const primaryBtn = {
  background: "#4CAF50",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: 6,
  cursor: "pointer",
};

const dangerBtn = {
  background: "#e74c3c",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
};