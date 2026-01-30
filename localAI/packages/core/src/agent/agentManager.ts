/**
 * 代理管理器
 * 管理子代理的生命周期，支持前台和后台运行
 */

import { SubAgent, type SubAgentConfig, type SubAgentResult, type SubAgentStatus } from './subAgent.js';

/**
 * 任务信息
 */
export interface TaskInfo {
  /** 任务 ID */
  id: string;
  /** 子代理类型 */
  type: string;
  /** 任务描述 */
  description: string;
  /** 状态 */
  status: SubAgentStatus;
  /** 创建时间 */
  createdAt: number;
  /** 完成时间 */
  completedAt?: number;
  /** 是否在后台运行 */
  isBackground: boolean;
  /** 结果（完成后） */
  result?: SubAgentResult;
}

/**
 * 代理管理器
 */
export class AgentManager {
  private tasks: Map<string, TaskInfo> = new Map();
  private subAgents: Map<string, SubAgent> = new Map();
  private taskIdCounter = 0;

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `task-${++this.taskIdCounter}-${Date.now().toString(36)}`;
  }

  /**
   * 创建并运行子代理任务
   */
  async runTask(
    config: SubAgentConfig,
    options: {
      description?: string;
      runInBackground?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<{ taskId: string; result?: SubAgentResult }> {
    const taskId = this.generateTaskId();
    const subAgent = new SubAgent(config);

    // 创建任务信息
    const taskInfo: TaskInfo = {
      id: taskId,
      type: config.type,
      description: options.description || config.prompt.slice(0, 100),
      status: 'pending',
      createdAt: Date.now(),
      isBackground: options.runInBackground || false,
    };

    this.tasks.set(taskId, taskInfo);
    this.subAgents.set(taskId, subAgent);

    // 更新状态为运行中
    taskInfo.status = 'running';

    if (options.runInBackground) {
      // 后台运行：启动后立即返回
      this.runInBackground(taskId, subAgent, taskInfo, options.signal);
      return { taskId };
    } else {
      // 前台运行：等待完成
      try {
        const result = await subAgent.run(options.signal);
        taskInfo.status = result.success ? 'completed' : 'failed';
        taskInfo.completedAt = Date.now();
        taskInfo.result = result;
        return { taskId, result };
      } catch (error) {
        taskInfo.status = 'failed';
        taskInfo.completedAt = Date.now();
        taskInfo.result = {
          success: false,
          output: '',
          error: (error as Error).message,
          toolCalls: [],
          iterations: 0,
          duration: Date.now() - taskInfo.createdAt,
        };
        return { taskId, result: taskInfo.result };
      }
    }
  }

  /**
   * 后台运行任务
   */
  private async runInBackground(
    taskId: string,
    subAgent: SubAgent,
    taskInfo: TaskInfo,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const result = await subAgent.run(signal);
      taskInfo.status = result.success ? 'completed' : 'failed';
      taskInfo.completedAt = Date.now();
      taskInfo.result = result;
    } catch (error) {
      taskInfo.status = 'failed';
      taskInfo.completedAt = Date.now();
      taskInfo.result = {
        success: false,
        output: '',
        error: (error as Error).message,
        toolCalls: [],
        iterations: 0,
        duration: Date.now() - taskInfo.createdAt,
      };
    }
  }

  /**
   * 获取任务信息
   */
  getTask(taskId: string): TaskInfo | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取任务结果（可选等待）
   */
  async getTaskResult(
    taskId: string,
    options: { block?: boolean; timeout?: number } = {}
  ): Promise<SubAgentResult | null> {
    const { block = true, timeout = 30000 } = options;
    const task = this.tasks.get(taskId);

    if (!task) {
      return null;
    }

    // 如果任务已完成，直接返回结果
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task.result || null;
    }

    // 如果不阻塞，返回 null
    if (!block) {
      return null;
    }

    // 阻塞等待结果
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      // 重新获取任务状态（可能被后台任务修改）
      const currentTask = this.tasks.get(taskId);
      if (!currentTask) return null;

      if (currentTask.status === 'completed' || currentTask.status === 'failed' || currentTask.status === 'cancelled') {
        return currentTask.result || null;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 超时
    return null;
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const subAgent = this.subAgents.get(taskId);
    const task = this.tasks.get(taskId);

    if (!subAgent || !task) {
      return false;
    }

    if (task.status === 'running' || task.status === 'pending') {
      subAgent.cancel();
      task.status = 'cancelled';
      task.completedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * 获取所有任务列表
   */
  listTasks(filter?: { status?: SubAgentStatus; isBackground?: boolean }): TaskInfo[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter?.isBackground !== undefined) {
      tasks = tasks.filter(t => t.isBackground === filter.isBackground);
    }

    // 按创建时间倒序
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * 获取正在运行的任务数量
   */
  getRunningCount(): number {
    return Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
  }

  /**
   * 清理已完成的任务（释放内存）
   */
  cleanup(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        now - task.completedAt > maxAge
      ) {
        this.tasks.delete(taskId);
        this.subAgents.delete(taskId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// 全局代理管理器实例
export const agentManager = new AgentManager();
