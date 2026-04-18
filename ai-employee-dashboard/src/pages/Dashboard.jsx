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

        setUser(res.data);
      } catch (err) {
        console.error("ERROR:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  if (loading) return <h1>Loading...</h1>;

  if (!user) return <h1>Not authenticated</h1>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome: {user.name || user.email}</p>
    </div>
  );
}