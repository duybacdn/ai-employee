import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();

  const menu = [
    { path: "/", label: "Dashboard" },
    { path: "/conversations", label: "Conversations" },
    { path: "/employees", label: "AI Employees" },
    { path: "/channels", label: "Channels" },
    { path: "/knowledge", label: "Knowledge" },
    { path: "/candidates", label: "Approvals" },
    { path: "/admin", label: "Manage Companies & Users" },
  ];

  return (
    <div style={wrapper}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <h2 style={{ marginBottom: 20 }}>🤖 AI System</h2>

        {menu.map((m) => (
          <Link
            key={m.path}
            to={m.path}
            style={{
              ...link,
              background:
                location.pathname === m.path ? "#333" : "transparent",
            }}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* CONTENT */}
      <div style={content}>
        <Outlet />
      </div>
    </div>
  );
}

const wrapper = {
  display: "flex",
  height: "100vh",
  background: "#f5f6fa",
};

const sidebar = {
  width: 240,
  background: "#111",
  color: "#fff",
  padding: 20,
  display: "flex",
  flexDirection: "column",
};

const link = {
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 6,
  textDecoration: "none",
  marginBottom: 6,
};

const content = {
  flex: 1,
  padding: 20,
  overflow: "auto",
};