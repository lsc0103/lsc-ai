import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { SessionModule } from './modules/session/session.module.js';
import { ProjectModule } from './modules/project/project.module.js';
import { AgentModule } from './modules/agent/agent.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { WorkflowModule } from './modules/workflow/workflow.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import { AgentGateway } from './gateway/agent.gateway.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // 限流模块
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1分钟
        limit: 100, // 100次请求
      },
    ]),

    // 定时任务模块
    ScheduleModule.forRoot(),

    // 数据库模块
    PrismaModule,

    // 业务模块
    AuthModule,
    UserModule,
    ChatModule,
    SessionModule,
    ProjectModule,
    AgentModule,
    StorageModule,
    WorkflowModule,
    KnowledgeModule,
  ],
  controllers: [HealthController],
  providers: [ChatGateway, AgentGateway],
})
export class AppModule {}
