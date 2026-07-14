import apiClient from './client.js';

export const environmentsApi = {
  list:    ()                            => apiClient.get('/environments').then(response => response.data),
  create:  (data)                        => apiClient.post('/environments', data).then(response => response.data),
  update:  (environmentId, data)         => apiClient.put(`/environments/${environmentId}`, data).then(response => response.data),
  remove:  (environmentId)               => apiClient.delete(`/environments/${environmentId}`).then(response => response.data),
};
