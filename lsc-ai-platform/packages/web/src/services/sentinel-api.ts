import api from './api';

export interface SentinelAgent {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  platform: string;
  agentVersion: string;
  capabilities: Record<string, unknown>;
  status: string;
  lastSeenAt: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metricName: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: string;
  enabled: boolean;
  actions: { type: string; config: Record<string, string> }[];
  cooldown: number;
  lastFiredAt?: string;
  createdAt: string;
  _count?: { alertHistory: number };
}

export interface AlertHistoryItem {
  id: string;
  ruleId: string;
  agentId: string;
  severity: string;
  metricName: string;
  metricValue: number;
  threshold: number;
  condition: string;
  message: string;
  status: string;
  resolvedAt?: string;
  createdAt: string;
  rule?: { name: string };
  agent?: { name: string; hostname: string };
}

export interface SentinelMetric {
  id: string;
  agentId: string;
  name: string;
  value: number;
  unit?: string;
  tags: Record<string, string>;
  createdAt: string;
}

export const sentinelApi = {
  // Agents
  listAgents: () => api.get<SentinelAgent[]>('/sentinel-agents'),
  getHealth: () => api.get<{ total: number; online: number; offline: number }>('/sentinel-agents/health'),
  getAgent: (id: string) => api.get<SentinelAgent>(`/sentinel-agents/${id}`),

  // Metrics
  getMetrics: (agentId: string, params?: { name?: string; start?: string; end?: string; limit?: number }) =>
    api.get<SentinelMetric[]>(`/sentinel-agents/${agentId}/metrics`, { params }),
  getLatestMetrics: (agentId: string) =>
    api.get<SentinelMetric[]>(`/sentinel-agents/${agentId}/metrics/latest`),

  // Alert Rules
  listAlertRules: () => api.get<AlertRule[]>('/sentinel-agents/alert-rules'),
  createAlertRule: (data: Partial<AlertRule>) =>
    api.post<AlertRule>('/sentinel-agents/alert-rules', data),
  updateAlertRule: (id: string, data: Partial<AlertRule>) =>
    api.patch<AlertRule>(`/sentinel-agents/alert-rules/${id}`, data),
  deleteAlertRule: (id: string) => api.delete(`/sentinel-agents/alert-rules/${id}`),

  // Alerts
  listAlerts: (params?: {
    agentId?: string;
    ruleId?: string;
    severity?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ items: AlertHistoryItem[]; total: number }>('/sentinel-agents/alerts', { params }),
  acknowledgeAlert: (id: string) => api.patch(`/sentinel-agents/alerts/${id}/acknowledge`),
  resolveAlert: (id: string) => api.patch(`/sentinel-agents/alerts/${id}/resolve`),
};
