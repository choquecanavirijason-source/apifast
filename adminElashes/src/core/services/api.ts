import axios from 'axios';
import variables from '../config/variables';

const baseURL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  variables.apiUrl ||
  'http://localhost:8000';

const api = axios.create({
  baseURL: String(baseURL).replace(/\/$/, ''),
});

// Este interceptor pega el token automáticamente en cada llamada
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(variables.session.tokenName || '_tkn');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem(variables.session.tokenName);
      localStorage.removeItem(variables.session.userData);
      localStorage.removeItem(variables.session.userRoles);
      localStorage.removeItem(variables.session.userPermissions);
      localStorage.removeItem(variables.session.sessionExpiresAt);
      localStorage.removeItem(variables.session.sessionDurationMinutes);

      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;