import { useEffect, useState } from "react";
import api from "../services/api";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setLoading(true);

        const res = await api.get("/auth/me");

        const userData = res.data;

        setUser(userData);

        // 🔥 SYNC GLOBAL (quan trọng cho toàn hệ thống)
        localStorage.setItem("user", JSON.stringify(userData));

      } catch (err) {
        console.error("ERROR:", err);

        setUser(null);

        // 🔥 TOKEN DIE → LOGOUT
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Not authenticated</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      <p>
        Welcome: <b>{user.name || user.email}</b>
      </p>
    </div>
  );
}