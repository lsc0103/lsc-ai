/**
 * Task Scheduler Service
 *
 * Based on @nestjs/schedule, scans active scheduled tasks every minute.
 * Uses cron-parser for cron expression matching and next-run calculation.
 * Delegates execution to BullMQ 'task-execution' queue instead of running directly.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('task-execution') private readonly taskQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Task Scheduler initialized (BullMQ mode)');
  }

  /**
   * Every minute: scan for active scheduled tasks that are due
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledTasks() {
    try {
      const now = new Date();

      // Find all active tasks that are due or never executed
      const tasks = await this.prisma.scheduledTask.findMany({
        where: {
          status: 'active',
          OR: [
            { nextRunAt: { lte: now } },
            { nextRunAt: null },
          ],
        },
      });

      if (tasks.length === 0) return;

      this.logger.log(`[Scheduler] Found ${tasks.length} pending tasks`);

      for (const task of tasks) {
        if (!this.shouldRunNow(task.cronExpr, now, task.lastRunAt)) {
          continue;
        }

        // Enqueue to BullMQ instead of executing directly
        await this.taskQueue.add(
          'scheduled-task',
          { taskId: task.id, type: 'scheduled-task' as const },
          { jobId: `sched-${task.id}-${now.getTime()}` },
        );

        // Update nextRunAt immediately so the same task isn't re-queued next minute
        const nextRun = this.getNextRunTime(task.cronExpr);
        await this.prisma.scheduledTask.update({
          where: { id: task.id },
          data: { nextRunAt: nextRun },
        });

        this.logger.log(`[Scheduler] Enqueued task: ${task.name} (${task.id}), next run: ${nextRun.toISOString()}`);
      }
    } catch (error) {
      this.logger.error('[Scheduler] Schedule check failed', (error as Error).message);
    }
  }

  /**
   * Check if a cron expression matches the current time using cron-parser.
   * Also prevents re-execution within the same minute.
   */
  private shouldRunNow(cronExpr: string, now: Date, lastRunAt: Date | null): boolean {
    try {
      const expr = CronExpressionParser.parse(cronExpr, { currentDate: now });
      const prev = expr.prev();
      const diffMs = now.getTime() - prev.getTime();

      // The previous occurrence should be within the last 60 seconds
      if (diffMs > 60000) return false;

      // Prevent duplicate execution within the same minute (inclusive boundary)
      if (lastRunAt) {
        const sinceLastRun = now.getTime() - lastRunAt.getTime();
        if (sinceLastRun <= 60000) return false;
      }

      return true;
    } catch {
      this.logger.warn(`[Scheduler] Invalid cron expression: ${cronExpr}`);
      return false;
    }
  }

  /**
   * Calculate next run time using cron-parser
   */
  private getNextRunTime(cronExpr: string): Date {
    try {
      const expr = CronExpressionParser.parse(cronExpr);
      return expr.next().toDate();
    } catch {
      // Fallback: 1 hour from now
      const fallback = new Date();
      fallback.setHours(fallback.getHours() + 1);
      return fallback;
    }
  }
}
