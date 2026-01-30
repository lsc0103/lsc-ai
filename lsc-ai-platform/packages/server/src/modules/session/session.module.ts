import { Module } from '@nestjs/common';
import { SessionService } from './session.service.js';
import { SessionController } from './session.controller.js';
import { ChatModule } from '../chat/chat.module.js';

@Module({
  imports: [ChatModule], // 导入 ChatModule 以使用 MastraAgentService
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
