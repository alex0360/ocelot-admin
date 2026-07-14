import apiClient from './client.js';

export const publishingApi = {
  publish:  (data)   => apiClient.post('/publishing/publish', data).then(response => response.data),
  history:  (fileId) => apiClient.get('/publishing/history', { params: { fileId } }).then(response => response.data),
  rollback: (data)   => apiClient.post('/publishing/rollback', data).then(response => response.data),
};
