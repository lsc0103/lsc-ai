import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { MastraAgentService } from '../../services/mastra-agent.service.js';
import { MastraWorkflowService } from '../../services/mastra-workflow.service.js';
import { ConnectorModule } from '../connector/connector.module.js';

@Module({
  imports: [ConnectorModule],
  controllers: [ChatController],
  providers: [ChatService, MastraAgentService, MastraWorkflowService],
  exports: [ChatService, MastraAgentService, MastraWorkflowService],
})
export class ChatModule {}
