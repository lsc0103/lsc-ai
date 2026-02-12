/**
 * Mastra Workflow Service
 *
 * Integrates Mastra Workflow engine into LSC-AI platform for:
 * 1. RPA flow execution (based on Prisma RpaFlow definitions)
 * 2. Scheduled task execution (based on Prisma ScheduledTask)
 * 3. Multi-step AI task orchestration
 *
 * T4 upgrade: deterministic execution for shell/http/file/sql/email steps
 * (instead of delegating everything to AI chat)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { exec } from 'child_process';
import { readFile, writeFile, copyFile, unlink, mkdir, stat } from 'fs/promises';
import { promisify } from 'util';
import axios from 'axios';
import { MastraAgentService } from './mastra-agent.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChatGateway } from '../gateway/chat.gateway.js';
import type { NotificationService } from '../modules/notification/notification.service.js';

const execAsync = promisify(exec);

/** Default step execution timeout (ms) */
const DEFAULT_TIMEOUT = 30000;

/** RPA step types */
type RpaStepType =
  | 'ai_chat'
  | 'shell_command'
  | 'web_fetch'
  | 'file_operation'
  | 'sql_query'
  | 'send_email'
  | 'condition'
  | 'loop';

/** RPA step definition */
interface RpaStepDef {
  id: string;
  type: RpaStepType;
  config: Record<string, any>;
  next?: string;
  timeout?: number;       // ms, defaults to 30000
  retries?: number;        // 0-3, defaults to 0
  onError?: 'stop' | 'continue' | 'fallback';
}

/** RPA flow definition */
interface RpaFlowDef {
  steps: RpaStepDef[];
  variables?: Record<string, any>;
}

/** Standard step output */
interface StepOutput {
  text: string;
  success: boolean;
  data?: unknown;
}

/** Mastra step input schema (shared) */
const stepInputSchema = z.object({
  flowId: z.string(),
  userId: z.string(),
  variables: z.record(z.any()).optional(),
});

@Injectable()
export class MastraWorkflowService implements OnModuleInit {
  private readonly logger = new Logger(MastraWorkflowService.name);

  constructor(
    private readonly mastraAgentService: MastraAgentService,
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getChatGateway(): ChatGateway | null {
    try {
      return this.moduleRef.get(ChatGateway, { strict: false });
    } catch {
      return null;
    }
  }

  private emitTaskExecution(payload: Record<string, any>) {
    try {
      const gateway = this.getChatGateway();
      if (gateway?.server) {
        gateway.server.emit('task:execution', payload);
      }
    } catch {
      // Gateway not available
    }
  }

  private getNotificationService(): NotificationService | null {
    try {
      const { NotificationService: Cls } = require('../modules/notification/notification.service.js');
      return this.moduleRef.get(Cls, { strict: false });
    } catch {
      return null;
    }
  }

  async onModuleInit() {
    this.logger.log('Mastra Workflow Service initialized (deterministic RPA mode)');
  }

  /**
   * Execute an RPA flow
   */
  async executeRpaFlow(flowId: string, userId: string, inputData?: Record<string, any>) {
    const flow = await this.prisma.rpaFlow.findUnique({ where: { id: flowId } });

    if (!flow) throw new Error(`RPA Flow not found: ${flowId}`);
    if (flow.userId !== userId) throw new Error('Unauthorized');

    const flowDef = flow.flowData as unknown as RpaFlowDef;
    if (!flowDef?.steps?.length) throw new Error('Flow has no steps');

    this.logger.log(`[Workflow] Starting RPA flow: ${flow.name} (${flowId})`);

    const workflow = this.buildWorkflow(flowId, flow.name, flowDef);
    const mastra = this.mastraAgentService.getMastra();
    workflow.__registerMastra(mastra);

    const run = await workflow.createRun({ resourceId: userId });
    const result = await run.start({
      inputData: {
        flowId,
        userId,
        variables: { ...flowDef.variables, ...inputData },
      },
    });

    this.logger.log(`[Workflow] RPA flow completed: ${result.status}`);

    // 发送通知（异步，不阻塞主流程）
    const notifySvc = this.getNotificationService();
    if (notifySvc) {
      if (result.status === 'success') {
        notifySvc.notifyTaskComplete(userId, flow.name, { flowId, result: result.result }).catch(() => {});
      } else {
        notifySvc.notifyTaskFailed(userId, flow.name, (result as any).error?.message || 'RPA flow failed', { flowId }).catch(() => {});
      }
    }

    return {
      status: result.status,
      result: result.status === 'success' ? result.result : undefined,
      error: result.status === 'failed' ? (result as any).error?.message : undefined,
    };
  }

  /**
   * Execute a scheduled task
   */
  async executeScheduledTask(taskId: string) {
    const task = await this.prisma.scheduledTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error(`Scheduled task not found: ${taskId}`);

    const taskConfig = task.taskConfig as Record<string, any>;
    this.logger.log(`[Workflow] Starting scheduled task: ${task.name} (${taskId})`);

    const log = await this.prisma.taskLog.create({
      data: { taskId, status: 'running', startedAt: new Date() },
    });

    this.emitTaskExecution({ taskId, status: 'running', startedAt: new Date().toISOString() });

    try {
      let result: any;

      if (task.taskType === 'prompt') {
        result = await this.executePromptTask(task.userId, taskConfig);
      } else if (task.taskType === 'rpa') {
        const rpaFlowId = taskConfig.rpaFlowId;
        if (rpaFlowId) {
          result = await this.executeRpaFlow(rpaFlowId, task.userId, taskConfig.inputData);
        }
      }

      const endedAt = new Date();
      await this.prisma.taskLog.update({
        where: { id: log.id },
        data: { status: 'success', endedAt, result: result || {} },
      });
      await this.prisma.scheduledTask.update({
        where: { id: taskId },
        data: { lastRunAt: new Date() },
      });

      this.emitTaskExecution({ taskId, status: 'success', endedAt: endedAt.toISOString(), result });

      // 发送成功通知（异步，不阻塞主流程）
      const notifySvc = this.getNotificationService();
      if (notifySvc) {
        notifySvc.notifyTaskComplete(task.userId, task.name, { taskId, result }).catch(() => {});
      }

      return result;
    } catch (error: any) {
      const endedAt = new Date();
      await this.prisma.taskLog.update({
        where: { id: log.id },
        data: { status: 'failed', endedAt, error: error.message },
      });
      this.emitTaskExecution({ taskId, status: 'failed', endedAt: endedAt.toISOString(), error: error.message });

      // 发送失败通知（异步，不阻塞主流程）
      const notifySvc = this.getNotificationService();
      if (notifySvc) {
        notifySvc.notifyTaskFailed(task.userId, task.name, error.message, { taskId }).catch(() => {});
      }

      throw error;
    }
  }

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

  private buildWorkflow(flowId: string, flowName: string, flowDef: RpaFlowDef) {
    const workflow = createWorkflow({
      id: `rpa-${flowId}`,
      description: flowName,
      inputSchema: stepInputSchema,
      outputSchema: z.object({
        results: z.array(z.any()),
        status: z.string(),
      }),
    });

    // Single orchestrator step that executes all sub-steps sequentially
    // with accumulated data passing (step N output available to step N+1)
    const orchestrator = createStep({
      id: `${flowId}-orchestrator`,
      description: `Orchestrate: ${flowName}`,
      inputSchema: stepInputSchema,
      outputSchema: z.object({
        results: z.array(z.any()),
        status: z.string(),
      }),
      execute: async ({ inputData }) => {
        const stepResults: Record<string, StepOutput> = {};
        const results: StepOutput[] = [];
        const accumulatedVars: Record<string, any> = { ...(inputData.variables || {}) };

        // Build step index map for condition branching
        const stepIndexMap = new Map<string, number>();
        for (let i = 0; i < flowDef.steps.length; i++) {
          stepIndexMap.set(flowDef.steps[i]!.id, i);
        }

        let stepIdx = 0;
        const maxSteps = flowDef.steps.length * 10; // safety limit to prevent infinite loops
        let executedCount = 0;

        while (stepIdx < flowDef.steps.length && executedCount < maxSteps) {
          const stepDef = flowDef.steps[stepIdx]!;
          executedCount++;

          // Merge previous step outputs into variables for {{stepId.field}} resolution
          const varsWithStepData = { ...accumulatedVars, _steps: stepResults };
          const executor = this.buildStepExecutor(stepDef);
          const result = await this.executeWithPolicy(stepDef, () =>
            executor({ ...inputData, variables: varsWithStepData }, stepDef),
          );

          results.push(result);
          stepResults[stepDef.id] = result;

          // Merge step result data into accumulated variables
          // Enables {{stepId.text}}, {{stepId.success}}, {{stepId.data.field}}
          accumulatedVars[stepDef.id] = {
            text: result.text,
            success: result.success,
            ...(result.data && typeof result.data === 'object' ? { data: result.data } : {}),
          };

          if (!result.success && (stepDef.onError ?? 'stop') === 'stop') {
            return { results, status: 'failed' };
          }

          // Condition branching: if this is a condition step with trueBranch/falseBranch,
          // jump to the specified step instead of continuing sequentially
          if (stepDef.type === 'condition') {
            const conditionMet = result.data && typeof result.data === 'object'
              ? (result.data as Record<string, any>).conditionMet
              : result.success;
            const branchTarget = conditionMet
              ? stepDef.config.trueBranch
              : stepDef.config.falseBranch;

            if (branchTarget && stepIndexMap.has(branchTarget)) {
              stepIdx = stepIndexMap.get(branchTarget)!;
              continue;
            }
          }

          // Default: advance to next step (or follow explicit 'next' pointer)
          if (stepDef.next && stepIndexMap.has(stepDef.next)) {
            stepIdx = stepIndexMap.get(stepDef.next)!;
          } else {
            stepIdx++;
          }
        }

        if (executedCount >= maxSteps) {
          this.logger.warn(`[Workflow] Safety limit reached (${maxSteps} steps) for flow ${flowId}`);
          return { results, status: 'failed' };
        }

        return { results, status: 'success' };
      },
    });

    (workflow.then(orchestrator) as any).commit();
    return workflow;
  }

  // ========== Step Execution with Retry + Error Policy ==========

  /**
   * Wraps a step execution function with timeout, retry, and error policy.
   */
  private async executeWithPolicy(
    stepDef: RpaStepDef,
    fn: () => Promise<StepOutput>,
  ): Promise<StepOutput> {
    const maxRetries = Math.min(stepDef.retries ?? 0, 3);
    const timeout = stepDef.timeout ?? DEFAULT_TIMEOUT;
    const onError = stepDef.onError ?? 'stop';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step timeout after ${timeout}ms`)), timeout),
          ),
        ]);
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`[RPA] Step ${stepDef.id} attempt ${attempt + 1}/${maxRetries + 1} failed: ${message}`);

        if (attempt < maxRetries) continue;

        // All retries exhausted
        if (onError === 'continue') {
          return { text: `Error (continued): ${message}`, success: false };
        }
        if (onError === 'fallback') {
          return { text: `Fallback: step ${stepDef.id} failed — ${message}`, success: false, data: { fallback: true } };
        }
        // 'stop' — re-throw
        throw error;
      }
    }

    // Should never reach here
    throw new Error('Unexpected: retry loop exited without return');
  }

  // ========== Step Factory ==========

  /**
   * Returns the direct execution function for a given step type.
   */
  private buildStepExecutor(
    stepDef: RpaStepDef,
  ): (inputData: { flowId: string; userId: string; variables?: Record<string, any> }, step: RpaStepDef) => Promise<StepOutput> {
    switch (stepDef.type) {
      case 'ai_chat':
        return (inputData) => this.execAiChat(inputData, stepDef);
      case 'shell_command':
        return (inputData) => this.execShellCommand(inputData, stepDef);
      case 'web_fetch':
        return (inputData) => this.execWebFetch(inputData, stepDef);
      case 'file_operation':
        return (inputData) => this.execFileOperation(inputData, stepDef);
      case 'sql_query':
        return (inputData) => this.execSqlQuery(inputData, stepDef);
      case 'send_email':
        return (inputData) => this.execSendEmail(inputData, stepDef);
      case 'condition':
        return (inputData) => this.execCondition(inputData, stepDef);
      case 'loop':
        return (inputData) => this.execLoop(inputData, stepDef);
      default:
        return (inputData) => this.execAiFallback(inputData, stepDef);
    }
  }

  // ========== Deterministic Step Implementations ==========

  /** ai_chat: delegate to AI Agent (unchanged) */
  private async execAiChat(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const prompt = this.resolveVariables(stepDef.config.prompt || '', inputData.variables || {});
    const result = await this.mastraAgentService.chat({
      message: prompt,
      threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
      resourceId: inputData.userId,
    });
    return { text: result.text, success: true, data: { toolCallsCount: result.toolCalls.length } };
  }

  /** shell_command: direct child_process.exec() */
  private async execShellCommand(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const command = this.resolveVariables(stepDef.config.command || '', inputData.variables || {});
    const cwd = stepDef.config.cwd || undefined;
    const timeout = stepDef.timeout ?? DEFAULT_TIMEOUT;

    this.logger.log(`[RPA:shell] Executing: ${command}`);
    const { stdout, stderr } = await execAsync(command, { cwd, timeout });

    return {
      text: stdout.trim() || stderr.trim() || '(no output)',
      success: true,
      data: { stdout, stderr },
    };
  }

  /** web_fetch: direct axios HTTP request */
  private async execWebFetch(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const url = this.resolveVariables(stepDef.config.url || '', inputData.variables || {});
    const method = (stepDef.config.method || 'GET').toUpperCase();
    const headers = stepDef.config.headers || {};
    const body = stepDef.config.body
      ? JSON.parse(this.resolveVariables(JSON.stringify(stepDef.config.body), inputData.variables || {}))
      : undefined;
    const timeout = stepDef.timeout ?? DEFAULT_TIMEOUT;

    this.logger.log(`[RPA:http] ${method} ${url}`);
    const response = await axios({
      method,
      url,
      headers,
      data: body,
      timeout,
      validateStatus: () => true,
    });

    const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    return {
      text: `HTTP ${response.status}: ${responseText.slice(0, 2000)}`,
      success: response.status >= 200 && response.status < 400,
      data: { status: response.status, headers: response.headers, body: response.data },
    };
  }

  /** file_operation: direct fs operations */
  private async execFileOperation(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const vars = inputData.variables || {};
    const action = stepDef.config.action || 'read';
    const path = this.resolveVariables(stepDef.config.path || '', vars);
    const destPath = stepDef.config.destPath ? this.resolveVariables(stepDef.config.destPath, vars) : undefined;
    const content = stepDef.config.content ? this.resolveVariables(stepDef.config.content, vars) : undefined;

    this.logger.log(`[RPA:file] ${action} ${path}`);

    switch (action) {
      case 'read': {
        const data = await readFile(path, 'utf-8');
        return { text: data.slice(0, 5000), success: true, data: { length: data.length } };
      }
      case 'write': {
        if (!content) throw new Error('content is required for write action');
        await writeFile(path, content, 'utf-8');
        return { text: `Written ${content.length} bytes to ${path}`, success: true };
      }
      case 'copy': {
        if (!destPath) throw new Error('destPath is required for copy action');
        await copyFile(path, destPath);
        return { text: `Copied ${path} -> ${destPath}`, success: true };
      }
      case 'delete': {
        await unlink(path);
        return { text: `Deleted ${path}`, success: true };
      }
      case 'mkdir': {
        await mkdir(path, { recursive: true });
        return { text: `Created directory ${path}`, success: true };
      }
      case 'stat': {
        const info = await stat(path);
        return { text: `${path}: ${info.size} bytes, modified ${info.mtime.toISOString()}`, success: true, data: { size: info.size, mtime: info.mtime } };
      }
      default:
        throw new Error(`Unknown file action: ${action}`);
    }
  }

  /** sql_query: delegate to ConnectorService */
  private async execSqlQuery(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const connectionId = stepDef.config.connectionId;
    const sql = this.resolveVariables(stepDef.config.sql || '', inputData.variables || {});

    if (!connectionId) throw new Error('connectionId is required for sql_query');
    if (!sql) throw new Error('sql is required for sql_query');

    this.logger.log(`[RPA:sql] Query on ${connectionId}: ${sql.slice(0, 100)}`);

    let connectorService: any;
    try {
      const { ConnectorService } = await import('../modules/connector/connector.service.js');
      connectorService = this.moduleRef.get(ConnectorService, { strict: false });
    } catch {
      throw new Error('ConnectorService not available. ConnectorModule may not be loaded.');
    }

    const result = await connectorService.query(connectionId, sql);
    return {
      text: `Query returned ${result.rowCount} rows`,
      success: true,
      data: { rows: result.rows, fields: result.fields, rowCount: result.rowCount },
    };
  }

  /** send_email: delegate to EmailService */
  private async execSendEmail(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const vars = inputData.variables || {};
    const to = this.resolveVariables(stepDef.config.to || '', vars);
    const subject = this.resolveVariables(stepDef.config.subject || '', vars);
    const template = stepDef.config.template || 'task-result';
    const context = stepDef.config.context || {};

    if (!to) throw new Error('to is required for send_email');

    this.logger.log(`[RPA:email] Sending to ${to}: ${subject}`);

    let emailService: any;
    try {
      const { EmailService } = await import('../modules/notification/email.service.js');
      emailService = this.moduleRef.get(EmailService, { strict: false });
    } catch {
      throw new Error('EmailService not available. NotificationModule may not be loaded.');
    }

    const sent = await emailService.sendMail(to, subject, template, context);
    return {
      text: sent ? `Email sent to ${to}` : `Email send failed to ${to}`,
      success: !!sent,
    };
  }

  /** condition: evaluate a JSON expression */
  private async execCondition(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const vars = inputData.variables || {};
    const field = stepDef.config.field || '';
    const operator = stepDef.config.operator || 'eq';
    const value = stepDef.config.value;

    const fieldValue = vars[field];
    let conditionMet = false;

    switch (operator) {
      case 'eq': conditionMet = fieldValue === value; break;
      case 'neq': conditionMet = fieldValue !== value; break;
      case 'gt': conditionMet = Number(fieldValue) > Number(value); break;
      case 'gte': conditionMet = Number(fieldValue) >= Number(value); break;
      case 'lt': conditionMet = Number(fieldValue) < Number(value); break;
      case 'lte': conditionMet = Number(fieldValue) <= Number(value); break;
      case 'contains': conditionMet = String(fieldValue).includes(String(value)); break;
      case 'exists': conditionMet = fieldValue !== undefined && fieldValue !== null; break;
      default: throw new Error(`Unknown operator: ${operator}`);
    }

    this.logger.log(`[RPA:condition] ${field} ${operator} ${value} => ${conditionMet}`);

    return {
      text: `Condition ${field} ${operator} ${value}: ${conditionMet}`,
      success: conditionMet,
      data: { conditionMet, field, operator, value, actual: fieldValue },
    };
  }

  /** loop: iterate over an array variable and execute sub-steps */
  private async execLoop(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const vars = inputData.variables || {};
    const iteratorField = stepDef.config.iteratorField || '';
    const items: unknown[] = Array.isArray(vars[iteratorField]) ? vars[iteratorField] : [];
    const subSteps: RpaStepDef[] = stepDef.config.steps || [];
    const maxIterations = Math.min(stepDef.config.maxIterations || 100, 100);

    this.logger.log(`[RPA:loop] Iterating ${items.length} items (field: ${iteratorField})`);

    const results: StepOutput[] = [];
    const limit = Math.min(items.length, maxIterations);

    for (let i = 0; i < limit; i++) {
      const iterVars = { ...vars, _item: items[i], _index: i };
      for (const subStep of subSteps) {
        const executor = this.buildStepExecutor(subStep);
        const result = await this.executeWithPolicy(subStep, () =>
          executor({ ...inputData, variables: iterVars }, subStep),
        );
        results.push(result);
        if (!result.success && (subStep.onError ?? 'stop') === 'stop') {
          return { text: `Loop stopped at iteration ${i}, step ${subStep.id}`, success: false, data: { results } };
        }
      }
    }

    return {
      text: `Loop completed: ${limit} iterations, ${results.length} steps executed`,
      success: true,
      data: { iterationCount: limit, results },
    };
  }

  /** Fallback: delegate unknown types to AI chat */
  private async execAiFallback(
    inputData: { flowId: string; userId: string; variables?: Record<string, any> },
    stepDef: RpaStepDef,
  ): Promise<StepOutput> {
    const result = await this.mastraAgentService.chat({
      message: `Execute RPA step (${stepDef.type}): ${JSON.stringify(stepDef.config)}`,
      threadId: `rpa-${inputData.flowId}-${stepDef.id}`,
      resourceId: inputData.userId,
    });
    return { text: result.text, success: true, data: { toolCallsCount: result.toolCalls.length } };
  }

  // ========== Utilities ==========

  /**
   * Resolve {{variable}} and {{step.field.subfield}} references in templates.
   * Supports dot-notation for step data: {{step1.data.count}}, {{step1.text}}
   */
  private resolveVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (match, path: string) => {
      const parts = path.split('.');
      let value: any = variables;
      for (const part of parts) {
        if (value === undefined || value === null) return match;
        value = value[part];
      }
      return value !== undefined && value !== null ? String(value) : match;
    });
  }
}
