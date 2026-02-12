/**
 * Email Processor
 *
 * BullMQ worker that processes email queue jobs.
 * Uses ModuleRef to resolve EmailService from NotificationModule.
 * Configured with exponential backoff retry (3 attempts).
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

/** Interface for the EmailService that NotificationModule provides */
interface EmailServiceLike {
  sendMail(options: { to: string; subject: string; template: string; context: Record<string, unknown> }): Promise<void>;
}

@Processor('email', {
  concurrency: 3,
})
export class EmailProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EmailProcessor.name);
  private emailService: EmailServiceLike | null = null;

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async onModuleInit() {
    try {
      // EmailService may not be available yet (NotificationModule pending)
      this.emailService = this.moduleRef.get('EmailService', { strict: false });
      this.logger.log('EmailProcessor initialized with EmailService');
    } catch {
      this.logger.warn('EmailService not available yet, email jobs will fail until NotificationModule is loaded');
    }
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, context } = job.data;
    this.logger.log(`[Email] Processing job ${job.id}: to=${to} subject=${subject}`);

    if (!this.emailService) {
      // Try to resolve again (module may have loaded after init)
      try {
        this.emailService = this.moduleRef.get('EmailService', { strict: false });
      } catch {
        throw new Error('EmailService not available. NotificationModule may not be loaded.');
      }
    }

    await this.emailService!.sendMail({ to, subject, template, context });
    this.logger.log(`[Email] Job ${job.id} sent successfully`);
  }
}
