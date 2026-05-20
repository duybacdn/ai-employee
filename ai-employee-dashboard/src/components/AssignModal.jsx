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
        <div style={modalHeader}>
          <h3>🤖 Assign AI</h3>
          <span>{channel.name}</span>
        </div>

        {/* ASSIGNED */}
        <div style={section}>
          <b>Assigned AI</b>

          {assigned.length === 0 && (
            <div style={empty}>Chưa có AI</div>
          )}

          {assigned.map((a, index) => (
            <div key={a.employee_id} style={card}>
              <div style={row}>
                <div>
                  <b>{a.name}</b>
                  <div style={sub}>
                    {a.priority === 1 ? "Primary" : "Fallback"}
                  </div>
                </div>

                <div style={btnGroup}>
                  <button onClick={() => moveUp(index)}>↑</button>
                  <button onClick={() => moveDown(index)}>↓</button>
                </div>
              </div>

              <div style={row}>
                <select
                  value={a.autoreply_mode}
                  onChange={(e) =>
                    changeMode(a.employee_id, e.target.value)
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="review">Review</option>
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
          <b>Add AI</b>

          {available.map((e) => (
            <div key={e.id} style={row}>
              <span>{e.name}</span>
              <button onClick={() => addEmployee(e)}>Add</button>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div style={footer}>
          <button style={primaryBtn} onClick={save}>
            {loading ? "Saving..." : "💾 Save"}
          </button>

          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modal = {
  width: 650,
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 16,
  padding: 20,
};

const modalHeader = {
  marginBottom: 16,
};

const section = {
  marginBottom: 20,
};

const card = {
  background: "#f8fafc",
  padding: 12,
  borderRadius: 12,
  marginBottom: 10,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 6,
};

const sub = {
  fontSize: 12,
  color: "#666",
};

const btnGroup = {
  display: "flex",
  gap: 4,
};

const empty = {
  color: "#888",
  fontSize: 13,
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const primaryBtn = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const dangerBtn = {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 8,
  cursor: "pointer",
};