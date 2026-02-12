import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module.js';
import { SentinelController } from './sentinel.controller.js';
import { SentinelService } from './sentinel.service.js';

@Module({
  imports: [NotificationModule],
  controllers: [SentinelController],
  providers: [SentinelService],
  exports: [SentinelService],
})
export class SentinelModule {}
