import axios from "axios";

// =========================
// BASE CONFIG
// =========================
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
});

// =========================
// AUTO AUTH TOKEN
// =========================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// =========================
// AUTO 401 HANDLER (NEW - SAFE)
// =========================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// =========================
// HELPER
// =========================
const buildQuery = (params = {}) => {
  const q = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      q.append(key, value);
    }
  });

  return q.toString();
};

// =========================
// MESSAGES
// =========================
export const getMessages = async (conversationId) => {
  if (!conversationId) throw new Error("conversationId is required");

  const res = await api.get(`/messages?conversation_id=${conversationId}`);

  const data = res.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.messages)) return data.messages;

  return [];
};

export const getConversations = async (channelId) => {
  const url = channelId
    ? `/conversations?channel_id=${channelId}`
    : `/conversations`;

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
// CHANNELS (SAFE - NO BREAK OLD PAGES)
// =========================
export const getChannels = async (companyId) => {
  const url = companyId
    ? `/channels/?company_id=${companyId}`
    : `/channels/`;

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
// CHANNEL EMPLOYEES
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
  const res = await api.post(`/channels/${channelId}/assign`, data);
  return res.data;
};

// =========================
// ADMIN USERS
// =========================
export const getUsers = async () => {
  const res = await api.get("/admin/users/");
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
  const res = await api.delete(
    `/companies/${companyId}/users/${userId}`
  );
  return res.data;
};

// =========================
// KNOWLEDGE (NEW - FULL FILTER SUPPORT)
// =========================
export const getKnowledge = async (filters = {}) => {
  const query = buildQuery(filters);

  const res = await api.get(
    `/knowledge/${query ? `?${query}` : ""}`
  );

  return Array.isArray(res.data) ? res.data : [];
};

export const createKnowledge = async (data) => {
  const res = await api.post("/knowledge/", data);
  return res.data;
};

export const updateKnowledge = async (id, data) => {
  const res = await api.put(`/knowledge/${id}`, data);
  return res.data;
};

export const deleteKnowledge = async (id) => {
  const res = await api.delete(`/knowledge/${id}`);
  return res.data;
};

export const resyncKnowledge = async () => {
  const res = await api.post("/knowledge/resync");
  return res.data;
};

// =========================
// EXPORT DEFAULT
// =========================
export default api;