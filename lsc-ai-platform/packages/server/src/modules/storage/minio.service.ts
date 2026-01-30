import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

export interface UploadedFile {
  bucket: string;
  objectKey: string;
  url: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = parseInt(this.configService.get<string>('MINIO_PORT') || '9000', 10);
    const accessKey = this.configService.get<string>('MINIO_USER') || 'minioadmin';
    const secretKey = this.configService.get<string>('MINIO_PASSWORD') || 'minioadmin123';
    this.bucket = this.configService.get<string>('MINIO_BUCKET') || 'lscai';

    this.client = new Client({
      endPoint: endpoint,
      port: port,
      useSSL: false,
      accessKey: accessKey,
      secretKey: secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" 创建成功`);
      } else {
        this.logger.log(`Bucket "${this.bucket}" 已存在`);
      }
    } catch (error) {
      this.logger.warn(`MinIO 初始化失败，文件上传功能可能不可用: ${error}`);
    }
  }

  /**
   * 上传文件到 MinIO
   */
  async uploadFile(
    objectKey: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<UploadedFile> {
    const stream = Readable.from(buffer);

    await this.client.putObject(
      this.bucket,
      objectKey,
      stream,
      buffer.length,
      { 'Content-Type': mimeType },
    );

    const url = await this.getFileUrl(objectKey);

    return {
      bucket: this.bucket,
      objectKey,
      url,
    };
  }

  /**
   * 获取文件访问 URL（预签名）
   */
  async getFileUrl(objectKey: string, expirySeconds: number = 3600): Promise<string> {
    try {
      return await this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
    } catch (error) {
      this.logger.error(`获取文件 URL 失败: ${objectKey}`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(objectKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectKey);
      this.logger.log(`文件已删除: ${objectKey}`);
    } catch (error) {
      this.logger.error(`删除文件失败: ${objectKey}`, error);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件流
   */
  async getFileStream(objectKey: string): Promise<Readable> {
    return await this.client.getObject(this.bucket, objectKey);
  }

  /**
   * 获取文件内容（Buffer）
   */
  async getFileBuffer(objectKey: string): Promise<Buffer> {
    const stream = await this.getFileStream(objectKey);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * 获取 bucket 名称
   */
  getBucket(): string {
    return this.bucket;
  }
}
