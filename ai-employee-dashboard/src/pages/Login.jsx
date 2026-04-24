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
    <div className="login-container">
      <div className="login-card">

        <h2>Đăng nhập</h2>
        <p className="subtitle">AI Employee</p>

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

      </div>
    </div>
  );
}