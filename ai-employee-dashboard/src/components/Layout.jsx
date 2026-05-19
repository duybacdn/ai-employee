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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const menu = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/conversations", label: "Conversations", icon: "💬" },
    { path: "/employees", label: "AI Employees", icon: "🤖" },
    { path: "/channels", label: "Channels", icon: "📡" },
    { path: "/knowledge", label: "Knowledge", icon: "📚" },
    { path: "/candidates", label: "Approvals", icon: "✅" },
    { path: "/profile", label: "My Account", icon: "👤" },

    ...(isSuperAdmin
      ? [
          {
            path: "/admin",
            label: "Manage Companies",
            icon: "🏢",
          },
        ]
      : []),
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const sidebarWidth = collapsed ? 84 : 260;

  return (
    <div style={styles.wrapper}>
      {/* MOBILE OVERLAY */}
      {isMobile && mobileOpen && (
        <div
          style={styles.overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        style={{
          ...styles.sidebar,
          width: sidebarWidth,
          left: isMobile ? (mobileOpen ? 0 : -320) : 0,
        }}
      >
        {/* LOGO */}
        <div style={styles.logoWrap}>
          <div style={styles.logoCircle}>AI</div>

          {!collapsed && (
            <div>
              <div style={styles.logoTitle}>AI Employee</div>
              <div style={styles.logoSub}>
                Management System
              </div>
            </div>
          )}
        </div>

        {/* COLLAPSE */}
        {!isMobile && (
          <button
            style={styles.collapseBtn}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? "→" : "←"}
          </button>
        )}

        {/* USER */}
        {!collapsed && (
          <div style={styles.userBox}>
            <div style={styles.userLabel}>
              Logged in as
            </div>

            <div style={styles.userEmail}>
              {user?.email || "Unknown"}
            </div>
          </div>
        )}

        {/* MENU */}
        <div style={styles.menu}>
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
                  ...styles.link,
                  ...(isActive ? styles.activeLink : {}),
                  justifyContent: collapsed
                    ? "center"
                    : "flex-start",
                }}
              >
                <span style={styles.icon}>{m.icon}</span>

                {!collapsed && (
                  <span>{m.label}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* FOOTER */}
        <div style={styles.footer}>
          <button
            style={styles.logoutBtn}
            onClick={handleLogout}
          >
            <span>🚪</span>

            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main
        style={{
          ...styles.content,
          marginLeft: isMobile ? 0 : sidebarWidth,
        }}
      >
        {/* MOBILE HEADER */}
        {isMobile && (
          <div style={styles.mobileHeader}>
            <button
              style={styles.menuBtn}
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>

            <div style={styles.mobileTitle}>
              AI Employee
            </div>
          </div>
        )}

        <div style={styles.pageContent}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    background: "#f4f7fb",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 999,
  },

  sidebar: {
    position: "fixed",
    top: 0,
    bottom: 0,

    background:
      "linear-gradient(180deg, #0f172a 0%, #111827 100%)",

    color: "#fff",

    padding: 18,

    display: "flex",
    flexDirection: "column",

    transition: "all 0.28s ease",

    zIndex: 1000,

    boxShadow:
      "8px 0 30px rgba(0,0,0,0.18)",
  },

  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },

  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,

    background:
      "linear-gradient(135deg,#3b82f6,#8b5cf6)",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    fontWeight: 700,
    fontSize: 18,

    flexShrink: 0,

    boxShadow:
      "0 8px 24px rgba(59,130,246,0.35)",
  },

  logoTitle: {
    fontSize: 18,
    fontWeight: 700,
  },

  logoSub: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
  },

  collapseBtn: {
    position: "absolute",
    top: 20,
    right: -14,

    width: 28,
    height: 28,

    borderRadius: "50%",

    border: "none",

    background: "#fff",

    cursor: "pointer",

    boxShadow:
      "0 4px 12px rgba(0,0,0,0.15)",

    fontWeight: 700,
  },

  userBox: {
    padding: 14,

    borderRadius: 18,

    background:
      "rgba(255,255,255,0.06)",

    border:
      "1px solid rgba(255,255,255,0.08)",

    marginBottom: 24,
  },

  userLabel: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 4,
  },

  userEmail: {
    fontSize: 13,
    fontWeight: 600,
    wordBreak: "break-word",
  },

  menu: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  link: {
    display: "flex",
    alignItems: "center",
    gap: 14,

    padding: "13px 14px",

    borderRadius: 16,

    color: "#dbe4ff",

    textDecoration: "none",

    fontSize: 14,
    fontWeight: 500,

    transition: "all 0.2s ease",
  },

  activeLink: {
    background:
      "linear-gradient(135deg,#2563eb,#7c3aed)",

    color: "#fff",

    boxShadow:
      "0 10px 24px rgba(37,99,235,0.28)",
  },

  icon: {
    fontSize: 18,
    minWidth: 20,
    textAlign: "center",
  },

  footer: {
    marginTop: 10,
  },

  logoutBtn: {
    width: "100%",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,

    padding: "13px 14px",

    borderRadius: 16,

    border: "none",

    background:
      "rgba(239,68,68,0.15)",

    color: "#ffb4b4",

    cursor: "pointer",

    fontSize: 14,
    fontWeight: 600,
  },

  content: {
    flex: 1,
    transition: "margin-left 0.28s ease",
    minWidth: 0,
  },

  mobileHeader: {
    height: 64,

    display: "flex",
    alignItems: "center",
    gap: 14,

    padding: "0 16px",

    background: "#fff",

    borderBottom: "1px solid #e5e7eb",

    position: "sticky",
    top: 0,

    zIndex: 100,
  },

  mobileTitle: {
    fontWeight: 700,
    fontSize: 16,
  },

  menuBtn: {
    width: 42,
    height: 42,

    borderRadius: 12,

    border: "none",

    background: "#f1f5f9",

    fontSize: 20,

    cursor: "pointer",
  },

  pageContent: {
    padding: 20,
  },
};