/**
 * Queue Module
 *
 * BullMQ queue infrastructure for task execution, email, and sentinel metrics.
 * Connects to Redis and registers 3 queues with their processors.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TaskExecutionProcessor } from './task-execution.processor.js';
import { EmailProcessor } from './email.processor.js';

@Module({
  imports: [
    // Global Redis connection for all queues
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),

    // Register queues
    BullModule.registerQueue(
      { name: 'task-execution' },
      { name: 'email' },
      { name: 'sentinel-metrics' },
    ),
  ],
  providers: [TaskExecutionProcessor, EmailProcessor],
  exports: [BullModule],
})
export class QueueModule {}
