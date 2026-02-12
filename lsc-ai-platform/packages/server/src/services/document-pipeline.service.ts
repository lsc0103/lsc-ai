/**
 * 文档处理管线服务
 * 上传 → MinIO 下载 → 文本提取 → 分块 → 向量化 → 存储
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { MinioService } from '../modules/storage/minio.service.js';
import { LibSQLVector } from '@mastra/libsql';
import { extractText } from './text-extractor.js';
import { chunkText } from './text-chunker.js';
import { EmbeddingFactory } from '../mastra/embedding-factory.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class DocumentPipelineService {
  private readonly logger = new Logger(DocumentPipelineService.name);
  private vector!: LibSQLVector;
  private embeddingFactory!: EmbeddingFactory;
  private initialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly config: ConfigService,
  ) {}

  /**
   * 延迟初始化 LibSQLVector（避免构造函数异步问题）
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const libsqlUrl =
      this.config.get<string>('LIBSQL_URL') || 'file:./data/lsc-ai.db';

    this.vector = new LibSQLVector({
      id: 'kb-vector',
      url: libsqlUrl,
    });

    this.embeddingFactory = EmbeddingFactory.createFromEnv();
    await this.embeddingFactory.initialize();

    this.initialized = true;
    this.logger.log(`LibSQLVector 已初始化 (document-pipeline): ${libsqlUrl}`);
    this.logger.log(`EmbeddingFactory 已初始化: ${EmbeddingFactory.getConfigInfo()}`);
  }

  /**
   * 处理单个文档：下载 → 提取 → 分块 → 向量化
   */
  async processDocument(documentId: string): Promise<void> {
    await this.ensureInitialized();

    // 1. 读取 Document 记录
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { knowledgeBase: true },
    });

    if (!doc) {
      throw new Error(`Document ${documentId} 不存在`);
    }

    // 标记为 processing
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    // 临时文件路径
    const tmpDir = path.join(os.tmpdir(), 'lscai-pipeline');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `${randomUUID()}${path.extname(doc.filename)}`);

    try {
      // 2. 从 MinIO 下载文件到临时目录
      this.logger.log(`下载文件: ${doc.objectKey} → ${tmpFile}`);
      const buffer = await this.minio.getFileBuffer(doc.objectKey);
      await fs.writeFile(tmpFile, buffer);

      // 3. 提取文本
      this.logger.log(`提取文本: ${doc.originalName} (${doc.mimeType})`);
      const text = await extractText(tmpFile, doc.mimeType);

      if (!text || text.trim().length === 0) {
        throw new Error('文档内容为空，无法提取文本');
      }

      // 4. 分块
      const kb = doc.knowledgeBase;
      const chunkSize = kb.chunkSize || 512;
      const chunkOverlap = kb.chunkOverlap || 64;

      this.logger.log(`分块: chunkSize=${chunkSize}, chunkOverlap=${chunkOverlap}`);
      const chunks = chunkText(text, chunkSize, chunkOverlap);

      if (chunks.length === 0) {
        throw new Error('分块结果为空');
      }

      this.logger.log(`分块完成: ${chunks.length} 个文本块`);

      // 5. 创建向量索引（如果不存在）
      const indexName = `kb-${kb.id}`;
      await this.ensureIndex(indexName);

      // 6. 批量嵌入 + 存储向量
      const batchSize = 32;
      const allVectorIds: string[] = [];

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map((c) => c.content);

        // 嵌入（通过 EmbeddingFactory，支持 fastembed / 公司 API 切换）
        const embeddings = await this.embeddingFactory.embed(texts);

        // 准备元数据
        const metadata = batch.map((c) => ({
          documentId: doc.id,
          knowledgeBaseId: kb.id,
          chunkIndex: c.index,
          filename: doc.originalName,
          ...c.metadata,
        }));

        // 生成 ID
        const ids = batch.map(() => randomUUID());

        // 存入 LibSQLVector
        await this.vector.upsert({
          indexName,
          vectors: embeddings,
          metadata,
          ids,
        });

        allVectorIds.push(...ids);
      }

      // 7. 创建 DocumentChunk 记录
      const chunkRecords = chunks.map((chunk, idx) => ({
        id: randomUUID(),
        documentId: doc.id,
        index: chunk.index,
        content: chunk.content,
        metadata: chunk.metadata as any,
        tokenCount: Math.ceil(chunk.content.length / 2), // 中文约2字符一个token
        vectorId: allVectorIds[idx] || null,
      }));

      await this.prisma.documentChunk.createMany({
        data: chunkRecords,
      });

      // 8. 更新 Document 状态
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'completed',
          chunkCount: chunks.length,
          parsedAt: new Date(),
          error: null,
        },
      });

      // 9. 更新 KnowledgeBase 统计
      const docStats = await this.prisma.document.aggregate({
        where: {
          knowledgeBaseId: kb.id,
          status: 'completed',
        },
        _count: { id: true },
        _sum: { chunkCount: true },
      });

      await this.prisma.knowledgeBase.update({
        where: { id: kb.id },
        data: {
          documentCount: docStats._count.id,
          chunkCount: docStats._sum.chunkCount || 0,
        },
      });

      this.logger.log(
        `文档处理完成: ${doc.originalName} → ${chunks.length} 个块, ${allVectorIds.length} 个向量`,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`文档处理失败: ${doc.originalName} — ${errMsg}`);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          error: errMsg,
        },
      });

      throw error;
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(tmpFile);
      } catch {
        // 忽略清理失败
      }
    }
  }

  /**
   * 确保向量索引存在
   */
  private async ensureIndex(indexName: string): Promise<void> {
    try {
      const indexes = await this.vector.listIndexes();
      if (!indexes.includes(indexName)) {
        const dimension = this.embeddingFactory.getDimension();
        await this.vector.createIndex({
          indexName,
          dimension,
          metric: 'cosine',
        });
        this.logger.log(`创建向量索引: ${indexName} (dim=${dimension})`);
      }
    } catch (error) {
      // createIndex 可能因为已存在而抛错，忽略
      this.logger.warn(`ensureIndex ${indexName}: ${error}`);
    }
  }

  /**
   * 删除文档对应的向量（用于文档删除时清理）
   */
  async deleteDocumentVectors(documentId: string, knowledgeBaseId: string): Promise<void> {
    await this.ensureInitialized();

    const indexName = `kb-${knowledgeBaseId}`;
    try {
      await this.vector.deleteVectors({
        indexName,
        filter: { documentId },
      });
      this.logger.log(`已删除文档向量: documentId=${documentId}`);
    } catch (error) {
      this.logger.warn(`删除文档向量失败: ${error}`);
    }
  }

  /**
   * 删除知识库的向量索引
   */
  async deleteKnowledgeBaseIndex(knowledgeBaseId: string): Promise<void> {
    await this.ensureInitialized();

    const indexName = `kb-${knowledgeBaseId}`;
    try {
      await this.vector.deleteIndex({ indexName });
      this.logger.log(`已删除向量索引: ${indexName}`);
    } catch (error) {
      this.logger.warn(`删除向量索引失败: ${error}`);
    }
  }

  /**
   * 获取 LibSQLVector 实例（供外部 RAG 检索使用）
   */
  getVector(): LibSQLVector {
    return this.vector;
  }
}
