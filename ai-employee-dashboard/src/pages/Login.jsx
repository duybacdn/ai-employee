import { useState } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      console.log("SENDING:", { email, password });

      // 1️⃣ Login lấy access token
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      console.log("LOGIN SUCCESS:", res.data);

      const token = res.data.access_token;
      if (!token) throw new Error("No access token returned");

      // Lưu token
      localStorage.setItem("token", token);

      // 2️⃣ Fetch thông tin user hiện tại từ server
      const meRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("ME:", meRes.data);

      // Lưu user info
      localStorage.setItem("user", JSON.stringify(meRes.data));

      // 3️⃣ Điều hướng về dashboard
      navigate("/");

    } catch (err) {
      console.error("LOGIN ERROR:", err.response?.data || err);
      alert("Login failed!");
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

      <button onClick={handleLogin}>Login</button>
    </div>
  );
}