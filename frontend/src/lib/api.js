import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("jobsite_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fileUrl = (fileId, thumb = false) => {
  const token = localStorage.getItem("jobsite_token");
  return `${API}/files/${fileId}?auth=${encodeURIComponent(token || "")}${thumb ? "&thumb=true" : ""}`;
};
