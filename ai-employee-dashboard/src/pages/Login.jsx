import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Missing email or password");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        email,
        password,
      });

      const token = res.data.access_token;

      if (!token) {
        throw new Error("No access token returned");
      }

      localStorage.setItem("token", token);

      const meRes = await api.get("/auth/me");
      localStorage.setItem("user", JSON.stringify(meRes.data));

      if (meRes.data?.company_id) {
        localStorage.setItem("company_id", meRes.data.company_id);
      } else if (meRes.data?.companies?.length > 0) {
        localStorage.setItem("company_id", meRes.data.companies[0].id);
      }

      navigate("/");

    } catch (err) {
      console.error("LOGIN ERROR:", err);

      const msg =
        err.response?.data?.detail ||
        "Login failed! Check email/password";

      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX: đặt trong component
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
  <div className="login-page">
    <div className="login-overlay" />

    <div className="login-card">
      <div className="login-logo">
        <div className="logo-circle">AI</div>
      </div>

      <h1 className="login-title">AI Employee</h1>
      <p className="login-subtitle">
        Hệ thống quản lý hội thoại & trợ lý AI doanh nghiệp
      </p>

      <div className="login-form">
        <div className="input-group">
          <label>Email</label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="input-group">
          <label>Mật khẩu</label>

          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <button
          className="login-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <div className="loading-wrap">
              <div className="spinner" />
              Đang đăng nhập...
            </div>
          ) : (
            "Đăng nhập"
          )}
        </button>
      </div>

      <div className="login-footer">
        © 2026 AI Employee System
      </div>
    </div>
  </div>
);
}