/**
 * Skill 类型定义
 * 支持用户定义的技能/命令
 */

import type { Tool } from '../tools/types.js';

/**
 * Skill 定义
 */
export interface SkillDefinition {
  /** 技能名称（如 commit, review-pr） */
  name: string;
  /** 技能描述 */
  description: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 允许使用的工具名称（空数组表示所有工具） */
  allowedTools?: string[];
  /** 禁用的工具名称 */
  disabledTools?: string[];
  /** 是否需要用户输入参数 */
  requiresArgs?: boolean;
  /** 参数描述 */
  argsDescription?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 是否允许后台运行 */
  allowBackground?: boolean;
}

/**
 * Skill 执行上下文
 */
export interface SkillContext {
  /** 用户提供的参数 */
  args?: string;
  /** 工作目录 */
  cwd: string;
  /** 当前对话历史摘要（可选） */
  conversationSummary?: string;
  /** 是否在后台运行 */
  runInBackground?: boolean;
}

/**
 * Skill 执行结果
 */
export interface SkillResult {
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output: string;
  /** 错误信息 */
  error?: string;
  /** 使用的工具调用数 */
  toolCallCount: number;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * Skill 状态
 */
export type SkillStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Skill 执行器接口
 */
export interface SkillExecutor {
  /** 执行技能 */
  execute(context: SkillContext): Promise<SkillResult>;
  /** 取消执行 */
  cancel(): void;
  /** 获取状态 */
  getStatus(): SkillStatus;
}

/**
 * Skill 注册表
 */
export interface SkillRegistry {
  /** 注册技能 */
  register(skill: SkillDefinition): void;
  /** 注销技能 */
  unregister(name: string): void;
  /** 获取技能 */
  get(name: string): SkillDefinition | undefined;
  /** 列出所有技能 */
  list(): SkillDefinition[];
  /** 检查技能是否存在 */
  has(name: string): boolean;
}
