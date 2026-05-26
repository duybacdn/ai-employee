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
      const user = meRes.data;

      localStorage.setItem("user", JSON.stringify(user));

      /**
       * 🔥 MULTI-TENANT FIX:
       * - KHÔNG ưu tiên company_id cũ
       * - CHỈ dùng company_ids (source of truth)
       * - backend đã enforce permission theo company_ids
       */

      if (Array.isArray(user?.company_ids) && user.company_ids.length > 0) {
        localStorage.setItem("company_id", user.company_ids[0]);
      } else {
        localStorage.removeItem("company_id");
      }

      /**
       * 🔥 SAFETY RULE:
       * STAFF / ADMIN / SUPERADMIN đều dùng same source:
       * company_ids → KHÔNG fallback sang field cũ
       */

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