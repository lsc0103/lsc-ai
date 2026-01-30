/**
 * Plan 模式管理
 * 支持在执行复杂任务前先规划方案
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Plan 状态
 */
export type PlanStatus = 'inactive' | 'planning' | 'pending_approval' | 'approved' | 'rejected';

/**
 * Plan 步骤
 */
export interface PlanStep {
  /** 步骤编号 */
  index: number;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 涉及的文件 */
  files?: string[];
  /** 是否已完成 */
  completed?: boolean;
}

/**
 * Plan 内容
 */
export interface PlanContent {
  /** 任务标题 */
  title: string;
  /** 任务描述 */
  description: string;
  /** 需求分析 */
  analysis?: string;
  /** 实现步骤 */
  steps: PlanStep[];
  /** 涉及的文件汇总 */
  affectedFiles: string[];
  /** 潜在风险 */
  risks?: string[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * Plan 会话
 */
export interface PlanSession {
  /** 会话 ID */
  id: string;
  /** 状态 */
  status: PlanStatus;
  /** Plan 内容 */
  content: PlanContent | null;
  /** Plan 文件路径 */
  filePath: string;
  /** 用户反馈 */
  userFeedback?: string;
  /** 当前执行步骤 */
  currentStep: number;
}

/**
 * 简单的互斥锁，用于序列化 plan 操作
 */
class PlanLock {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }
}

/**
 * Plan 模式管理器
 */
export class PlanManager {
  private sessions: Map<string, PlanSession> = new Map();
  private currentSessionId: string | null = null;
  private planDir: string;
  private lock = new PlanLock();

  constructor(planDir?: string) {
    this.planDir = planDir || path.join(process.cwd(), '.lsc-ai', 'plans');
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 确保 plan 目录存在
   */
  private async ensurePlanDir(): Promise<void> {
    try {
      await fs.mkdir(this.planDir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }

  /**
   * 进入规划模式
   */
  async enterPlanMode(taskDescription: string): Promise<PlanSession> {
    await this.lock.acquire();
    try {
      await this.ensurePlanDir();

      const sessionId = this.generateSessionId();
      const filePath = path.join(this.planDir, `${sessionId}.md`);

      const session: PlanSession = {
        id: sessionId,
        status: 'planning',
        content: null,
        filePath,
        currentStep: 0,
      };

      // 创建初始 plan 文件
      const initialContent = `# 实现方案

## 任务
${taskDescription}

## 状态
正在规划中...

---

*此文件由 LSC-AI 自动生成，请勿手动编辑*
`;

      await fs.writeFile(filePath, initialContent, 'utf-8');

      this.sessions.set(sessionId, session);
      this.currentSessionId = sessionId;

      return session;
    } finally {
      this.lock.release();
    }
  }

  /**
   * 更新 Plan 内容
   */
  async updatePlan(content: Partial<PlanContent>): Promise<void> {
    await this.lock.acquire();
    try {
      const session = this.getCurrentSession();
      if (!session) {
        throw new Error('没有活动的规划会话');
      }

      if (!session.content) {
        session.content = {
          title: '',
          description: '',
          steps: [],
          affectedFiles: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      // 合并内容
      Object.assign(session.content, content, { updatedAt: Date.now() });

      // 写入文件
      await this.writePlanFile(session);
    } finally {
      this.lock.release();
    }
  }

  /**
   * 写入 Plan 文件
   */
  private async writePlanFile(session: PlanSession): Promise<void> {
    if (!session.content) return;

    const { content } = session;
    const lines: string[] = [];

    lines.push(`# ${content.title || '实现方案'}`);
    lines.push('');

    if (content.description) {
      lines.push('## 任务描述');
      lines.push(content.description);
      lines.push('');
    }

    if (content.analysis) {
      lines.push('## 需求分析');
      lines.push(content.analysis);
      lines.push('');
    }

    if (content.steps.length > 0) {
      lines.push('## 实现步骤');
      lines.push('');
      for (const step of content.steps) {
        const checkbox = step.completed ? '[x]' : '[ ]';
        lines.push(`### ${step.index}. ${step.title}`);
        lines.push('');
        lines.push(step.description);
        if (step.files && step.files.length > 0) {
          lines.push('');
          lines.push('**涉及文件:**');
          for (const file of step.files) {
            lines.push(`- \`${file}\``);
          }
        }
        lines.push('');
      }
    }

    if (content.affectedFiles.length > 0) {
      lines.push('## 影响的文件');
      lines.push('');
      for (const file of content.affectedFiles) {
        lines.push(`- \`${file}\``);
      }
      lines.push('');
    }

    if (content.risks && content.risks.length > 0) {
      lines.push('## 潜在风险');
      lines.push('');
      for (const risk of content.risks) {
        lines.push(`- ${risk}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(`*生成时间: ${new Date(content.createdAt).toLocaleString()}*`);
    lines.push(`*更新时间: ${new Date(content.updatedAt).toLocaleString()}*`);

    await fs.writeFile(session.filePath, lines.join('\n'), 'utf-8');
  }

  /**
   * 提交规划等待审批
   */
  async submitForApproval(): Promise<PlanContent | null> {
    await this.lock.acquire();
    try {
      const session = this.getCurrentSession();
      if (!session) {
        throw new Error('没有活动的规划会话');
      }

      if (!session.content || session.content.steps.length === 0) {
        throw new Error('规划内容为空，无法提交');
      }

      session.status = 'pending_approval';
      await this.writePlanFile(session);

      return session.content;
    } finally {
      this.lock.release();
    }
  }

  /**
   * 批准规划
   */
  approvePlan(): PlanContent | null {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('没有活动的规划会话');
    }

    session.status = 'approved';
    return session.content;
  }

  /**
   * 拒绝规划
   */
  rejectPlan(feedback?: string): void {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('没有活动的规划会话');
    }

    session.status = 'rejected';
    session.userFeedback = feedback;
  }

  /**
   * 退出规划模式
   */
  exitPlanMode(): void {
    const session = this.getCurrentSession();
    if (session) {
      session.status = 'inactive';
    }
    this.currentSessionId = null;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): PlanSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  /**
   * 是否在规划模式中
   */
  isInPlanMode(): boolean {
    const session = this.getCurrentSession();
    return session !== null && (session.status === 'planning' || session.status === 'pending_approval');
  }

  /**
   * 获取当前状态
   */
  getStatus(): PlanStatus {
    const session = this.getCurrentSession();
    return session?.status || 'inactive';
  }

  /**
   * 标记步骤完成
   */
  markStepCompleted(stepIndex: number): void {
    const session = this.getCurrentSession();
    if (!session || !session.content) return;

    const step = session.content.steps.find(s => s.index === stepIndex);
    if (step) {
      step.completed = true;
      session.currentStep = stepIndex + 1;
    }
  }

  /**
   * 获取下一个待执行步骤
   */
  getNextStep(): PlanStep | null {
    const session = this.getCurrentSession();
    if (!session || !session.content) return null;

    return session.content.steps.find(s => !s.completed) || null;
  }

  /**
   * 读取 Plan 文件内容
   */
  async readPlanFile(): Promise<string | null> {
    const session = this.getCurrentSession();
    if (!session) return null;

    try {
      return await fs.readFile(session.filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 获取 Plan 文件路径
   */
  getPlanFilePath(): string | null {
    const session = this.getCurrentSession();
    return session?.filePath || null;
  }
}

// 全局 Plan 管理器实例
export const planManager = new PlanManager();

// getPlanModeSystemPrompt 已移至 prompts.ts，统一管理所有提示词
