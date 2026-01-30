/**
 * 子代理模块
 * 支持主代理启动独立的子代理来处理特定任务
 */

import type { LLMProvider, Message, ToolCall } from '../llm/types.js';
import type { Tool, ToolResult } from '../tools/types.js';
import {
  getExploreAgentPrompt,
  getPlanAgentPrompt,
  getGeneralAgentPrompt,
  getWorkbenchBuilderAgentPrompt,
} from './prompts.js';

/**
 * 子代理类型定义
 */
export type SubAgentType = 'explore' | 'plan' | 'general' | 'workbench-builder';

/**
 * 子代理配置
 */
export interface SubAgentConfig {
  /** 子代理类型 */
  type: SubAgentType;
  /** 任务描述 */
  prompt: string;
  /** LLM 提供者 */
  llm: LLMProvider;
  /** 可用工具 */
  tools: Tool[];
  /** 工作目录 */
  cwd?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 父代理的上下文（可选，用于理解背景） */
  parentContext?: string;
}

/**
 * 子代理运行结果
 */
export interface SubAgentResult {
  /** 是否成功 */
  success: boolean;
  /** 输出内容 */
  output: string;
  /** 错误信息 */
  error?: string;
  /** 使用的工具调用 */
  toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
  }>;
  /** 迭代次数 */
  iterations: number;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * 子代理状态
 */
export type SubAgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 获取子代理的系统提示
 */
function getSubAgentSystemPrompt(type: SubAgentType, cwd: string): string {
  switch (type) {
    case 'explore':
      return getExploreAgentPrompt(cwd);
    case 'plan':
      return getPlanAgentPrompt(cwd);
    case 'workbench-builder':
      return getWorkbenchBuilderAgentPrompt(cwd);
    case 'general':
    default:
      return getGeneralAgentPrompt(cwd);
  }
}

/**
 * 子代理类
 */
export class SubAgent {
  private config: SubAgentConfig;
  private messages: Message[] = [];
  private toolMap: Map<string, Tool>;
  private status: SubAgentStatus = 'pending';
  private result: SubAgentResult | null = null;
  private abortController: AbortController | null = null;

  constructor(config: SubAgentConfig) {
    this.config = {
      maxIterations: 10,
      cwd: process.cwd(),
      ...config,
    };

    // 构建工具映射
    this.toolMap = new Map();
    for (const tool of config.tools) {
      this.toolMap.set(tool.definition.name, tool);
    }

    // 初始化消息
    this.messages = [
      {
        role: 'system',
        content: getSubAgentSystemPrompt(config.type, this.config.cwd!),
      },
    ];

    // 如果有父代理上下文，添加到消息中
    if (config.parentContext) {
      this.messages.push({
        role: 'user',
        content: `背景信息:\n${config.parentContext}\n\n---\n\n任务: ${config.prompt}`,
      });
    } else {
      this.messages.push({
        role: 'user',
        content: config.prompt,
      });
    }
  }

  /**
   * 运行子代理
   */
  async run(signal?: AbortSignal): Promise<SubAgentResult> {
    const startTime = Date.now();
    this.status = 'running';
    this.abortController = new AbortController();

    const toolCalls: SubAgentResult['toolCalls'] = [];
    let iterations = 0;

    try {
      while (iterations < this.config.maxIterations!) {
        // 检查是否被取消
        if (signal?.aborted || this.abortController.signal.aborted) {
          this.status = 'cancelled';
          return this.createResult(false, '任务被取消', toolCalls, iterations, startTime);
        }

        iterations++;

        // 调用 LLM
        const response = await this.config.llm.chat(
          this.messages,
          this.config.tools.map(t => t.definition)
        );

        // 添加助手响应到消息历史
        this.messages.push({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        });

        // 如果没有工具调用，任务完成
        if (!response.toolCalls || response.toolCalls.length === 0) {
          this.status = 'completed';
          return this.createResult(true, response.content, toolCalls, iterations, startTime);
        }

        // 执行工具调用
        for (const toolCall of response.toolCalls) {
          const tool = this.toolMap.get(toolCall.name);
          if (!tool) {
            const errorResult = `工具 ${toolCall.name} 不存在`;
            this.messages.push({
              role: 'tool',
              content: errorResult,
              toolCallId: toolCall.id,
            });
            toolCalls.push({
              name: toolCall.name,
              args: toolCall.arguments,
              result: errorResult,
            });
            continue;
          }

          try {
            const result = await tool.execute(toolCall.arguments);
            const resultStr = result.success
              ? result.output
              : `错误: ${result.error}`;

            this.messages.push({
              role: 'tool',
              content: resultStr,
              toolCallId: toolCall.id,
            });

            toolCalls.push({
              name: toolCall.name,
              args: toolCall.arguments,
              result: resultStr.slice(0, 500) + (resultStr.length > 500 ? '...' : ''),
            });
          } catch (error) {
            const errorResult = `执行错误: ${(error as Error).message}`;
            this.messages.push({
              role: 'tool',
              content: errorResult,
              toolCallId: toolCall.id,
            });
            toolCalls.push({
              name: toolCall.name,
              args: toolCall.arguments,
              result: errorResult,
            });
          }
        }
      }

      // 达到最大迭代次数
      this.status = 'completed';
      const lastAssistantMsg = this.messages
        .filter(m => m.role === 'assistant')
        .pop();
      const lastContent = lastAssistantMsg?.content;
      const outputText = typeof lastContent === 'string'
        ? lastContent
        : lastContent?.map(c => c.type === 'text' ? c.text : '').join('') || '达到最大迭代次数';
      return this.createResult(
        true,
        outputText,
        toolCalls,
        iterations,
        startTime
      );
    } catch (error) {
      this.status = 'failed';
      return this.createResult(
        false,
        '',
        toolCalls,
        iterations,
        startTime,
        (error as Error).message
      );
    }
  }

  /**
   * 取消运行
   */
  cancel(): void {
    this.abortController?.abort();
    this.status = 'cancelled';
  }

  /**
   * 获取状态
   */
  getStatus(): SubAgentStatus {
    return this.status;
  }

  /**
   * 获取结果
   */
  getResult(): SubAgentResult | null {
    return this.result;
  }

  /**
   * 创建结果对象
   */
  private createResult(
    success: boolean,
    output: string,
    toolCalls: SubAgentResult['toolCalls'],
    iterations: number,
    startTime: number,
    error?: string
  ): SubAgentResult {
    this.result = {
      success,
      output,
      error,
      toolCalls,
      iterations,
      duration: Date.now() - startTime,
    };
    return this.result;
  }
}

/**
 * 创建子代理的工具集
 */
export function getToolsForSubAgent(
  type: SubAgentType,
  allTools: Tool[]
): Tool[] {
  const toolNames = new Set<string>();

  switch (type) {
    case 'explore':
      // 探索代理只需要搜索和读取工具
      toolNames.add('glob');
      toolNames.add('grep');
      toolNames.add('read');
      toolNames.add('list');
      break;

    case 'plan':
      // 规划代理需要搜索、读取，但不需要写入
      toolNames.add('glob');
      toolNames.add('grep');
      toolNames.add('read');
      toolNames.add('list');
      break;

    case 'workbench-builder':
      // Workbench 构建代理需要读取和写入能力
      toolNames.add('glob');
      toolNames.add('grep');
      toolNames.add('read');
      toolNames.add('list');
      toolNames.add('write');
      toolNames.add('edit');
      break;

    case 'general':
    default:
      // 通用代理可以使用所有工具
      return allTools;
  }

  return allTools.filter(tool => toolNames.has(tool.definition.name));
}
