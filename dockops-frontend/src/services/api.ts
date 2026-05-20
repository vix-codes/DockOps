import axios from 'axios';
import type { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse, ServerNode, Container, Project, Deployment, PageResponse,
  FileEntry, DockerImage, DockerVolume, DockerNetwork, ContainerStats, ManagedApp,
} from '@/types';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL + '/',
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
      if (refreshToken && !error.config?.url?.includes('auth/refresh')) {
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
    api.post<AuthResponse>('api/auth/login', { username, password }),
  initAdmin: (data: { username: string; email: string; password: string; fullName: string; role?: string }) =>
    api.post<AuthResponse>('api/auth/register/init', data),
};

// Nodes
export const nodesApi = {
  list: () => api.get<ServerNode[]>('api/nodes'),
  get: (id: string) => api.get<ServerNode>(`api/nodes/${id}`),
  create: (data: object) => api.post<ServerNode>('api/nodes', data),
  update: (id: string, data: object) => api.put<ServerNode>(`api/nodes/${id}`, data),
  delete: (id: string) => api.delete(`api/nodes/${id}`),
  refreshMetrics: (id: string) => api.post<ServerNode>(`api/nodes/${id}/refresh-metrics`),
  testConnection: (id: string) => api.post<{ connected: boolean }>(`api/nodes/${id}/test-connection`),
};

// Containers
export const containersApi = {
  list: (nodeId: string) => api.get<Container[]>(`api/containers?nodeId=${nodeId}`),
  action: (nodeId: string, containerId: string, action: string) =>
    api.post('api/containers/action', { serverNodeId: nodeId, containerId, action }),
  logs: (nodeId: string, containerId: string, tail = 100) =>
    api.get<string[]>(`api/containers/logs?nodeId=${nodeId}&containerId=${containerId}&tail=${tail}`),
};

// Projects
export const projectsApi = {
  list: () => api.get<Project[]>('api/projects'),
  get: (id: string) => api.get<Project>(`api/projects/${id}`),
  create: (data: object) => api.post<Project>('api/projects', data),
  update: (id: string, data: object) => api.put<Project>(`api/projects/${id}`, data),
  delete: (id: string) => api.delete(`api/projects/${id}`),
};

// Deployments
export const deploymentsApi = {
  list: (projectId: string, page = 0, size = 20) =>
    api.get<PageResponse<Deployment>>(`api/deployments?projectId=${projectId}&page=${page}&size=${size}`),
  get: (id: string) => api.get<Deployment>(`api/deployments/${id}`),
  trigger: (projectId: string, branch?: string) =>
    api.post<Deployment>('api/deployments', { projectId, branch }),
  rollback: (id: string) => api.post<Deployment>(`api/deployments/${id}/rollback`),
};

// Filesystem
export const fsApi = {
  list: (nodeId: string, path = '/') =>
    api.get<FileEntry[]>(`api/fs/${nodeId}/list`, { params: { path } }),
  read: (nodeId: string, path: string) =>
    api.get<{ content: string; path: string }>(`api/fs/${nodeId}/read`, { params: { path } }),
  write: (nodeId: string, path: string, content: string) =>
    api.put<void>(`api/fs/${nodeId}/write`, { content }, { params: { path } }),
  mkdir: (nodeId: string, path: string) =>
    api.post<void>(`api/fs/${nodeId}/mkdir`, { path }),
  touch: (nodeId: string, path: string) =>
    api.post<void>(`api/fs/${nodeId}/touch`, { path }),
  rename: (nodeId: string, oldPath: string, newPath: string) =>
    api.patch<void>(`api/fs/${nodeId}/rename`, { oldPath, newPath }),
  delete: (nodeId: string, path: string, recursive = false) =>
    api.delete<void>(`api/fs/${nodeId}/delete`, { params: { path, recursive } }),
  download: async (nodeId: string, path: string) => {
    const res = await api.get(`api/fs/${nodeId}/download`, {
      params: { path },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  upload: (nodeId: string, directory: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<void>(`api/fs/${nodeId}/upload`, form, {
      params: { directory },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Docker extended
export const dockerApi = {
  images: (nodeId: string) => api.get<DockerImage[]>(`api/nodes/${nodeId}/docker/images`),
  removeImage: (nodeId: string, imageId: string) =>
    api.delete<void>(`api/nodes/${nodeId}/docker/images/${imageId}`),
  pullImage: (nodeId: string, image: string) =>
    api.post<void>(`api/nodes/${nodeId}/docker/images/pull`, { image }),
  volumes: (nodeId: string) => api.get<DockerVolume[]>(`api/nodes/${nodeId}/docker/volumes`),
  removeVolume: (nodeId: string, volumeName: string) =>
    api.delete<void>(`api/nodes/${nodeId}/docker/volumes/${volumeName}`),
  networks: (nodeId: string) => api.get<DockerNetwork[]>(`api/nodes/${nodeId}/docker/networks`),
  stats: (nodeId: string) => api.get<ContainerStats[]>(`api/nodes/${nodeId}/docker/stats`),
  prune: (nodeId: string, volumes = false) =>
    api.post<{ output: string }>(`api/nodes/${nodeId}/docker/prune`, null, { params: { volumes } }),
};

// Application Registry
export const appsApi = {
  list: () => api.get<ManagedApp[]>('api/apps'),
  get: (id: string) => api.get<ManagedApp>(`api/apps/${id}`),
  create: (data: object) => api.post<ManagedApp>('api/apps', data),
  update: (id: string, data: object) => api.put<ManagedApp>(`api/apps/${id}`, data),
  delete: (id: string) => api.delete<void>(`api/apps/${id}`),
};

export default api;
