import api from './api';

// ==================== Interfaces ====================

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  cronExpr: string;
  taskType: string;
  taskConfig: any;
  status: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
  taskLogs?: TaskLog[];
}

export interface TaskLog {
  id: string;
  taskId: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  result?: any;
  error?: string;
}

export interface RpaFlow {
  id: string;
  name: string;
  description?: string;
  flowData: RpaFlowDef;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RpaFlowDef {
  steps: RpaStepDef[];
  variables?: Record<string, any>;
}

export interface RpaStepDef {
  id: string;
  type: 'ai_chat' | 'shell_command' | 'web_fetch' | 'file_operation' | 'condition' | 'loop';
  config: Record<string, any>;
  next?: string;
}

// ==================== API Methods ====================

export const workflowApi = {
  tasks: {
    // 创建定时任务
    create: (data: {
      name: string;
      description?: string;
      cronExpr: string;
      taskType: string;
      taskConfig: any;
    }) => api.post<ScheduledTask>('/workflows/tasks', data),

    // 获取任务列表
    list: () => api.get<ScheduledTask[]>('/workflows/tasks'),

    // 获取任务详情（含日志）
    getById: (id: string) => api.get<ScheduledTask>(`/workflows/tasks/${id}`),

    // 更新任务
    update: (id: string, data: {
      name?: string;
      description?: string;
      cronExpr?: string;
      taskConfig?: any;
      status?: string;
    }) => api.patch<ScheduledTask>(`/workflows/tasks/${id}`, data),

    // 删除任务
    delete: (id: string) => api.delete(`/workflows/tasks/${id}`),

    // 手动执行任务
    execute: (id: string) => api.post(`/workflows/tasks/${id}/execute`),

    // 获取任务日志
    getLogs: (id: string) => api.get<TaskLog[]>(`/workflows/tasks/${id}/logs`),
  },

  rpa: {
    // 创建 RPA 流程
    create: (data: {
      name: string;
      description?: string;
      flowData: RpaFlowDef;
    }) => api.post<RpaFlow>('/workflows/rpa', data),

    // 获取 RPA 流程列表
    list: () => api.get<RpaFlow[]>('/workflows/rpa'),

    // 获取 RPA 流程详情
    getById: (id: string) => api.get<RpaFlow>(`/workflows/rpa/${id}`),

    // 更新 RPA 流程
    update: (id: string, data: {
      name?: string;
      description?: string;
      flowData?: RpaFlowDef;
      status?: string;
    }) => api.patch<RpaFlow>(`/workflows/rpa/${id}`, data),

    // 删除 RPA 流程
    delete: (id: string) => api.delete(`/workflows/rpa/${id}`),

    // 执行 RPA 流程
    execute: (id: string, inputData?: Record<string, any>) =>
      api.post(`/workflows/rpa/${id}/execute`, { inputData }),
  },
};
