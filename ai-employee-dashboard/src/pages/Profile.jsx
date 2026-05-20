import { useState } from "react";
import api from "../services/api";

export default function Profile() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [password, setPassword] = useState("");

  const handleChangePassword = async () => {
    if (!password) return alert("Nhập mật khẩu");

    try {
      await api.post(`/admin/users/${user.id}/reset-password`, {
        password,
      });

      alert("Đổi mật khẩu thành công");
      setPassword("");
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={{ marginBottom: 4 }}>My Account</h2>
          <div style={styles.subText}>
            Manage your account & security
          </div>
        </div>
      </div>

      {/* CARD */}
      <div style={styles.card}>
        {/* USER INFO */}
        <div style={styles.section}>
          <div style={styles.label}>Email</div>
          <div style={styles.value}>{user.email}</div>
        </div>

        {/* PASSWORD */}
        <div style={styles.section}>
          <div style={styles.label}>Change Password</div>

          <input
            type="password"
            placeholder="Enter new password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          <button
            style={styles.primaryBtn}
            onClick={handleChangePassword}
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: 20,
    maxWidth: 600,
  },

  header: {
    marginBottom: 20,
  },

  subText: {
    fontSize: 13,
    color: "#666",
  },

  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  label: {
    fontSize: 12,
    color: "#888",
    fontWeight: 500,
  },

  value: {
    fontSize: 15,
    fontWeight: 600,
    color: "#111",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
    outline: "none",
  },

  primaryBtn: {
    marginTop: 6,
    background: "linear-gradient(135deg,#2563eb,#3b82f6)",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
  },
};