import api from './api';

export interface AuditLogItem {
  id: string;
  userId?: string;
  username?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLogStats {
  days: number;
  totalCount: number;
  byAction: { action: string; count: number }[];
  byResourceType: { resourceType: string | null; count: number }[];
}

export const auditApi = {
  list: (params: Record<string, any>) =>
    api.get<AuditLogListResponse>('/audit-logs', { params }),
  getStats: (days?: number) =>
    api.get<AuditLogStats>('/audit-logs/stats', { params: { days } }),
  exportLogs: (params: Record<string, any>) =>
    api.get<AuditLogItem[]>('/audit-logs/export', { params }),
};
