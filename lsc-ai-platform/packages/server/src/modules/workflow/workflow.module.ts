import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller.js';
import { ChatModule } from '../chat/chat.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { TaskSchedulerService } from '../../services/task-scheduler.service.js';

@Module({
  imports: [ChatModule, QueueModule],
  controllers: [WorkflowController],
  providers: [TaskSchedulerService],
})
export class WorkflowModule {}
