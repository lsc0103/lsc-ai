import { Module } from '@nestjs/common';
import { AgentService } from './agent.service.js';
import { AgentController } from './agent.controller.js';

@Module({
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
