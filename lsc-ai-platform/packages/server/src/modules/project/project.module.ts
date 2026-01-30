import { Module } from '@nestjs/common';
import { ProjectService } from './project.service.js';
import { ProjectController } from './project.controller.js';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
