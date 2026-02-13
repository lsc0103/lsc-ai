import { useAuthStore } from '../stores/auth';

const API_BASE = '/api/idp';

function getHeaders(): HeadersInit {
  const token = useAuthStore.getState().accessToken;
  return {
    Authorization: `Bearer ${token}`,
  };
}

// 类型定义
export interface IdpJob {
  id: string;
  userId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalDocuments: number;
  completedDocuments: number;
  failedDocuments: number;
  documentIds: string[];
  results: Record<string, unknown>;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OcrPageResult {
  page: number;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: number[][];
  }>;
  full_text: string;
}

export interface OcrResponse {
  success: boolean;
  filename: string;
  pages: OcrPageResult[];
  total_pages: number;
  processing_time: number;
}

export interface TableResult {
  page: number;
  table_index: number;
  headers: string[];
  rows: string[][];
}

export interface TableResponse {
  success: boolean;
  filename: string;
  tables: TableResult[];
  total_tables: number;
  processing_time: number;
}

export interface ContractRisk {
  level: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  suggestion: string;
}

export const idpApi = {
  async uploadAndOcr(file: File): Promise<OcrResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/ocr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`OCR failed: ${res.statusText}`);
    return res.json();
  },

  async extractTables(file: File): Promise<TableResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/table`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Table extraction failed: ${res.statusText}`);
    return res.json();
  },

  async analyzeDocument(file: File): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Analysis failed: ${res.statusText}`);
    return res.json();
  },

  async batchUpload(files: File[]): Promise<{ jobId: string; totalDocuments: number }> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Batch upload failed: ${res.statusText}`);
    return res.json();
  },

  async listJobs(page = 1, pageSize = 20): Promise<{ items: IdpJob[]; total: number }> {
    const res = await fetch(`${API_BASE}/jobs?page=${page}&pageSize=${pageSize}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch job list');
    return res.json();
  },

  async getJob(jobId: string): Promise<IdpJob> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch job detail');
    return res.json();
  },

  async checkHealth(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/health`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async processPaintingList(file: File): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/painting-list`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Painting list processing failed: ${res.statusText}`);
    return res.json();
  },

  async processInspectionReport(file: File): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/inspection-report`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Inspection report processing failed: ${res.statusText}`);
    return res.json();
  },
};
