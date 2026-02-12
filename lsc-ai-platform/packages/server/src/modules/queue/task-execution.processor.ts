/**
 * Task Execution Processor
 *
 * BullMQ worker that processes task-execution queue jobs.
 * Dispatches to MastraWorkflowService based on job type.
 * Uses ModuleRef to avoid circular dependencies.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import { MastraWorkflowService } from '../../services/mastra-workflow.service.js';
import { ChatGateway } from '../../gateway/chat.gateway.js';

interface TaskExecutionJobData {
  type: 'scheduled-task' | 'rpa-flow' | 'manual-task';
  taskId?: string;
  flowId?: string;
  userId?: string;
  inputData?: Record<string, unknown>;
  prompt?: string;
  threadId?: string;
}

@Processor('task-execution')
export class TaskExecutionProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TaskExecutionProcessor.name);
  private workflowService: MastraWorkflowService | null = null;
  private chatGateway: ChatGateway | null = null;

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async onModuleInit() {
    // Resolve cross-module services lazily via ModuleRef (strict: false)
    try {
      this.workflowService = this.moduleRef.get(MastraWorkflowService, { strict: false });
    } catch {
      this.logger.warn('MastraWorkflowService not available');
    }
    try {
      this.chatGateway = this.moduleRef.get(ChatGateway, { strict: false });
    } catch {
      this.logger.warn('ChatGateway not available');
    }
    this.logger.log('TaskExecutionProcessor initialized');
  }

  async process(job: Job<TaskExecutionJobData>): Promise<unknown> {
    const { type } = job.data;
    this.logger.log(`[Queue] Processing job ${job.id} type=${type}`);

    this.emitEvent({ jobId: job.id, type, status: 'processing', startedAt: new Date().toISOString() });

    try {
      let result: unknown;

      switch (type) {
        case 'scheduled-task':
          result = await this.handleScheduledTask(job.data);
          break;

        case 'rpa-flow':
          result = await this.handleRpaFlow(job.data);
          break;

        case 'manual-task':
          result = await this.handleManualTask(job.data);
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      this.logger.log(`[Queue] Job ${job.id} completed`);
      this.emitEvent({ jobId: job.id, type, status: 'completed', endedAt: new Date().toISOString() });

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Queue] Job ${job.id} failed: ${message}`);
      this.emitEvent({ jobId: job.id, type, status: 'failed', error: message, endedAt: new Date().toISOString() });
      throw error;
    }
  }

  private async handleScheduledTask(data: TaskExecutionJobData): Promise<unknown> {
    if (!this.workflowService) {
      throw new Error('MastraWorkflowService not available');
    }
    if (!data.taskId) {
      throw new Error('taskId is required for scheduled-task');
    }
    return this.workflowService.executeScheduledTask(data.taskId);
  }

  private async handleRpaFlow(data: TaskExecutionJobData): Promise<unknown> {
    if (!this.workflowService) {
      throw new Error('MastraWorkflowService not available');
    }
    if (!data.flowId || !data.userId) {
      throw new Error('flowId and userId are required for rpa-flow');
    }
    return this.workflowService.executeRpaFlow(data.flowId, data.userId, data.inputData);
  }

  private async handleManualTask(data: TaskExecutionJobData): Promise<unknown> {
    this.logger.log(`[Queue] Manual task: ${JSON.stringify(data)}`);
    return { status: 'completed', data };
  }

  private emitEvent(payload: Record<string, unknown>) {
    try {
      if (this.chatGateway?.server) {
        this.chatGateway.server.emit('task:execution', payload);
      }
    } catch {
      // Gateway not available, skip WebSocket push
    }
  }
}
