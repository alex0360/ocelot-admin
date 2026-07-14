import axios from 'axios';
import { getToken } from '../auth/keycloak.js';

const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adjuntar token de Keycloak a cada request
apiClient.interceptors.request.use(async (config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar errores de auth
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado: redirigir a login
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
