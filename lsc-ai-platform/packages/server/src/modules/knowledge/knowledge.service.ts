import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MinioService } from '../storage/minio.service.js';
import { DocumentPipelineService } from '../../services/document-pipeline.service.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly pipeline: DocumentPipelineService,
  ) {}

  /**
   * Verify knowledge base exists and belongs to the user.
   */
  private async verifyOwnership(id: string, userId: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
    });
    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }
    if (kb.userId !== userId) {
      throw new ForbiddenException('无权访问此知识库');
    }
    return kb;
  }

  /**
   * 创建知识库
   */
  async create(
    userId: string,
    data: {
      name: string;
      description?: string;
      projectId?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    },
  ) {
    return this.prisma.knowledgeBase.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        projectId: data.projectId,
        chunkSize: data.chunkSize ?? 512,
        chunkOverlap: data.chunkOverlap ?? 64,
      },
    });
  }

  /**
   * 知识库列表（分页 + 搜索）
   */
  async findAll(
    userId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
    },
  ) {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: any = { userId };
    if (options.search) {
      where.name = { contains: options.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: { select: { documents: true } },
        },
      }),
      this.prisma.knowledgeBase.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 知识库详情（包含文档列表）
   */
  async findById(id: string, userId: string) {
    await this.verifyOwnership(id, userId);

    return this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * 更新知识库
   */
  async update(
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    },
  ) {
    await this.verifyOwnership(id, userId);

    return this.prisma.knowledgeBase.update({
      where: { id },
      data,
    });
  }

  /**
   * 删除知识库（级联删除文档和分块由 Prisma onDelete: Cascade 处理）
   */
  async delete(id: string, userId: string) {
    const kb = await this.verifyOwnership(id, userId);

    // 删除 MinIO 中的所有文档文件
    const documents = await this.prisma.document.findMany({
      where: { knowledgeBaseId: id },
      select: { objectKey: true },
    });

    for (const doc of documents) {
      try {
        await this.minioService.deleteFile(doc.objectKey);
      } catch (error) {
        this.logger.warn(`MinIO 删除失败: ${doc.objectKey}, ${error}`);
      }
    }

    // 清理向量索引（LibSQLVector 中的 kb-{id}）
    try {
      await this.pipeline.deleteKnowledgeBaseIndex(id);
    } catch (error) {
      this.logger.warn(`向量索引清理失败 (kb=${id}): ${error}`);
    }

    await this.prisma.knowledgeBase.delete({ where: { id } });

    return kb;
  }

  /**
   * 上传文档到知识库
   */
  async uploadDocument(
    knowledgeBaseId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    await this.verifyOwnership(knowledgeBaseId, userId);

    // 生成唯一文件名
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;

    // 按知识库组织目录
    const objectKey = `knowledge/${knowledgeBaseId}/${filename}`;

    // 上传到 MinIO
    const uploaded = await this.minioService.uploadFile(
      objectKey,
      file.buffer,
      file.mimetype,
    );

    // 创建 Document 记录（status = pending）
    const document = await this.prisma.document.create({
      data: {
        knowledgeBaseId,
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        bucket: uploaded.bucket,
        objectKey: uploaded.objectKey,
        status: 'pending',
      },
    });

    // 更新知识库文档计数
    await this.prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { documentCount: { increment: 1 } },
    });

    this.logger.log(
      `文档上传成功: ${file.originalname} -> ${objectKey} (知识库: ${knowledgeBaseId})`,
    );

    // 触发解析 pipeline
    this.triggerPipeline(document.id);

    return document;
  }

  /**
   * 获取知识库的文档列表（分页）
   */
  async findDocuments(
    knowledgeBaseId: string,
    userId: string,
    options?: { page?: number; pageSize?: number },
  ) {
    await this.verifyOwnership(knowledgeBaseId, userId);

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = { knowledgeBaseId };

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId: string, userId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { knowledgeBase: { select: { id: true, userId: true } } },
    });

    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    if (document.knowledgeBase.userId !== userId) {
      throw new ForbiddenException('无权删除此文档');
    }

    // 从 MinIO 删除文件
    try {
      await this.minioService.deleteFile(document.objectKey);
    } catch (error) {
      this.logger.warn(`MinIO 删除失败: ${document.objectKey}, ${error}`);
    }

    // 清理文档在向量索引中的向量
    try {
      await this.pipeline.deleteDocumentVectors(documentId, document.knowledgeBaseId);
    } catch (error) {
      this.logger.warn(`文档向量清理失败 (doc=${documentId}): ${error}`);
    }

    // 删除数据库记录（级联删除分块）
    await this.prisma.document.delete({ where: { id: documentId } });

    // 更新知识库计数
    await this.prisma.knowledgeBase.update({
      where: { id: document.knowledgeBaseId },
      data: {
        documentCount: { decrement: 1 },
        chunkCount: { decrement: document.chunkCount },
      },
    });

    return document;
  }

  /**
   * 触发文档解析 pipeline（异步，不阻塞上传响应）
   */
  triggerPipeline(documentId: string) {
    this.pipeline.processDocument(documentId).catch((error) => {
      this.logger.error(
        `文档解析失败: ${documentId} — ${error?.message || error}`,
      );
    });
  }
}
