import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 用户通知偏好（存储在 User.extraData.notifyPrefs 中） */
interface NotifyPrefs {
  email?: string;
  taskComplete?: boolean;
  taskFailed?: boolean;
  alertTriggered?: boolean;
  reportGenerated?: boolean;
  systemEvent?: boolean;
  weeklyDigest?: boolean;
}

/** Alert info for notifyAlertTriggered */
interface AlertInfo {
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  metricValue: number;
  threshold: number;
  agentName?: string;
}

/** System event info */
interface SystemEventInfo {
  type: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 获取用户通知偏好（私有）
   */
  private async getUserNotifyPrefs(userId: string): Promise<NotifyPrefs | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, extraData: true },
      });
      if (!user) return null;

      const extraData = (user.extraData as Record<string, any>) || {};
      const prefs: NotifyPrefs = extraData.notifyPrefs || {};
      // 用 user.email 作为默认通知邮箱
      if (!prefs.email && user.email) {
        prefs.email = user.email;
      }
      return prefs;
    } catch (error) {
      this.logger.warn(`获取用户通知偏好失败: userId=${userId}, error=${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 获取所有 admin 用户
   */
  private async getAdminUsers(): Promise<{ id: string; email: string | null }[]> {
    try {
      const adminRoleUsers = await this.prisma.userRole.findMany({
        where: { role: { code: 'admin' } },
        include: { user: { select: { id: true, email: true } } },
      });
      return adminRoleUsers.map((ur) => ur.user);
    } catch {
      return [];
    }
  }

  /**
   * 判断用户是否启用了某类通知
   */
  private isEnabled(prefs: NotifyPrefs | null, key: keyof NotifyPrefs): boolean {
    if (!prefs || !prefs.email) return false;
    // weeklyDigest 默认关闭，其余默认启用（除非明确关闭）
    if (key === 'weeklyDigest') return prefs[key] === true;
    return prefs[key] !== false;
  }

  /**
   * 任务执行成功通知
   */
  async notifyTaskComplete(
    userId: string,
    taskName: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const prefs = await this.getUserNotifyPrefs(userId);
      if (!this.isEnabled(prefs, 'taskComplete')) return;

      await this.emailService.sendMail(
        prefs!.email!,
        `[LSC-AI] 任务完成: ${taskName}`,
        'task-complete',
        {
          taskName,
          executionTime: new Date().toLocaleString('zh-CN'),
          resultSummary: typeof details.result === 'string'
            ? details.result
            : JSON.stringify(details, null, 2),
          details: JSON.stringify(details, null, 2),
        },
      );
    } catch (error) {
      this.logger.warn(`任务完成通知发送失败: ${(error as Error).message}`);
    }
  }

  /**
   * 任务执行失败通知
   */
  async notifyTaskFailed(
    userId: string,
    taskName: string,
    errorMessage: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const prefs = await this.getUserNotifyPrefs(userId);
      if (!this.isEnabled(prefs, 'taskFailed')) return;

      await this.emailService.sendMail(
        prefs!.email!,
        `[LSC-AI] 任务失败: ${taskName}`,
        'task-failed',
        {
          taskName,
          errorMessage,
          executionTime: new Date().toLocaleString('zh-CN'),
          details: JSON.stringify(details, null, 2),
        },
      );
    } catch (error) {
      this.logger.warn(`任务失败通知发送失败: ${(error as Error).message}`);
    }
  }

  /**
   * Sentinel 告警通知
   * 重载1: AlertInfo 对象 — 发给所有 admin
   * 重载2: (userId, level, message, details) — 发给单用户（向后兼容）
   */
  async notifyAlertTriggered(alert: AlertInfo): Promise<void>;
  async notifyAlertTriggered(
    userId: string,
    alertLevel: 'critical' | 'warning' | 'info',
    alertMessage: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
  async notifyAlertTriggered(
    alertOrUserId: AlertInfo | string,
    alertLevel?: 'critical' | 'warning' | 'info',
    alertMessage?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (typeof alertOrUserId === 'string') {
        // Legacy: called with (userId, level, message, details)
        const prefs = await this.getUserNotifyPrefs(alertOrUserId);
        if (!this.isEnabled(prefs, 'alertTriggered')) return;

        await this.emailService.sendMail(
          prefs!.email!,
          `[LSC-AI] ${alertLevel === 'critical' ? '紧急告警' : alertLevel === 'warning' ? '警告' : '通知'}: ${alertMessage}`,
          'sentinel-alert',
          {
            level: alertLevel,
            message: alertMessage,
            source: (details?.source as string) || undefined,
            metric: (details?.metric as string) || undefined,
            threshold: (details?.threshold as string) || undefined,
            details: (details?.details as string) || undefined,
          },
        );
      } else {
        // New: AlertInfo — send to all admin users
        const alert = alertOrUserId;
        const admins = await this.getAdminUsers();
        for (const admin of admins) {
          const prefs = await this.getUserNotifyPrefs(admin.id);
          if (!this.isEnabled(prefs, 'alertTriggered')) continue;

          await this.emailService.sendMail(
            prefs!.email!,
            `[LSC-AI] ${alert.severity === 'critical' ? '紧急告警' : alert.severity === 'warning' ? '警告' : '通知'}: ${alert.ruleName}`,
            'sentinel-alert',
            {
              level: alert.severity,
              ruleName: alert.ruleName,
              message: `${alert.ruleName}: 当前值 ${alert.metricValue}, 阈值 ${alert.threshold}`,
              source: alert.agentName || '系统',
              metric: String(alert.metricValue),
              threshold: String(alert.threshold),
              agentName: alert.agentName || '',
            },
          );
        }
      }
    } catch (error) {
      this.logger.warn(`告警通知发送失败: ${(error as Error).message}`);
    }
  }

  /**
   * 报告生成通知
   * 重载1: (reportName, recipients[], attachment?) — 多收件人
   * 重载2: (userId, reportName, description?, attachment?) — 单用户（向后兼容）
   */
  async notifyReportGenerated(
    reportName: string,
    recipients: string[],
    attachment?: Buffer,
  ): Promise<void>;
  async notifyReportGenerated(
    userId: string,
    reportName: string,
    description?: string,
    attachmentBuffer?: Buffer,
  ): Promise<void>;
  async notifyReportGenerated(
    firstArg: string,
    secondArg: string | string[],
    thirdArg?: string | Buffer,
    fourthArg?: Buffer,
  ): Promise<void> {
    try {
      if (Array.isArray(secondArg)) {
        // New: notifyReportGenerated(reportName, recipients[], attachment?)
        const reportName = firstArg;
        const recipients = secondArg;
        const attachment = thirdArg instanceof Buffer ? thirdArg : undefined;
        for (const email of recipients) {
          await this.emailService.sendReportEmail(email, reportName, attachment);
        }
      } else {
        // Legacy: notifyReportGenerated(userId, reportName, description?, attachment?)
        const userId = firstArg;
        const reportName = secondArg;
        const description = typeof thirdArg === 'string' ? thirdArg : undefined;
        const attachmentBuffer = thirdArg instanceof Buffer ? thirdArg : fourthArg;
        const prefs = await this.getUserNotifyPrefs(userId);
        if (!this.isEnabled(prefs, 'reportGenerated')) return;

        await this.emailService.sendMail(
          prefs!.email!,
          `[LSC-AI] 报告已生成: ${reportName}`,
          'report-ready',
          {
            reportName,
            description: description || `您订阅的报告「${reportName}」已生成，请查收。`,
            hasAttachment: !!attachmentBuffer,
          },
        );

        if (attachmentBuffer) {
          await this.emailService.sendReportEmail(prefs!.email!, reportName, attachmentBuffer);
        }
      }
    } catch (error) {
      this.logger.warn(`报告通知发送失败: ${(error as Error).message}`);
    }
  }

  /**
   * 系统事件通知
   * 重载1: SystemEventInfo — 发给所有 admin
   * 重载2: (userId, eventType, message, details?) — 单用户（向后兼容）
   */
  async notifySystemEvent(event: SystemEventInfo): Promise<void>;
  async notifySystemEvent(
    userId: string,
    eventType: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void>;
  async notifySystemEvent(
    eventOrUserId: SystemEventInfo | string,
    eventType?: string,
    msg?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (typeof eventOrUserId === 'string') {
        // Legacy: single user
        const prefs = await this.getUserNotifyPrefs(eventOrUserId);
        if (!this.isEnabled(prefs, 'systemEvent')) return;

        await this.emailService.sendMail(
          prefs!.email!,
          `[LSC-AI] 系统通知: ${eventType}`,
          'system-event',
          { eventType, message: msg, details: details ? JSON.stringify(details, null, 2) : '' },
        );
      } else {
        // New: SystemEventInfo — send to all admin users
        const event = eventOrUserId;
        const admins = await this.getAdminUsers();
        for (const admin of admins) {
          const prefs = await this.getUserNotifyPrefs(admin.id);
          if (!this.isEnabled(prefs, 'systemEvent')) continue;

          await this.emailService.sendMail(
            prefs!.email!,
            `[LSC-AI] 系统通知: ${event.type}`,
            'system-event',
            { eventType: event.type, message: event.message },
          );
        }
      }
    } catch (error) {
      this.logger.warn(`系统事件通知发送失败: ${(error as Error).message}`);
    }
  }

  /**
   * 更新用户通知偏好
   */
  async updateNotifyPrefs(userId: string, prefs: Partial<NotifyPrefs>): Promise<NotifyPrefs> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { extraData: true },
    });
    if (!user) throw new Error('User not found');

    const extraData = (user.extraData as Record<string, any>) || {};
    const currentPrefs: NotifyPrefs = extraData.notifyPrefs || {};
    const newPrefs: NotifyPrefs = { ...currentPrefs, ...prefs };

    const updatedExtraData = JSON.parse(JSON.stringify({ ...extraData, notifyPrefs: newPrefs }));
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        extraData: updatedExtraData,
      },
    });

    return newPrefs;
  }

  /**
   * 获取用户通知偏好（公开方法）
   */
  async getNotifyPrefs(userId: string): Promise<NotifyPrefs> {
    const prefs = await this.getUserNotifyPrefs(userId);
    return prefs || {};
  }
}
