import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = user?.role === "superadmin";

  // detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menu = [
    { path: "/", label: "Dashboard" },
    { path: "/conversations", label: "Conversations" },
    { path: "/employees", label: "AI Employees" },
    { path: "/channels", label: "Channels" },
    { path: "/knowledge", label: "Knowledge" },
    { path: "/candidates", label: "Approvals" },
    { path: "/profile", label: "My Account" },
    ...(isSuperAdmin
      ? [{ path: "/admin", label: "Manage Companies & Users" }]
      : []),
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const sidebarWidth = collapsed ? 70 : 220;

  return (
    <div style={wrapper}>
      {/* MOBILE OVERLAY */}
      {isMobile && mobileOpen && (
        <div
          style={overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div
        style={{
          ...sidebar,
          width: sidebarWidth,
          left: isMobile ? (mobileOpen ? 0 : -250) : 0,
        }}
      >
        {/* TOP */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16 }}>
            {collapsed ? "🤖" : "🤖 AI System"}
          </h2>

          {/* TOGGLE */}
          {!isMobile && (
            <button
              style={toggleBtn}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? "👉" : "👈"}
            </button>
          )}
        </div>

        {/* USER */}
        {!collapsed && (
          <div style={userBox}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Logged in as
            </div>
            <div style={{ fontWeight: "bold" }}>
              {user?.email || "Unknown"}
            </div>
          </div>
        )}

        {/* MENU */}
        <div style={{ flex: 1 }}>
          {menu.map((m) => {
            const isActive =
              location.pathname === m.path ||
              location.pathname.startsWith(m.path + "/");

            return (
              <Link
                key={m.path}
                to={m.path}
                onClick={() => isMobile && setMobileOpen(false)}
                style={{
                  ...link,
                  background: isActive ? "#333" : "transparent",
                  textAlign: collapsed ? "center" : "left",
                }}
              >
                {collapsed ? "•" : m.label}
              </Link>
            );
          })}
        </div>

        {/* LOGOUT */}
        <button style={logoutBtn} onClick={handleLogout}>
          {collapsed ? "🚪" : "🚪 Logout"}
        </button>
      </div>

      {/* CONTENT */}
      <div
        style={{
          ...content,
          marginLeft: isMobile ? 0 : sidebarWidth,
        }}
      >
        {/* MOBILE HEADER */}
        {isMobile && (
          <div style={mobileHeader}>
            <button
              style={menuBtn}
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>
            <span>AI System</span>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}

/* =========================
   STYLES
========================= */

const wrapper = {
  display: "flex",
  height: "100vh",
  background: "#f5f6fa",
};

const sidebar = {
  position: "fixed",
  top: 0,
  bottom: 0,
  background: "#111",
  color: "#fff",
  padding: 15,
  display: "flex",
  flexDirection: "column",
  transition: "all 0.3s",
  zIndex: 1000,
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  zIndex: 999,
};

const userBox = {
  marginBottom: 20,
  padding: 10,
  borderRadius: 8,
  background: "#1f1f1f",
};

const link = {
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 6,
  textDecoration: "none",
  marginBottom: 6,
  display: "block",
  fontSize: 14,
};

const logoutBtn = {
  marginTop: 10,
  padding: 10,
  background: "#e74c3c",
  border: "none",
  borderRadius: 6,
  color: "#fff",
  cursor: "pointer",
};

const toggleBtn = {
  marginTop: 10,
  padding: 5,
  cursor: "pointer",
  borderRadius: 6,
};

const content = {
  flex: 1,
  padding: 20,
  overflow: "auto",
  transition: "margin-left 0.3s",
};

const mobileHeader = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 15,
};

const menuBtn = {
  fontSize: 20,
  background: "none",
  border: "none",
  cursor: "pointer",
};