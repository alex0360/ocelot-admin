import apiClient from './client.js';

export const routesApi = {
  list:     (fileId)        => apiClient.get('/routes', { params: { fileId } }).then(response => response.data),
  validate: (routes)        => apiClient.post('/routes/validate', { routes }).then(response => response.data),
  preview:  (fileId, routes) => apiClient.post('/routes/preview', { fileId, routes }).then(response => response.data),
};
