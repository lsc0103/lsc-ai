/**
 * Plan 模式工具
 * 提供进入和退出规划模式的工具
 */

import type { Tool, ToolResult } from './types.js';
import type { ToolDefinition } from '../llm/types.js';
import { planManager, type PlanContent } from '../agent/planMode.js';

/**
 * EnterPlanMode 工具 - 进入规划模式
 */
export class EnterPlanModeTool implements Tool {
  definition: ToolDefinition = {
    name: 'enterPlanMode',
    description: `进入规划模式，用于在执行复杂任务前先进行方案设计。

当遇到以下情况时应该使用此工具：
1. 新功能实现 - 需要添加有意义的新功能
2. 多种实现方案 - 任务可以有多种不同的解决方式
3. 代码修改 - 会影响现有行为或结构的更改
4. 架构决策 - 需要在模式或技术之间做选择
5. 多文件更改 - 任务可能涉及超过 2-3 个文件
6. 需求不明确 - 需要先探索才能理解完整范围

在规划模式中，你可以：
- 使用搜索工具探索代码库
- 阅读关键文件了解现有架构
- 设计实现方案
- 但**不能执行任何写入操作**

完成规划后，使用 exitPlanMode 工具提交方案等待用户审批。`,
    parameters: {
      type: 'object' as const,
      properties: {
        taskDescription: {
          type: 'string',
          description: '要规划的任务描述',
        },
      },
      required: ['taskDescription'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const taskDescription = args.taskDescription as string;

    if (!taskDescription || taskDescription.trim() === '') {
      return {
        success: false,
        output: '',
        error: '任务描述不能为空',
      };
    }

    try {
      // 检查是否已经在规划模式中
      if (planManager.isInPlanMode()) {
        const session = planManager.getCurrentSession();
        return {
          success: false,
          output: '',
          error: `已经在规划模式中，当前会话 ID: ${session?.id}`,
        };
      }

      // 进入规划模式
      const session = await planManager.enterPlanMode(taskDescription);

      return {
        success: true,
        output: `已进入规划模式

**会话 ID**: ${session.id}
**Plan 文件**: ${session.filePath}
**任务**: ${taskDescription}

现在你处于规划模式，请：
1. 使用 glob、grep、read 等工具探索代码库
2. 分析现有代码结构
3. 设计实现方案
4. 使用 updatePlan 更新方案内容
5. 完成后使用 exitPlanMode 提交方案

**重要**: 在规划模式中不能执行任何写入操作！`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `进入规划模式失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * UpdatePlan 工具 - 更新规划内容
 */
export class UpdatePlanTool implements Tool {
  definition: ToolDefinition = {
    name: 'updatePlan',
    description: `更新当前规划的内容。在规划模式中使用此工具来逐步完善实现方案。

可以更新的内容包括：
- title: 方案标题
- description: 任务描述
- analysis: 需求分析
- steps: 实现步骤数组
- affectedFiles: 影响的文件列表
- risks: 潜在风险列表`,
    parameters: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: '方案标题',
        },
        description: {
          type: 'string',
          description: '任务描述',
        },
        analysis: {
          type: 'string',
          description: '需求分析',
        },
        steps: {
          type: 'string',
          description: '实现步骤 (JSON 数组格式，每个元素包含 index, title, description, files 字段)',
        },
        affectedFiles: {
          type: 'string',
          description: '影响的文件列表 (JSON 字符串数组格式)',
        },
        risks: {
          type: 'string',
          description: '潜在风险列表 (JSON 字符串数组格式)',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      if (!planManager.isInPlanMode()) {
        return {
          success: false,
          output: '',
          error: '当前不在规划模式中，请先使用 enterPlanMode 进入规划模式',
        };
      }

      // 构建更新内容
      const content: Partial<PlanContent> = {};

      if (args.title) content.title = args.title as string;
      if (args.description) content.description = args.description as string;
      if (args.analysis) content.analysis = args.analysis as string;

      // 解析 JSON 字符串参数
      if (args.steps) {
        try {
          const stepsData = typeof args.steps === 'string' ? JSON.parse(args.steps) : args.steps;
          content.steps = stepsData as PlanContent['steps'];
        } catch {
          return { success: false, output: '', error: 'steps 参数格式错误，请提供有效的 JSON 数组' };
        }
      }

      if (args.affectedFiles) {
        try {
          const filesData = typeof args.affectedFiles === 'string' ? JSON.parse(args.affectedFiles) : args.affectedFiles;
          content.affectedFiles = filesData as string[];
        } catch {
          return { success: false, output: '', error: 'affectedFiles 参数格式错误，请提供有效的 JSON 数组' };
        }
      }

      if (args.risks) {
        try {
          const risksData = typeof args.risks === 'string' ? JSON.parse(args.risks) : args.risks;
          content.risks = risksData as string[];
        } catch {
          return { success: false, output: '', error: 'risks 参数格式错误，请提供有效的 JSON 数组' };
        }
      }

      await planManager.updatePlan(content);

      const session = planManager.getCurrentSession();
      const stepCount = session?.content?.steps.length || 0;

      return {
        success: true,
        output: `规划已更新

**标题**: ${session?.content?.title || '(未设置)'}
**步骤数**: ${stepCount}
**影响文件数**: ${session?.content?.affectedFiles.length || 0}

Plan 文件已更新: ${session?.filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `更新规划失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * ExitPlanMode 工具 - 退出规划模式并提交审批
 */
export class ExitPlanModeTool implements Tool {
  definition: ToolDefinition = {
    name: 'exitPlanMode',
    description: `退出规划模式并提交方案等待用户审批。

在完成方案设计后使用此工具：
1. 提交方案内容
2. 等待用户审批
3. 用户批准后可以开始执行

**注意**:
- 确保方案包含清晰的实现步骤
- 确保列出所有需要修改的文件
- 如果方案不完整，请先使用 updatePlan 完善`,
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  // 回调函数，用于通知 CLI 需要用户审批
  private onPendingApproval?: (content: PlanContent) => void;

  setApprovalCallback(callback: (content: PlanContent) => void): void {
    this.onPendingApproval = callback;
  }

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    try {
      if (!planManager.isInPlanMode()) {
        return {
          success: false,
          output: '',
          error: '当前不在规划模式中',
        };
      }

      const content = await planManager.submitForApproval();

      if (!content) {
        return {
          success: false,
          output: '',
          error: '规划内容为空，无法提交',
        };
      }

      // 如果有回调，通知 CLI
      if (this.onPendingApproval) {
        this.onPendingApproval(content);
      }

      // 格式化方案摘要
      const summary = formatPlanSummary(content);

      return {
        success: true,
        output: `规划已提交，等待审批

${summary}

**状态**: pending_approval (等待审批)

**下一步操作**:
- 使用 \`approvePlan\` 工具批准方案并开始执行
- 使用 \`rejectPlan\` 工具拒绝方案并返回修改

**重要**: 在非交互模式下，你需要调用 approvePlan 来批准方案才能继续执行写入操作！`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `提交规划失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * ApprovePlan 工具 - 批准规划并开始执行
 */
export class ApprovePlanTool implements Tool {
  definition: ToolDefinition = {
    name: 'approvePlan',
    description: `批准当前规划并开始执行。

在以下情况下使用此工具：
1. 用户已明确批准方案
2. 在自动化测试/非交互模式下自动批准
3. 需要继续执行已提交的方案

**注意**:
- 只能在 pending_approval 状态下使用
- 批准后将退出规划模式，可以开始执行写入操作`,
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const session = planManager.getCurrentSession();

      if (!session) {
        return {
          success: false,
          output: '',
          error: '没有活动的规划会话',
        };
      }

      if (session.status !== 'pending_approval') {
        return {
          success: false,
          output: '',
          error: `无法批准：当前状态为 "${session.status}"，需要先提交方案 (exitPlanMode)`,
        };
      }

      const content = planManager.approvePlan();

      // 完全退出规划模式
      planManager.exitPlanMode();

      if (!content) {
        return {
          success: false,
          output: '',
          error: '规划内容为空',
        };
      }

      const stepList = content.steps.map(s => `${s.index}. ${s.title}`).join('\n');

      return {
        success: true,
        output: `方案已批准，开始执行！

**标题**: ${content.title}
**步骤数**: ${content.steps.length}

### 执行步骤:
${stepList}

你现在可以开始执行方案中的步骤了。`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `批准规划失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * RejectPlan 工具 - 拒绝规划并返回修改
 */
export class RejectPlanTool implements Tool {
  definition: ToolDefinition = {
    name: 'rejectPlan',
    description: `拒绝当前规划并返回修改。

在以下情况下使用此工具：
1. 用户要求修改方案
2. 发现方案有问题需要调整
3. 需要重新规划

**注意**:
- 只能在 pending_approval 状态下使用
- 拒绝后将返回规划模式，可以继续修改方案`,
    parameters: {
      type: 'object' as const,
      properties: {
        feedback: {
          type: 'string',
          description: '拒绝原因或修改建议',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const session = planManager.getCurrentSession();

      if (!session) {
        return {
          success: false,
          output: '',
          error: '没有活动的规划会话',
        };
      }

      if (session.status !== 'pending_approval') {
        return {
          success: false,
          output: '',
          error: `无法拒绝：当前状态为 "${session.status}"`,
        };
      }

      const feedback = args.feedback as string | undefined;
      planManager.rejectPlan(feedback);

      // 返回规划模式继续修改
      session.status = 'planning';

      return {
        success: true,
        output: `方案已拒绝，返回规划模式

${feedback ? `**反馈**: ${feedback}\n` : ''}
请根据反馈修改方案后重新提交。`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `拒绝规划失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * CancelPlanMode 工具 - 取消规划模式（不提交）
 */
export class CancelPlanModeTool implements Tool {
  definition: ToolDefinition = {
    name: 'cancelPlanMode',
    description: `取消当前规划模式，不提交方案直接退出。

在以下情况下使用此工具：
1. 决定不需要规划，直接执行任务
2. 用户要求取消规划
3. 任务不适合规划模式
4. 需要重新开始一个新的规划

**注意**:
- 当前规划内容将被丢弃
- 退出后可以直接执行写入操作
- 如果想保留方案内容，请使用 exitPlanMode 提交方案`,
    parameters: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          description: '取消原因（可选）',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const session = planManager.getCurrentSession();

      if (!session) {
        return {
          success: true,
          output: '当前不在规划模式中，无需取消',
        };
      }

      const reason = args.reason as string | undefined;
      const sessionId = session.id;
      const hadContent = session.content !== null;

      // 直接退出规划模式
      planManager.exitPlanMode();

      return {
        success: true,
        output: `已取消规划模式

**会话 ID**: ${sessionId}
**已丢弃内容**: ${hadContent ? '是' : '否'}
${reason ? `**取消原因**: ${reason}\n` : ''}
你现在可以直接执行任务，无需规划。`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `取消规划模式失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * ReadPlan 工具 - 读取当前规划内容
 */
export class ReadPlanTool implements Tool {
  definition: ToolDefinition = {
    name: 'readPlan',
    description: '读取当前规划的完整内容',
    parameters: {
      type: 'object' as const,
      properties: {},
    },
  };

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const session = planManager.getCurrentSession();

      if (!session) {
        return {
          success: false,
          output: '',
          error: '没有活动的规划会话',
        };
      }

      const fileContent = await planManager.readPlanFile();

      return {
        success: true,
        output: `**会话 ID**: ${session.id}
**状态**: ${session.status}
**文件**: ${session.filePath}
**当前步骤**: ${session.currentStep}

---

${fileContent || '(文件为空)'}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `读取规划失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 格式化方案摘要
 */
function formatPlanSummary(content: PlanContent): string {
  const lines: string[] = [];

  lines.push(`## ${content.title || '实现方案'}`);
  lines.push('');

  if (content.description) {
    lines.push(`**描述**: ${content.description}`);
    lines.push('');
  }

  if (content.steps.length > 0) {
    lines.push('### 实现步骤');
    for (const step of content.steps) {
      lines.push(`${step.index}. **${step.title}**`);
      if (step.files && step.files.length > 0) {
        lines.push(`   涉及: ${step.files.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (content.affectedFiles.length > 0) {
    lines.push(`### 影响的文件 (${content.affectedFiles.length})`);
    for (const file of content.affectedFiles.slice(0, 10)) {
      lines.push(`- \`${file}\``);
    }
    if (content.affectedFiles.length > 10) {
      lines.push(`... 还有 ${content.affectedFiles.length - 10} 个文件`);
    }
    lines.push('');
  }

  if (content.risks && content.risks.length > 0) {
    lines.push('### 潜在风险');
    for (const risk of content.risks) {
      lines.push(`- ${risk}`);
    }
  }

  return lines.join('\n');
}

/**
 * 创建所有 Plan 模式工具
 */
export function createPlanTools(): Tool[] {
  return [
    new EnterPlanModeTool(),
    new UpdatePlanTool(),
    new ExitPlanModeTool(),
    new ReadPlanTool(),
    new ApprovePlanTool(),
    new RejectPlanTool(),
    new CancelPlanModeTool(),
  ];
}

// 导出类型
export { PlanContent };
