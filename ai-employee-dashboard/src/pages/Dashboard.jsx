import { useEffect } from "react";
import api from "../services/api";

export default function Dashboard() {

  useEffect(() => {
    api.get("/auth/me")
      .then(res => console.log("ME:", res.data))
      .catch(err => console.error("ERROR:", err));
  }, []);

  return <h1>Dashboard</h1>;
}