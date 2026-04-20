import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isSuperAdmin = user?.role === "superadmin";

  const menu = [
    { path: "/", label: "Dashboard" },
    { path: "/conversations", label: "Conversations" },
    { path: "/employees", label: "AI Employees" },
    { path: "/channels", label: "Channels" },
    { path: "/knowledge", label: "Knowledge" },
    { path: "/candidates", label: "Approvals" },

    // 🔥 user nào cũng có
    { path: "/profile", label: "My Account" },

    // 🔥 chỉ superadmin
    ...(isSuperAdmin
      ? [{ path: "/admin", label: "Manage Companies & Users" }]
      : []),
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div style={wrapper}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <h2 style={{ marginBottom: 20 }}>🤖 AI System</h2>

        {/* USER INFO */}
        <div style={userBox}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Logged in as
          </div>
          <div style={{ fontWeight: "bold" }}>
            {user?.email || "Unknown"}
          </div>
        </div>

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
                style={{
                  ...link,
                  background: isActive ? "#333" : "transparent",
                }}
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        {/* LOGOUT */}
        <button style={logoutBtn} onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>

      {/* CONTENT */}
      <div style={content}>
        <Outlet />
      </div>
    </div>
  );
}

/* styles */
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

const content = {
  flex: 1,
  padding: 20,
  overflow: "auto",
};