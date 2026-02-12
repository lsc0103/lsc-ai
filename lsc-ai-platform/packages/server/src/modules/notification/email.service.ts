import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /**
   * 通用邮件发送
   */
  async sendMail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context: {
          ...context,
          timestamp: context['timestamp'] ?? new Date().toLocaleString('zh-CN'),
        },
      });
      this.logger.log(`邮件发送成功: to=${to}, subject=${subject}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `邮件发送失败: to=${to}, subject=${subject}, error=${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * 任务通知邮件
   */
  async sendTaskNotification(
    to: string,
    taskName: string,
    status: string,
    details: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `[LSC-AI] 任务通知: ${taskName} - ${status}`,
        template: 'task-notification',
        context: {
          taskName,
          status,
          details,
          timestamp: new Date().toLocaleString('zh-CN'),
        },
      });
      this.logger.log(`任务通知发送成功: to=${to}, task=${taskName}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `任务通知发送失败: to=${to}, task=${taskName}, error=${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * 告警通知邮件
   */
  async sendAlertNotification(
    to: string,
    alertLevel: string,
    message: string,
    details: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `[LSC-AI] ${alertLevel === 'critical' ? '紧急' : alertLevel === 'warning' ? '警告' : '通知'}告警: ${message}`,
        template: 'alert',
        context: {
          level: alertLevel,
          message,
          details,
          timestamp: new Date().toLocaleString('zh-CN'),
        },
      });
      this.logger.log(`告警通知发送成功: to=${to}, level=${alertLevel}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `告警通知发送失败: to=${to}, level=${alertLevel}, error=${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * 报告分发邮件
   */
  async sendReportEmail(
    to: string,
    reportName: string,
    attachmentBuffer?: Buffer,
  ): Promise<boolean> {
    try {
      const mailOptions: Record<string, unknown> = {
        to,
        subject: `[LSC-AI] 报告: ${reportName}`,
        template: 'report',
        context: {
          reportName,
          description: `您订阅的报告「${reportName}」已生成，请查收。`,
          timestamp: new Date().toLocaleString('zh-CN'),
        },
      };

      if (attachmentBuffer) {
        mailOptions['attachments'] = [
          {
            filename: `${reportName}.pdf`,
            content: attachmentBuffer,
          },
        ];
      }

      await this.mailerService.sendMail(mailOptions as Parameters<MailerService['sendMail']>[0]);
      this.logger.log(`报告邮件发送成功: to=${to}, report=${reportName}`);
      return true;
    } catch (error) {
      this.logger.warn(
        `报告邮件发送失败: to=${to}, report=${reportName}, error=${(error as Error).message}`,
      );
      return false;
    }
  }
}
