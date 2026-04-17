// src/services/api.js
import axios from "axios";

// =========================
// BASE CONFIG
// =========================
const api = axios.create({
  baseURL: "http://localhost:8000/api/v1",
});

// 🔥 AUTO ATTACH TOKEN
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// =========================
// MESSAGES
// =========================
export const getMessages = async (conversationId) => {
  if (!conversationId) throw new Error("conversationId is required");
  const res = await api.get(`/messages?conversation_id=${conversationId}`);
  return res.data;
};

// =========================
// EMPLOYEES
// =========================
export const getEmployees = async () => {
  const res = await api.get("/employees/");
  return res.data;
};

export const createEmployee = async (data) => {
  const res = await api.post("/employees/", data);
  return res.data;
};

export const updateEmployee = async (id, data) => {
  const res = await api.put(`/employees/${id}`, data);
  return res.data;
};

export const deleteEmployee = async (id) => {
  const res = await api.delete(`/employees/${id}`);
  return res.data;
};

// =========================
// COMPANIES
// =========================
export const getCompanies = async () => {
  const res = await api.get("/companies/");
  return res.data;
};

// =========================
// CHANNELS
// =========================

// Get channels by company
export const getChannels = async (companyId) => {
  const res = await api.get(`/channels/?company_id=${companyId}`);
  return res.data;
};

// Create channel
export const createChannel = async (data) => {
  const res = await api.post("/channels/", data);
  return res.data;
};

// 🔥 Toggle channel active / disable
export const toggleChannel = async (channelId) => {
  const res = await api.patch(`/channels/${channelId}/toggle`);
  return res.data; // { is_active: true/false }
};

// 🔥 Delete channel
export const deleteChannel = async (channelId) => {
  const res = await api.delete(`/channels/${channelId}`);
  return res.data; // có thể trả về { success: true }
};

// =========================
// CHANNEL ↔ EMPLOYEES (AI MAPPING)
// =========================

// Get mapping
export const getChannelEmployees = async (channelId) => {
  const res = await api.get(`/channels/${channelId}/employees`);
  return res.data;
};

// Assign 1 employee (single - dùng khi add nhanh)
export const assignEmployee = async (channelId, payload) => {
  const res = await api.post(
    `/channels/${channelId}/employees`,
    payload
  );
  return res.data;
};

// 🔥 NEW (bulk assign - dùng chính)
export const assignEmployeesBulk = async (channelId, data) => {
  const res = await api.post(`/channels/${channelId}/assign`, data);
  return res.data;
};

export default api;