import { Module } from '@nestjs/common';
import { SentinelController } from './sentinel.controller.js';
import { SentinelService } from './sentinel.service.js';

@Module({
  controllers: [SentinelController],
  providers: [SentinelService],
  exports: [SentinelService],
})
export class SentinelModule {}
