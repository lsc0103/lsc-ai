import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { ConnectorService } from './connector.service.js';
import { ConnectorController } from './connector.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [ConnectorController],
  providers: [ConnectorService],
  exports: [ConnectorService],
})
export class ConnectorModule {}
