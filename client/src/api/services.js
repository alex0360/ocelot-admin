import apiClient from './client.js';

export const servicesApi = {
  list:   ()     => apiClient.get('/services').then(response => response.data),
  groups: ()     => apiClient.get('/services/groups').then(response => response.data),
  health: ()     => apiClient.get('/services/health').then(response => response.data),
  create: (data) => apiClient.post('/services', data).then(response => response.data),
  update: (serviceId, data) => apiClient.put(`/services/${serviceId}`, data).then(response => response.data),
  remove: (serviceId) => apiClient.delete(`/services/${serviceId}`).then(response => response.data),
};
