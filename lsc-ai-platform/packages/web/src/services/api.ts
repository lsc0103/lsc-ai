import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/auth';

// 创建 Axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器 - 处理错误和 Token 刷新
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 401 未授权 - 尝试刷新 Token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          // 重试原请求
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          // 刷新失败，登出
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export default api;

// API 方法封装
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

export const sessionApi = {
  list: () => api.get('/sessions'),

  get: (id: string) => api.get(`/sessions/${id}`),

  create: (data: { title?: string; projectId?: string }) =>
    api.post('/sessions', data),

  update: (id: string, data: { title: string }) =>
    api.patch(`/sessions/${id}`, data),

  delete: (id: string) => api.delete(`/sessions/${id}`),

  // Workbench 状态
  getWorkbenchState: (id: string) => api.get(`/sessions/${id}/workbench`),

  saveWorkbenchState: (id: string, workbenchState: any) =>
    api.patch(`/sessions/${id}/workbench`, { workbenchState }),
};

export const projectApi = {
  list: () => api.get('/projects'),

  get: (id: string) => api.get(`/projects/${id}`),

  create: (data: { name: string; description?: string }) =>
    api.post('/projects', data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/projects/${id}`, data),

  delete: (id: string) => api.delete(`/projects/${id}`),
};

export interface AgentDevice {
  id: string;
  deviceId: string;
  deviceName: string;
  hostname?: string;
  platform?: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: string;
}

export const agentApi = {
  // 获取用户的 Agent 列表
  list: () => api.get<AgentDevice[]>('/agents'),

  // 生成配对码（浏览器生成，Agent 输入）
  generatePairingCode: () => api.post<{ code: string; expiresIn: number }>('/agents/pairing-code'),

  // 确认配对（Agent 生成配对码，浏览器输入确认）
  confirmPairing: (code: string) =>
    api.post<{
      success: boolean;
      agentId?: string;
      deviceId?: string;
      deviceName?: string;
      error?: string;
    }>('/agents/confirm-pairing', { code }),

  // 下发任务到 Client Agent
  dispatch: (data: {
    deviceId: string;
    type: 'chat' | 'execute' | 'file_operation';
    message?: string;
    command?: string;
    workDir?: string;
    sessionId?: string;
  }) => api.post<{ taskId: string; status: string }>('/agents/dispatch', data),

  // 解绑 Agent 设备
  unbind: (deviceId: string) => api.delete<{ success: boolean; message: string }>(`/agents/${deviceId}`),
};

export const chatApi = {
  // 发送消息
  send: (sessionId: string, message: string) =>
    api.post('/chat', { sessionId, message }),
};

export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export const uploadApi = {
  // 上传单个文件
  upload: (file: File, sessionId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return api.post<{ success: boolean; data: FileInfo }>(`/upload${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 批量上传文件
  uploadBatch: (files: File[], sessionId?: string) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return api.post<{ success: boolean; data: FileInfo[] }>(`/upload/batch${params}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 获取文件列表
  list: (sessionId?: string) => {
    const params = sessionId ? `?sessionId=${sessionId}` : '';
    return api.get<{ success: boolean; data: FileInfo[] }>(`/upload${params}`);
  },

  // 获取单个文件信息
  get: (fileId: string) =>
    api.get<{ success: boolean; data: FileInfo | null }>(`/upload/${fileId}`),

  // 删除文件
  delete: (fileId: string) =>
    api.delete<{ success: boolean }>(`/upload/${fileId}`),
};
