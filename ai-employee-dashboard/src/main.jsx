import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // có thể giữ hoặc xoá nếu chưa dùng

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);