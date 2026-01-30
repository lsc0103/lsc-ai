/**
 * Task 工具
 * 启动子代理来处理复杂任务
 */

import type { Tool, ToolResult } from './types.js';
import type { ToolDefinition } from '../../llm/types.js';
import type { LLMProvider } from '../../llm/types.js';
import {
  getToolsForSubAgent,
  type SubAgentType,
  type SubAgentConfig,
} from '../../agent/subAgent.js';
import { agentManager } from '../../agent/agentManager.js';

export interface TaskArgs {
  /** 子代理类型 */
  subagent_type: SubAgentType;
  /** 任务描述 */
  prompt: string;
  /** 简短描述（用于显示） */
  description?: string;
  /** 是否在后台运行 */
  run_in_background?: boolean;
}

/**
 * Task 工具 - 启动子代理
 */
export class TaskTool implements Tool {
  private llm: LLMProvider;
  private allTools: Tool[];
  private cwd: string;
  private parentContext?: string;

  constructor(options: {
    llm: LLMProvider;
    tools: Tool[];
    cwd?: string;
    parentContext?: string;
  }) {
    this.llm = options.llm;
    this.allTools = options.tools;
    this.cwd = options.cwd || process.cwd();
    this.parentContext = options.parentContext;
  }

  definition: ToolDefinition = {
    name: 'task',
    description: `启动子代理来处理复杂的多步骤任务。

【核心决策：何时使用 explore 子代理】

⚠️ 开放探索（必须用 explore）vs 针尖查询（直接用工具）：

开放探索 → 必须用 task explore：
- "XX是怎么实现的？" → 需要理解代码逻辑
- "错误处理在哪里？" → 位置不确定，可能分散
- "帮我了解项目结构" → 需要综合分析
- "数据是怎么流转的？" → 需要追踪跨模块逻辑

针尖查询 → 直接用 glob/grep/read：
- "读取 src/auth.ts" → 明确文件路径
- "找到 class UserService" → 搜索特定类名
- "搜索 TODO 注释" → 明确文本模式

【子代理类型选择】
┌─────────┬──────────────────────────────────────────────┐
│ explore │ 开放探索：位置不确定、需要理解代码含义        │
│ plan    │ 方案设计：复杂功能、重构、架构决策            │
│ general │ 通用执行：代码修改、bug修复、功能实现         │
└─────────┴──────────────────────────────────────────────┘

【后台运行】适用于耗时任务，使用 taskOutput 获取结果`,
    parameters: {
      type: 'object',
      properties: {
        subagent_type: {
          type: 'string',
          enum: ['explore', 'plan', 'general'],
          description: '子代理类型: explore(探索代码), plan(设计方案), general(通用)',
        },
        prompt: {
          type: 'string',
          description: '详细的任务描述，子代理将根据此描述执行任务',
        },
        description: {
          type: 'string',
          description: '简短描述（3-5个词），用于任务列表显示',
        },
        run_in_background: {
          type: 'boolean',
          description: '是否在后台运行（默认 false）',
        },
      },
      required: ['subagent_type', 'prompt'],
    },
  };

  /**
   * 更新父代理上下文
   */
  setParentContext(context: string): void {
    this.parentContext = context;
  }

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const {
      subagent_type,
      prompt,
      description,
      run_in_background = false,
    } = args as unknown as TaskArgs;

    // 验证参数
    if (!subagent_type || !['explore', 'plan', 'general'].includes(subagent_type)) {
      return {
        success: false,
        output: '',
        error: '无效的子代理类型，必须是 explore、plan 或 general',
      };
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return {
        success: false,
        output: '',
        error: '任务描述不能为空',
      };
    }

    try {
      // 获取子代理可用的工具
      const subAgentTools = getToolsForSubAgent(subagent_type as SubAgentType, this.allTools);

      // 创建子代理配置
      const config: SubAgentConfig = {
        type: subagent_type as SubAgentType,
        prompt: prompt.trim(),
        llm: this.llm,
        tools: subAgentTools,
        cwd: this.cwd,
        parentContext: this.parentContext,
      };

      // 运行子代理
      const { taskId, result } = await agentManager.runTask(config, {
        description: description || prompt.slice(0, 50),
        runInBackground: run_in_background,
      });

      if (run_in_background) {
        // 后台运行，返回任务 ID
        return {
          success: true,
          output: `子代理任务已在后台启动\n任务 ID: ${taskId}\n类型: ${subagent_type}\n描述: ${description || prompt.slice(0, 50)}\n\n使用 taskOutput 工具获取结果`,
        };
      }

      // 前台运行，返回结果
      if (!result) {
        return {
          success: false,
          output: '',
          error: '子代理执行失败：无结果返回',
        };
      }

      if (!result.success) {
        return {
          success: false,
          output: result.output,
          error: result.error || '子代理执行失败',
        };
      }

      // 构建输出
      const output = this.formatResult(subagent_type, result);
      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `子代理执行错误: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 格式化子代理结果
   */
  private formatResult(type: string, result: NonNullable<Awaited<ReturnType<typeof agentManager.runTask>>['result']>): string {
    const lines: string[] = [];

    lines.push(`=== ${type.toUpperCase()} 子代理完成 ===`);
    lines.push(`迭代次数: ${result.iterations}`);
    lines.push(`耗时: ${(result.duration / 1000).toFixed(1)}s`);
    lines.push(`工具调用: ${result.toolCalls.length} 次`);
    lines.push('');

    // 工具调用摘要
    if (result.toolCalls.length > 0) {
      lines.push('工具调用记录:');
      for (const call of result.toolCalls.slice(-5)) {
        lines.push(`  - ${call.name}: ${JSON.stringify(call.args).slice(0, 80)}...`);
      }
      if (result.toolCalls.length > 5) {
        lines.push(`  ... 还有 ${result.toolCalls.length - 5} 个调用`);
      }
      lines.push('');
    }

    lines.push('结果:');
    lines.push(result.output);

    return lines.join('\n');
  }
}

/**
 * TaskOutput 工具 - 获取后台任务结果
 */
export class TaskOutputTool implements Tool {
  definition: ToolDefinition = {
    name: 'taskOutput',
    description: '获取后台运行的子代理任务结果',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'string',
          description: '任务 ID',
        },
        block: {
          type: 'boolean',
          description: '是否等待任务完成（默认 true）',
        },
        timeout: {
          type: 'number',
          description: '等待超时时间（毫秒，默认 30000）',
        },
      },
      required: ['task_id'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { task_id, block = true, timeout = 30000 } = args as {
      task_id: string;
      block?: boolean;
      timeout?: number;
    };

    if (!task_id) {
      return {
        success: false,
        output: '',
        error: '任务 ID 不能为空',
      };
    }

    const task = await agentManager.getTask(task_id);
    if (!task) {
      return {
        success: false,
        output: '',
        error: `任务 ${task_id} 不存在`,
      };
    }

    // 获取结果
    const result = await agentManager.getTaskResult(task_id, { block, timeout });

    if (!result) {
      if (task.status === 'running') {
        return {
          success: true,
          output: `任务 ${task_id} 仍在运行中...\n状态: ${task.status}\n描述: ${task.description}`,
        };
      }
      return {
        success: false,
        output: '',
        error: `任务 ${task_id} 无结果（状态: ${task.status}）`,
      };
    }

    // 格式化结果
    const lines: string[] = [];
    lines.push(`=== 任务 ${task_id} 结果 ===`);
    lines.push(`状态: ${task.status}`);
    lines.push(`类型: ${task.type}`);
    lines.push(`耗时: ${(result.duration / 1000).toFixed(1)}s`);
    lines.push('');
    lines.push(result.output);

    if (result.error) {
      lines.push('');
      lines.push(`错误: ${result.error}`);
    }

    return {
      success: result.success,
      output: lines.join('\n'),
      error: result.error,
    };
  }
}

/**
 * ListTasks 工具 - 列出所有任务
 */
export class ListTasksTool implements Tool {
  definition: ToolDefinition = {
    name: 'listTasks',
    description: '列出所有子代理任务',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
          description: '按状态筛选',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { status } = args as { status?: string };

    const tasks = await agentManager.listTasks(
      status ? { status: status as any } : undefined
    );

    if (tasks.length === 0) {
      return {
        success: true,
        output: '没有任务',
      };
    }

    const lines: string[] = ['任务列表:', ''];

    for (const task of tasks) {
      const duration = task.completedAt
        ? `${((task.completedAt - task.createdAt) / 1000).toFixed(1)}s`
        : `${((Date.now() - task.createdAt) / 1000).toFixed(1)}s (进行中)`;

      lines.push(`[${task.id}] ${task.type} - ${task.status}`);
      lines.push(`  描述: ${task.description}`);
      lines.push(`  耗时: ${duration}`);
      lines.push(`  后台: ${task.isBackground ? '是' : '否'}`);
      lines.push('');
    }

    return {
      success: true,
      output: lines.join('\n'),
    };
  }
}
