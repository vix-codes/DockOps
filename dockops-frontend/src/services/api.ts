import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type { AuthResponse, ServerNode, Container, Project, Deployment, PageResponse } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken && !error.config?.url?.includes('/auth/refresh')) {
        try {
          const response = await axios.post<AuthResponse>(`${BASE_URL}/api/auth/refresh`, null, {
            headers: { 'X-Refresh-Token': refreshToken },
          });
          const { accessToken, refreshToken: newRefresh } = response.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          if (error.config) {
            error.config.headers.Authorization = `Bearer ${accessToken}`;
            return api.request(error.config);
          }
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { username, password }),
  initAdmin: (data: { username: string; email: string; password: string; fullName: string; role?: string }) =>
    api.post<AuthResponse>('/api/auth/register/init', data),
};

// Nodes
export const nodesApi = {
  list: () => api.get<ServerNode[]>('/api/nodes'),
  get: (id: string) => api.get<ServerNode>(`/api/nodes/${id}`),
  create: (data: object) => api.post<ServerNode>('/api/nodes', data),
  update: (id: string, data: object) => api.put<ServerNode>(`/api/nodes/${id}`, data),
  delete: (id: string) => api.delete(`/api/nodes/${id}`),
  refreshMetrics: (id: string) => api.post<ServerNode>(`/api/nodes/${id}/refresh-metrics`),
  testConnection: (id: string) => api.post<{ connected: boolean }>(`/api/nodes/${id}/test-connection`),
};

// Containers
export const containersApi = {
  list: (nodeId: string) => api.get<Container[]>(`/api/containers?nodeId=${nodeId}`),
  action: (nodeId: string, containerId: string, action: string) =>
    api.post('/api/containers/action', { serverNodeId: nodeId, containerId, action }),
  logs: (nodeId: string, containerId: string, tail = 100) =>
    api.get<string[]>(`/api/containers/logs?nodeId=${nodeId}&containerId=${containerId}&tail=${tail}`),
};

// Projects
export const projectsApi = {
  list: () => api.get<Project[]>('/api/projects'),
  get: (id: string) => api.get<Project>(`/api/projects/${id}`),
  create: (data: object) => api.post<Project>('/api/projects', data),
  update: (id: string, data: object) => api.put<Project>(`/api/projects/${id}`, data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
};

// Deployments
export const deploymentsApi = {
  list: (projectId: string, page = 0, size = 20) =>
    api.get<PageResponse<Deployment>>(`/api/deployments?projectId=${projectId}&page=${page}&size=${size}`),
  get: (id: string) => api.get<Deployment>(`/api/deployments/${id}`),
  trigger: (projectId: string, branch?: string) =>
    api.post<Deployment>('/api/deployments', { projectId, branch }),
  rollback: (id: string) => api.post<Deployment>(`/api/deployments/${id}/rollback`),
};

export default api;
