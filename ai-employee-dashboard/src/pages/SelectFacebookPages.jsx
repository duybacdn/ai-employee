import { useEffect, useState } from "react";
import api from "../services/api";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function SelectFacebookPages() {
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState([]);
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(false);

  // =====================
  // INIT DATA
  // =====================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const rawPages = params.get("pages");
    const company = params.get("company_id");

    if (company) setCompanyId(company);

    if (rawPages) {
      try {
        const decoded = JSON.parse(decodeURIComponent(rawPages));
        setPages(decoded || []);
      } catch (err) {
        console.error("Invalid pages data:", err);
      }
    }
  }, []);

  // =====================
  // TOGGLE SELECT
  // =====================
  const toggle = (page) => {
    const exist = selected.find((p) => p.id === page.id);

    if (exist) {
      setSelected(selected.filter((p) => p.id !== page.id));
    } else {
      setSelected([...selected, page]);
    }
  };

  // =====================
  // SUBMIT
  // =====================
  const handleSubmit = async () => {
    if (!companyId) {
      alert("Missing company_id");
      return;
    }

    if (selected.length === 0) {
      alert("Chọn ít nhất 1 page");
      return;
    }

    try {
      setLoading(true);

      await api.post("/facebook/connect-pages", {
        company_id: companyId,
        pages: selected,
      });

      window.location.href = "/channels?connected=facebook";
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.detail || "Connect pages failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <h2 style={title}>Chọn Facebook Pages</h2>

      <p style={subtitle}>
        Chọn một hoặc nhiều page để kết nối với hệ thống
      </p>

      <div style={grid}>
        {pages.map((p) => {
          const isSelected = selected.some((s) => s.id === p.id);

          return (
            <div
              key={p.id}
              style={{
                ...card,
                borderColor: isSelected ? "#1877F2" : "#ddd",
              }}
              onClick={() => toggle(p)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(p)}
              />

              <div style={pageInfo}>
                <p style={pageName}>{p.name}</p>
                <p style={pageId}>ID: {p.id}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        style={{
          ...btn,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading
          ? "Đang kết nối..."
          : "🚀 Kết nối các Page đã chọn"}
      </button>
    </div>
  );
}

/* ===== STYLE ===== */
const container = { padding: 20, maxWidth: 900, margin: "0 auto" };
const title = { fontSize: 28, fontWeight: "bold", marginBottom: 5 };
const subtitle = { fontSize: 14, color: "#666", marginBottom: 20 };
const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
  gap: 15,
};
const card = {
  display: "flex",
  alignItems: "center",
  padding: 15,
  border: "2px solid #ddd",
  borderRadius: 10,
  cursor: "pointer",
  transition: "all 0.2s",
  background: "#fff",
};
const checkbox = { width: 20, height: 20 };
const pageInfo = { marginLeft: 12 };
const pageName = { fontWeight: "bold", fontSize: 16, margin: 0 };
const pageId = { fontSize: 12, color: "#888", margin: 0 };
const btn = {
  marginTop: 25,
  padding: "12px 20px",
  background: "#1877F2",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 16,
  fontWeight: "bold",
};