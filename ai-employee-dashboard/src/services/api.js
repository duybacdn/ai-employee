import axios from "axios";

// =========================
// BASE CONFIG
// =========================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
});

// =========================
// INTERCEPTOR (AUTO TOKEN)
// =========================
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

  const res = await api.get(
    `/messages?conversation_id=${conversationId}`
  );

  // 🔥 FIX CỨNG
  const data = res.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.messages)) return data.messages;

  return []; // fallback chống crash
};

export const getConversations = async (channelId) => {
  const url = channelId
    ? `/conversations?channel_id=${channelId}`
    : `/conversations`; // 🔥 FIX: support global admin

  const res = await api.get(url);
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
export const getChannels = async (companyId) => {
  const url = companyId
    ? `/channels/?company_id=${companyId}`
    : `/channels/`; // 🔥 FIX: global admin load all

  const res = await api.get(url);
  return res.data;
};

export const createChannel = async (data) => {
  const res = await api.post("/channels/", data);
  return res.data;
};

export const toggleChannel = async (channelId) => {
  const res = await api.patch(`/channels/${channelId}/toggle`);
  return res.data;
};

export const deleteChannel = async (channelId) => {
  const res = await api.delete(`/channels/${channelId}`);
  return res.data;
};

// =========================
// CHANNEL ↔ EMPLOYEES
// =========================
export const getChannelEmployees = async (channelId) => {
  const res = await api.get(`/channels/${channelId}/employees`);
  return res.data;
};

export const assignEmployee = async (channelId, payload) => {
  const res = await api.post(
    `/channels/${channelId}/employees`,
    payload
  );
  return res.data;
};

export const assignEmployeesBulk = async (channelId, data) => {
  const res = await api.post(
    `/channels/${channelId}/assign`,
    data
  );
  return res.data;
};

// =========================
// ADMIN USERS
// =========================
export const getUsers = async () => {
  const res = await api.get("/admin/users");
  return res.data;
};

// =========================
// COMPANY USERS
// =========================
export const getCompanyUsers = async (companyId) => {
  const res = await api.get(`/companies/${companyId}/users`);
  return res.data;
};

export const assignUserToCompany = async (companyId, payload) => {
  const res = await api.post(`/companies/${companyId}/users`, payload);
  return res.data;
};

export const removeUserFromCompany = async (companyId, userId) => {
  const res = await api.delete(`/companies/${companyId}/users/${userId}`);
  return res.data;
};

// =========================
// EXPORT DEFAULT
// =========================
export default api;