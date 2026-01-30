/**
 * Skill 管理器
 * 管理和执行用户定义的技能
 */

import type {
  SkillDefinition,
  SkillContext,
  SkillResult,
  SkillStatus,
  SkillRegistry,
} from './types.js';
import type { LLMProvider, Message } from '../llm/types.js';
import type { Tool } from '../tools/types.js';

/**
 * Skill 执行器实现
 */
class SkillExecutorImpl {
  private skill: SkillDefinition;
  private llm: LLMProvider;
  private tools: Tool[];
  private status: SkillStatus = 'idle';
  private abortController: AbortController | null = null;

  constructor(skill: SkillDefinition, llm: LLMProvider, tools: Tool[]) {
    this.skill = skill;
    this.llm = llm;
    this.tools = this.filterTools(tools);
  }

  /**
   * 根据技能配置过滤工具
   */
  private filterTools(allTools: Tool[]): Tool[] {
    let tools = allTools;

    // 如果指定了允许的工具，只使用这些工具
    if (this.skill.allowedTools && this.skill.allowedTools.length > 0) {
      const allowed = new Set(this.skill.allowedTools);
      tools = tools.filter(t => allowed.has(t.definition.name));
    }

    // 如果指定了禁用的工具，排除这些工具
    if (this.skill.disabledTools && this.skill.disabledTools.length > 0) {
      const disabled = new Set(this.skill.disabledTools);
      tools = tools.filter(t => !disabled.has(t.definition.name));
    }

    return tools;
  }

  /**
   * 执行技能
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();
    this.status = 'running';
    this.abortController = new AbortController();

    let toolCallCount = 0;
    const maxIterations = this.skill.maxIterations || 10;
    const toolMap = new Map(this.tools.map(t => [t.definition.name, t]));

    // 构建消息
    const messages: Message[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(context),
      },
      {
        role: 'user',
        content: this.buildUserPrompt(context),
      },
    ];

    try {
      let iterations = 0;

      while (iterations < maxIterations) {
        // 检查是否被取消
        if (this.abortController.signal.aborted) {
          this.status = 'cancelled';
          return {
            success: false,
            output: '技能执行已取消',
            error: 'cancelled',
            toolCallCount,
            duration: Date.now() - startTime,
          };
        }

        iterations++;

        // 调用 LLM
        const response = await this.llm.chat(
          messages,
          this.tools.map(t => t.definition)
        );

        // 添加助手响应
        messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });

        // 如果没有工具调用，完成
        if (!response.toolCalls || response.toolCalls.length === 0) {
          this.status = 'completed';
          return {
            success: true,
            output: response.content,
            toolCallCount,
            duration: Date.now() - startTime,
          };
        }

        // 执行工具调用
        for (const toolCall of response.toolCalls) {
          const tool = toolMap.get(toolCall.name);
          if (!tool) {
            messages.push({
              role: 'tool',
              content: `工具 ${toolCall.name} 不存在或不可用`,
              toolCallId: toolCall.id,
            });
            continue;
          }

          try {
            const result = await tool.execute(toolCall.arguments);
            toolCallCount++;
            messages.push({
              role: 'tool',
              content: result.success ? result.output : `错误: ${result.error}`,
              toolCallId: toolCall.id,
            });
          } catch (error) {
            messages.push({
              role: 'tool',
              content: `执行错误: ${(error as Error).message}`,
              toolCallId: toolCall.id,
            });
          }
        }
      }

      // 达到最大迭代次数
      this.status = 'completed';
      const lastAssistant = messages.filter(m => m.role === 'assistant').pop();
      const lastContent = lastAssistant?.content;
      const output = typeof lastContent === 'string'
        ? lastContent
        : '达到最大迭代次数';

      return {
        success: true,
        output,
        toolCallCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.status = 'failed';
      return {
        success: false,
        output: '',
        error: (error as Error).message,
        toolCallCount,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(context: SkillContext): string {
    let prompt = this.skill.systemPrompt;

    // 添加工作目录信息
    prompt += `\n\n当前工作目录: ${context.cwd}`;

    // 添加对话上下文
    if (context.conversationSummary) {
      prompt += `\n\n对话背景:\n${context.conversationSummary}`;
    }

    return prompt;
  }

  /**
   * 构建用户提示词
   */
  private buildUserPrompt(context: SkillContext): string {
    if (context.args) {
      return `执行 ${this.skill.name} 技能\n参数: ${context.args}`;
    }
    return `执行 ${this.skill.name} 技能`;
  }

  /**
   * 取消执行
   */
  cancel(): void {
    this.abortController?.abort();
    this.status = 'cancelled';
  }

  /**
   * 获取状态
   */
  getStatus(): SkillStatus {
    return this.status;
  }
}

/**
 * Skill 管理器
 */
export class SkillManager implements SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private executors: Map<string, SkillExecutorImpl> = new Map();
  private llm: LLMProvider | null = null;
  private tools: Tool[] = [];

  /**
   * 设置 LLM 提供者
   */
  setLLM(llm: LLMProvider): void {
    this.llm = llm;
  }

  /**
   * 设置可用工具
   */
  setTools(tools: Tool[]): void {
    this.tools = tools;
  }

  /**
   * 注册技能
   */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * 批量注册技能
   */
  registerMany(skills: SkillDefinition[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * 注销技能
   */
  unregister(name: string): void {
    this.skills.delete(name);
  }

  /**
   * 获取技能
   */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有技能
   */
  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * 检查技能是否存在
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 执行技能
   */
  async execute(name: string, context: SkillContext): Promise<SkillResult> {
    const skill = this.skills.get(name);
    if (!skill) {
      return {
        success: false,
        output: '',
        error: `技能 "${name}" 不存在`,
        toolCallCount: 0,
        duration: 0,
      };
    }

    if (!this.llm) {
      return {
        success: false,
        output: '',
        error: 'LLM 未初始化',
        toolCallCount: 0,
        duration: 0,
      };
    }

    // 创建执行器
    const executor = new SkillExecutorImpl(skill, this.llm, this.tools);
    this.executors.set(name, executor);

    try {
      const result = await executor.execute(context);
      return result;
    } finally {
      this.executors.delete(name);
    }
  }

  /**
   * 取消正在执行的技能
   */
  cancel(name: string): boolean {
    const executor = this.executors.get(name);
    if (executor) {
      executor.cancel();
      return true;
    }
    return false;
  }

  /**
   * 获取技能执行状态
   */
  getStatus(name: string): SkillStatus | undefined {
    const executor = this.executors.get(name);
    return executor?.getStatus();
  }

  /**
   * 获取正在运行的技能
   */
  getRunningSkills(): string[] {
    return Array.from(this.executors.entries())
      .filter(([_, executor]) => executor.getStatus() === 'running')
      .map(([name]) => name);
  }
}

// 全局 Skill 管理器实例
export const skillManager = new SkillManager();
