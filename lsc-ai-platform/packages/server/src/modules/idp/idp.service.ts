import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service.js';
import FormData from 'form-data';

@Injectable()
export class IdpService implements OnModuleInit {
  private readonly logger = new Logger(IdpService.name);
  private ocrBaseUrl: string = '';

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @InjectQueue('idp-processing') private idpQueue: Queue,
  ) {}

  onModuleInit() {
    this.ocrBaseUrl = this.configService.get<string>('IDP_OCR_URL') || 'http://localhost:8001';
    this.logger.log(`IDP OCR 服务地址: ${this.ocrBaseUrl}`);
  }

  private async sendToOcr(endpoint: string, buffer: Buffer, filename: string, extraFields?: Record<string, string>): Promise<any> {
    const formData = new FormData();
    formData.append('file', buffer, { filename, contentType: 'application/octet-stream' });
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
      }
    }

    const response = await fetch(`${this.ocrBaseUrl}${endpoint}`, {
      method: 'POST',
      body: formData as any,
      headers: formData.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`OCR 服务响应错误: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async ocrDocument(buffer: Buffer, filename: string, options?: { preprocess?: boolean; language?: string }): Promise<any> {
    return this.sendToOcr('/api/v1/ocr', buffer, filename, {
      preprocess: String(options?.preprocess ?? true),
      language: options?.language ?? 'ch',
    });
  }

  async extractTables(buffer: Buffer, filename: string): Promise<any> {
    return this.sendToOcr('/api/v1/table', buffer, filename);
  }

  async analyzeLayout(buffer: Buffer, filename: string): Promise<any> {
    return this.sendToOcr('/api/v1/layout', buffer, filename);
  }

  async analyzeDocumentFull(buffer: Buffer, filename: string): Promise<any> {
    const [ocr, tables, layout] = await Promise.all([
      this.ocrDocument(buffer, filename),
      this.extractTables(buffer, filename),
      this.analyzeLayout(buffer, filename),
    ]);
    return { ocr, tables, layout };
  }

  async processPaintingList(buffer: Buffer, filename: string): Promise<any> {
    return this.sendToOcr('/api/v1/painting-list', buffer, filename);
  }

  async processInspectionReport(buffer: Buffer, filename: string): Promise<any> {
    return this.sendToOcr('/api/v1/inspection-report', buffer, filename);
  }

  async submitBatchJob(userId: string, documents: Array<{ buffer: Buffer; filename: string }>): Promise<string> {
    const job = await this.prisma.idpJob.create({
      data: {
        userId,
        totalDocuments: documents.length,
        documentIds: documents.map(d => d.filename),
        status: 'queued',
      },
    });

    await this.idpQueue.add('batch-ocr', {
      jobId: job.id,
      documents: documents.map(d => ({
        filename: d.filename,
      })),
    });

    return job.id;
  }

  async getJobStatus(jobId: string): Promise<any> {
    return this.prisma.idpJob.findUnique({ where: { id: jobId } });
  }

  async getJobsByUser(userId: string, page = 1, pageSize = 20): Promise<any> {
    const [items, total] = await Promise.all([
      this.prisma.idpJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.idpJob.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  async checkHealth(): Promise<any> {
    try {
      const response = await fetch(`${this.ocrBaseUrl}/api/v1/health`);
      return response.json();
    } catch (error) {
      return { status: 'error', error: (error as Error).message };
    }
  }
}
