import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IdpService } from './idp.service.js';
import { IdpController } from './idp.controller.js';
import { IdpProcessor } from './idp.processor.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    BullModule.registerQueue({ name: 'idp-processing' }),
  ],
  controllers: [IdpController],
  providers: [IdpService, IdpProcessor],
  exports: [IdpService],
})
export class IdpModule {}
