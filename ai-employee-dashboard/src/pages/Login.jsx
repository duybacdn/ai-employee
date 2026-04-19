xong
import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

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

      // =========================
      // LOGIN
      // =========================
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      const token = res.data.access_token;

      if (!token) {
        throw new Error("No access token returned");
      }

      localStorage.setItem("token", token);

      // =========================
      // GET CURRENT USER
      // =========================
      const meRes = await api.get("/auth/me");

      localStorage.setItem("user", JSON.stringify(meRes.data));

      // 🔥 FIX: SET company_id cho global admin
      if (meRes.data?.company_id) {
        localStorage.setItem("company_id", meRes.data.company_id);
      } else if (meRes.data?.companies?.length > 0) {
        // nếu user có nhiều company → lấy cái đầu
        localStorage.setItem("company_id", meRes.data.companies[0].id);
      }

      // =========================
      // GO DASHBOARD
      // =========================
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

  return (
    <div style={{ padding: "50px" }}>
      <h2>Login</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br /><br />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br /><br />

      <button onClick={handleLogin} disabled={loading}>
        {loading ? "Logging in..." : "Login"}
      </button>
    </div>
  );
}