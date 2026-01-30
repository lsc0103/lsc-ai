import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MinioService } from './minio.service.js';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';

@Global()
@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      storage: memoryStorage(),
    }),
  ],
  controllers: [UploadController],
  providers: [MinioService, UploadService],
  exports: [MinioService, UploadService],
})
export class StorageModule {}
