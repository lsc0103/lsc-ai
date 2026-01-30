/**
 * Task Scheduler Service
 *
 * 基于 @nestjs/schedule 的定时任务调度器
 * 每分钟扫描数据库中 active 的定时任务，根据 cron 表达式判断是否需要执行
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { MastraWorkflowService } from './mastra-workflow.service.js';

@Injectable()
export class TaskSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(TaskSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: MastraWorkflowService,
  ) {}

  async onModuleInit() {
    this.logger.log('定时任务调度器已启动');
  }

  /**
   * 每分钟检查待执行的定时任务
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkScheduledTasks() {
    try {
      const now = new Date();

      // 查找所有 active 且到了执行时间的任务
      const tasks = await this.prisma.scheduledTask.findMany({
        where: {
          status: 'active',
          OR: [
            { nextRunAt: { lte: now } },
            { nextRunAt: null }, // 从未执行过的任务
          ],
        },
      });

      if (tasks.length === 0) return;

      this.logger.log(`[Scheduler] 发现 ${tasks.length} 个待执行任务`);

      for (const task of tasks) {
        // 检查 cron 表达式是否匹配当前时间
        if (!this.shouldRunNow(task.cronExpr, now, task.lastRunAt)) {
          continue;
        }

        // 异步执行，不阻塞调度循环
        this.executeTask(task.id, task.name).catch((error) => {
          this.logger.error(`[Scheduler] 任务执行失败: ${task.name}`, error.message);
        });
      }
    } catch (error) {
      this.logger.error('[Scheduler] 调度检查失败', (error as Error).message);
    }
  }

  /**
   * 执行单个任务并更新 nextRunAt
   */
  private async executeTask(taskId: string, taskName: string) {
    this.logger.log(`[Scheduler] 开始执行: ${taskName} (${taskId})`);

    try {
      await this.workflowService.executeScheduledTask(taskId);

      // 计算下次执行时间
      const task = await this.prisma.scheduledTask.findUnique({
        where: { id: taskId },
      });
      if (task) {
        const nextRun = this.getNextRunTime(task.cronExpr);
        await this.prisma.scheduledTask.update({
          where: { id: taskId },
          data: { nextRunAt: nextRun },
        });
      }

      this.logger.log(`[Scheduler] 执行完成: ${taskName}`);
    } catch (error) {
      this.logger.error(`[Scheduler] 执行失败: ${taskName}`, (error as Error).message);
    }
  }

  /**
   * 简单的 cron 匹配（分钟级精度）
   * 支持格式: "分 时 日 月 周" (标准5段 cron)
   */
  private shouldRunNow(cronExpr: string, now: Date, lastRunAt: Date | null): boolean {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [minuteExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;
    const minute = now.getMinutes();
    const hour = now.getHours();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const weekday = now.getDay(); // 0=Sun

    if (!this.matchField(minuteExpr!, minute, 0, 59)) return false;
    if (!this.matchField(hourExpr!, hour, 0, 23)) return false;
    if (!this.matchField(dayExpr!, day, 1, 31)) return false;
    if (!this.matchField(monthExpr!, month, 1, 12)) return false;
    if (!this.matchField(weekdayExpr!, weekday, 0, 6)) return false;

    // 防止同一分钟重复执行
    if (lastRunAt) {
      const diffMs = now.getTime() - lastRunAt.getTime();
      if (diffMs < 60000) return false;
    }

    return true;
  }

  /**
   * 匹配单个 cron 字段
   */
  private matchField(expr: string, value: number, _min: number, _max: number): boolean {
    if (expr === '*') return true;

    // 支持 */N (步长)
    if (expr.startsWith('*/')) {
      const step = parseInt(expr.slice(2), 10);
      return step > 0 && value % step === 0;
    }

    // 支持逗号分隔
    const values = expr.split(',');
    for (const v of values) {
      // 支持范围 A-B
      if (v.includes('-')) {
        const [start, end] = v.split('-').map(Number);
        if (value >= start! && value <= end!) return true;
      } else {
        if (parseInt(v, 10) === value) return true;
      }
    }

    return false;
  }

  /**
   * 根据 cron 表达式计算下次执行时间（简单实现，精确到分钟）
   */
  private getNextRunTime(cronExpr: string): Date {
    const now = new Date();
    // 简单实现：从当前时间开始逐分钟检查，找到下一个匹配时间
    const check = new Date(now);
    check.setSeconds(0, 0);
    check.setMinutes(check.getMinutes() + 1);

    for (let i = 0; i < 1440 * 31; i++) { // 最多检查31天
      if (this.shouldRunNow(cronExpr, check, null)) {
        return check;
      }
      check.setMinutes(check.getMinutes() + 1);
    }

    // 找不到则默认1小时后
    const fallback = new Date(now);
    fallback.setHours(fallback.getHours() + 1);
    return fallback;
  }
}
