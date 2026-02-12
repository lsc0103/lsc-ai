import api from './api';

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  chunkCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  content: string;
  score: number;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export const knowledgeApi = {
  // 知识库 CRUD
  list: (params?: { page?: number; pageSize?: number; search?: string }) =>
    api.get<{ data: KnowledgeBase[]; total: number }>('/knowledge-bases', { params }),
  create: (data: { name: string; description?: string; projectId?: string }) =>
    api.post<KnowledgeBase>('/knowledge-bases', data),
  getById: (id: string) => api.get<KnowledgeBase>(`/knowledge-bases/${id}`),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<KnowledgeBase>(`/knowledge-bases/${id}`, data),
  delete: (id: string) => api.delete(`/knowledge-bases/${id}`),

  // 文档管理
  getDocuments: (kbId: string) =>
    api.get<KnowledgeDocument[]>(`/knowledge-bases/${kbId}/documents`),
  uploadDocument: (kbId: string, file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<KnowledgeDocument>(`/knowledge-bases/${kbId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
  },
  deleteDocument: (docId: string) => api.delete(`/knowledge-bases/documents/${docId}`),

  // 搜索
  search: (kbId: string, query: string, topK?: number) =>
    api.post<SearchResult[]>(`/knowledge-bases/${kbId}/search`, { query, topK }),
};
