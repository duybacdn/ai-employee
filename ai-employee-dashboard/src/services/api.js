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
  return res.data;
};

export const getConversations = async (channelId) => {
  const res = await api.get(
    `/conversations?channel_id=${channelId}`
  );
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
  const res = await api.get(`/channels/?company_id=${companyId}`);
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
// EXPORT DEFAULT
// =========================
export default api;