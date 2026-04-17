import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function SelectFacebookPages() {
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState([]);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawPages = params.get("pages");
    const company = params.get("company_id");

    if (rawPages) {
      const decoded = JSON.parse(decodeURIComponent(rawPages));
      setPages(decoded);
    }

    setCompanyId(company);
  }, []);

  const toggle = (page) => {
    const exist = selected.find((p) => p.id === page.id);
    if (exist) {
      setSelected(selected.filter((p) => p.id !== page.id));
    } else {
      setSelected([...selected, page]);
    }
  };

  const handleSubmit = async () => {
    if (selected.length === 0) {
      alert("Chọn ít nhất 1 page");
      return;
    }

    await fetch(`${API_BASE}/facebook/connect-pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, pages: selected }),
    });

    window.location.href = "/channels?connected=facebook";
  };

  return (
    <div style={container}>
      <h2 style={title}>Chọn Facebook Pages</h2>
      <p style={subtitle}>
        Chọn một hoặc nhiều page mà bạn muốn kết nối với hệ thống.
      </p>

      <div style={grid}>
        {pages.map((p) => {
          const isSelected = selected.some((s) => s.id === p.id);
          return (
            <div
              key={p.id}
              style={{ ...card, borderColor: isSelected ? "#1877F2" : "#ddd" }}
              onClick={() => toggle(p)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(p)}
                style={checkbox}
              />
              <div style={pageInfo}>
                <p style={pageName}>{p.name}</p>
                <p style={pageId}>ID: {p.id}</p>
              </div>
            </div>
          );
        })}
      </div>

      <button style={btn} onClick={handleSubmit}>
        🚀 Kết nối các Page đã chọn
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