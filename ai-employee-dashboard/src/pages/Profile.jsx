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
    <div style={{ maxWidth: 400 }}>
      <h2>My Account</h2>

      <div style={{ marginBottom: 10 }}>
        <b>Email:</b> {user.email}
      </div>

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />

      <button
        onClick={handleChangePassword}
        style={{ marginTop: 10 }}
      >
        Change Password
      </button>
    </div>
  );
}