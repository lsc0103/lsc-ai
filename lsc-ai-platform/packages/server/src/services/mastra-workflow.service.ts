/**
 * Mastra Workflow Service
 *
 * 将 Mastra Workflow 引擎集成到 LSC-AI 平台，用于：
 * 1. RPA 流程执行（基于 Prisma RpaFlow 定义）
 * 2. 定时任务执行（基于 Prisma ScheduledTask）
 * 3. 多步骤 AI 任务编排
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { MastraAgentService } from './mastra-agent.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** RPA 步骤类型 */
interface RpaStepDef {
  id: string;
  type: 'ai_chat' | 'file_operation' | 'web_fetch' | 'shell_command' | 'condition' | 'loop';
  config: Record<string, any>;
  next?: string; // 下一步 ID
}

/** RPA 流程定义 */
interface RpaFlowDef {
  steps: RpaStepDef[];
  variables?: Record<string, any>;
}

@Injectable()
export class MastraWorkflowService implements OnModuleInit {
  private readonly logger = new Logger(MastraWorkflowService.name);

  constructor(
    private readonly mastraAgentService: MastraAgentService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Mastra Workflow Service 初始化完成');
  }

  /**
   * 执行 RPA 流程
   * 将 Prisma RpaFlow.flowData 转换为 Mastra Workflow 并执行
   */
  async executeRpaFlow(flowId: string, userId: string, inputData?: Record<string, any>) {
    // 1. 获取流程定义
    const flow = await this.prisma.rpaFlow.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      throw new Error(`RPA Flow not found: ${flowId}`);
    }

    if (flow.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const flowDef = flow.flowData as unknown as RpaFlowDef;
    if (!flowDef?.steps?.length) {
      throw new Error('Flow has no steps');
    }

    this.logger.log(`[Workflow] 开始执行 RPA 流程: ${flow.name} (${flowId})`);

    // 2. 构建 Mastra Workflow
    const workflow = this.buildWorkflow(flowId, flow.name, flowDef);

    // 3. 注册 Mastra 实例
    const mastra = this.mastraAgentService.getMastra();
    workflow.__registerMastra(mastra);

    // 4. 创建并执行
    const run = await workflow.createRun({ resourceId: userId });
    const result = await run.start({
      inputData: {
        flowId,
        userId,
        variables: { ...flowDef.variables, ...inputData },
      },
    });

    this.logger.log(`[Workflow] RPA 流程执行完成: ${result.status}`);

    return {
      status: result.status,
      result: result.status === 'success' ? result.result : undefined,
      error: result.status === 'failed' ? (result as any).error?.message : undefined,
    };
  }

  /**
   * 执行定时任务
   */
  async executeScheduledTask(taskId: string) {
    const task = await this.prisma.scheduledTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Scheduled task not found: ${taskId}`);
    }

    const taskConfig = task.taskConfig as Record<string, any>;

    this.logger.log(`[Workflow] 开始执行定时任务: ${task.name} (${taskId})`);

    // 记录执行日志
    const log = await this.prisma.taskLog.create({
      data: {
        taskId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      let result: any;

      if (task.taskType === 'prompt') {
        // AI 对话类型任务
        result = await this.executePromptTask(task.userId, taskConfig);
      } else if (task.taskType === 'rpa') {
        // RPA 流程类型任务
        const rpaFlowId = taskConfig.rpaFlowId;
        if (rpaFlowId) {
          result = await this.executeRpaFlow(rpaFlowId, task.userId, taskConfig.inputData);
        }
      }

      // 更新日志
      await this.prisma.taskLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          endedAt: new Date(),
          result: result || {},
        },
      });

      // 更新任务最后执行时间
      await this.prisma.scheduledTask.update({
        where: { id: taskId },
        data: { lastRunAt: new Date() },
      });

      return result;
    } catch (error: any) {
      // 更新日志
      await this.prisma.taskLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          endedAt: new Date(),
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * 执行 AI Prompt 任务
   */
  private async executePromptTask(userId: string, config: Record<string, any>) {
    const { prompt, threadId } = config;
    if (!prompt) throw new Error('Prompt is required');

    const result = await this.mastraAgentService.chat({
      message: prompt,
      threadId: threadId || `scheduled-${Date.now()}`,
      resourceId: userId,
    });

    return { text: result.text, toolCalls: result.toolCalls.length };
  }

  /**
   * 将 RPA 流程定义构建为 Mastra Workflow
   */
  private buildWorkflow(flowId: string, flowName: string, flowDef: RpaFlowDef) {
    // 创建基础工作流
    const workflow = createWorkflow({
      id: `rpa-${flowId}`,
      description: flowName,
      inputSchema: z.object({
        flowId: z.string(),
        userId: z.string(),
        variables: z.record(z.any()).optional(),
      }),
      outputSchema: z.object({
        results: z.array(z.any()),
        status: z.string(),
      }),
    });

    // 将步骤串联
    const steps = flowDef.steps.map((stepDef) => this.createRpaStep(stepDef));

    // 串联所有步骤（类型宽松处理，因为步骤间通过 variables 传递数据）
    let chain = workflow.then(steps[0]!) as any;
    for (let i = 1; i < steps.length; i++) {
      chain = chain.then(steps[i]!);
    }

    chain.commit();

    return workflow;
  }

  /**
   * 将 RPA 步骤定义转换为 Mastra Step
   */
  private createRpaStep(stepDef: RpaStepDef) {
    const mastraAgent = this.mastraAgentService;

    switch (stepDef.type) {
      case 'ai_chat':
        return createStep({
          id: stepDef.id,
          description: stepDef.config.description || 'AI 对话',
          inputSchema: z.object({
            flowId: z.string(),
            userId: z.string(),
            variables: z.record(z.any()).optional(),
          }),
          outputSchema: z.object({
            text: z.string(),
            toolCallsCount: z.number(),
          }),
          execute: async ({ inputData }) => {
            const prompt = stepDef.config.prompt || '';
            // 替换变量
            const resolvedPrompt = this.resolveVariables(prompt, inputData.variables || {});
            const result = await mastraAgent.chat({
              message: resolvedPrompt,
              threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
              resourceId: inputData.userId,
            });
            return { text: result.text, toolCallsCount: result.toolCalls.length };
          },
        });

      case 'shell_command':
        return createStep({
          id: stepDef.id,
          description: stepDef.config.description || 'Shell 命令',
          inputSchema: z.object({
            flowId: z.string(),
            userId: z.string(),
            variables: z.record(z.any()).optional(),
          }),
          outputSchema: z.object({
            text: z.string(),
            toolCallsCount: z.number(),
          }),
          execute: async ({ inputData }) => {
            const command = this.resolveVariables(
              stepDef.config.command || '',
              inputData.variables || {},
            );
            const result = await mastraAgent.chat({
              message: `请执行以下命令并返回结果: ${command}`,
              threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
              resourceId: inputData.userId,
            });
            return { text: result.text, toolCallsCount: result.toolCalls.length };
          },
        });

      case 'web_fetch':
        return createStep({
          id: stepDef.id,
          description: stepDef.config.description || '网页抓取',
          inputSchema: z.object({
            flowId: z.string(),
            userId: z.string(),
            variables: z.record(z.any()).optional(),
          }),
          outputSchema: z.object({
            text: z.string(),
            toolCallsCount: z.number(),
          }),
          execute: async ({ inputData }) => {
            const url = this.resolveVariables(
              stepDef.config.url || '',
              inputData.variables || {},
            );
            const result = await mastraAgent.chat({
              message: `请抓取以下网页的内容: ${url}`,
              threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
              resourceId: inputData.userId,
            });
            return { text: result.text, toolCallsCount: result.toolCalls.length };
          },
        });

      case 'file_operation':
        return createStep({
          id: stepDef.id,
          description: stepDef.config.description || '文件操作',
          inputSchema: z.object({
            flowId: z.string(),
            userId: z.string(),
            variables: z.record(z.any()).optional(),
          }),
          outputSchema: z.object({
            text: z.string(),
            toolCallsCount: z.number(),
          }),
          execute: async ({ inputData }) => {
            const instruction = this.resolveVariables(
              stepDef.config.instruction || '',
              inputData.variables || {},
            );
            const result = await mastraAgent.chat({
              message: instruction,
              threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
              resourceId: inputData.userId,
            });
            return { text: result.text, toolCallsCount: result.toolCalls.length };
          },
        });

      default:
        // 默认: 使用 AI Agent 处理
        return createStep({
          id: stepDef.id,
          description: `RPA Step: ${stepDef.type}`,
          inputSchema: z.object({
            flowId: z.string(),
            userId: z.string(),
            variables: z.record(z.any()).optional(),
          }),
          outputSchema: z.object({
            text: z.string(),
            toolCallsCount: z.number(),
          }),
          execute: async ({ inputData }) => {
            const result = await mastraAgent.chat({
              message: `执行 RPA 步骤 (${stepDef.type}): ${JSON.stringify(stepDef.config)}`,
              threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
              resourceId: inputData.userId,
            });
            return { text: result.text, toolCallsCount: result.toolCalls.length };
          },
        });
    }
  }

  /**
   * 替换字符串中的变量占位符
   */
  private resolveVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }
}
