import {
  Controller, Post, Get, Param, Body, Query,
  UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { IdpService } from './idp.service.js';

@Controller('idp')
@UseGuards(JwtAuthGuard)
export class IdpController {
  constructor(private idpService: IdpService) {}

  @Post('ocr')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async ocrDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('preprocess') preprocess?: string,
    @Body('language') language?: string,
  ) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.idpService.ocrDocument(file.buffer, file.originalname, {
      preprocess: preprocess !== 'false',
      language: language || 'ch',
    });
  }

  @Post('table')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async extractTables(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.idpService.extractTables(file.buffer, file.originalname);
  }

  @Post('layout')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async analyzeLayout(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.idpService.analyzeLayout(file.buffer, file.originalname);
  }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async analyzeDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.idpService.analyzeDocumentFull(file.buffer, file.originalname);
  }

  @Post('batch')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 100 * 1024 * 1024 } }))
  async batchProcess(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files?.length) throw new BadRequestException('请上传文件');
    const userId = req.user.id || req.user.sub;
    const documents = files.map(f => ({ buffer: f.buffer, filename: f.originalname }));
    const jobId = await this.idpService.submitBatchJob(userId, documents);
    return { jobId, totalDocuments: files.length };
  }

  @Get('jobs')
  async listJobs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = req.user.id || req.user.sub;
    return this.idpService.getJobsByUser(userId, parseInt(page || '1'), parseInt(pageSize || '20'));
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const job = await this.idpService.getJobStatus(id);
    if (!job) throw new BadRequestException('任务不存在');
    return job;
  }

  @Get('health')
  async checkHealth() {
    return this.idpService.checkHealth();
  }

  @Post('painting-list')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async processPaintingList(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.idpService.processPaintingList(file.buffer, file.originalname);
  }

  @Post('inspection-report')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  async processInspectionReport(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请上传文件');
    return this.idpService.processInspectionReport(file.buffer, file.originalname);
  }
}
