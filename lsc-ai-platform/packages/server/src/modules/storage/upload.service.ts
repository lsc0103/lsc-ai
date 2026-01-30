import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MinioService } from './minio.service.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export interface UploadFileDto {
  userId: string;
  sessionId?: string;
  file: Express.Multer.File;
}

export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  /**
   * 上传文件
   */
  async uploadFile(dto: UploadFileDto): Promise<FileInfo> {
    const { userId, sessionId, file } = dto;

    // 生成唯一文件名
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;

    // 按日期组织目录
    const date = new Date();
    const dateDir = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const objectKey = `uploads/${userId}/${dateDir}/${filename}`;

    // 上传到 MinIO
    const uploaded = await this.minioService.uploadFile(
      objectKey,
      file.buffer,
      file.mimetype,
    );

    // 保存到数据库
    const fileRecord = await this.prisma.file.create({
      data: {
        userId,
        sessionId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: uploaded.bucket,
        objectKey: uploaded.objectKey,
        url: uploaded.url,
      },
    });

    this.logger.log(`文件上传成功: ${file.originalname} -> ${objectKey}`);

    return {
      id: fileRecord.id,
      filename: fileRecord.filename,
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      size: fileRecord.size,
      url: uploaded.url,
      createdAt: fileRecord.createdAt,
    };
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(userId: string, sessionId: string | undefined, files: Express.Multer.File[]): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    for (const file of files) {
      const result = await this.uploadFile({ userId, sessionId, file });
      results.push(result);
    }

    return results;
  }

  /**
   * 获取用户文件列表
   */
  async getUserFiles(userId: string, sessionId?: string): Promise<FileInfo[]> {
    const where: any = { userId };
    if (sessionId) {
      where.sessionId = sessionId;
    }

    const files = await this.prisma.file.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // 刷新 URL（预签名 URL 可能过期）
    const results: FileInfo[] = [];
    for (const file of files) {
      let url = file.url || '';
      try {
        url = await this.minioService.getFileUrl(file.objectKey);
      } catch {
        // 如果获取失败，使用原来的 URL
      }

      results.push({
        id: file.id,
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        url,
        createdAt: file.createdAt,
      });
    }

    return results;
  }

  /**
   * 获取单个文件信息
   */
  async getFileById(fileId: string): Promise<FileInfo | null> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return null;
    }

    let url = file.url || '';
    try {
      url = await this.minioService.getFileUrl(file.objectKey);
    } catch {
      // 如果获取失败，使用原来的 URL
    }

    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url,
      createdAt: file.createdAt,
    };
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      return false;
    }

    // 从 MinIO 删除
    try {
      await this.minioService.deleteFile(file.objectKey);
    } catch (error) {
      this.logger.warn(`MinIO 删除失败，继续删除数据库记录: ${error}`);
    }

    // 从数据库删除
    await this.prisma.file.delete({
      where: { id: fileId },
    });

    return true;
  }
}
