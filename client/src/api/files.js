import apiClient from './client.js';

export const filesApi = {
  list:   (environmentId) => apiClient.get('/files', { params: { environmentId } }).then(response => response.data),
  create: (data)          => apiClient.post('/files', data).then(response => response.data),
  remove: (fileId)        => apiClient.delete(`/files/${fileId}`).then(response => response.data),
};
