/**
 * RAG 检索服务
 *
 * 提供知识库向量语义搜索能力：
 * 1. 使用 FastEmbed 将查询编码为向量
 * 2. 在 LibSQLVector 中搜索相似向量
 * 3. 从 Prisma DocumentChunk 获取完整内容
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import type { LibSQLVector } from '@mastra/libsql';
import { PrismaService } from '../prisma/prisma.service.js';
import { MastraAgentService } from './mastra-agent.service.js';
import { setRagService } from '../tools/rag-tools.js';
import { EmbeddingFactory } from '../mastra/embedding-factory.js';

export interface RagSearchResult {
  content: string;
  score: number;
  documentName: string;
  chunkIndex: number;
  metadata: Record<string, any>;
}

export interface RagSearchOptions {
  knowledgeBaseId?: string;
  topK?: number;
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);

  private vector!: LibSQLVector;
  private embeddingFactory!: EmbeddingFactory;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mastraAgentService: MastraAgentService,
  ) {}

  async onModuleInit() {
    try {
      // 从 MastraAgentService 获取共享的 vector
      this.vector = this.mastraAgentService.getVector();

      // 初始化 EmbeddingFactory（单例，与 DocumentPipeline 共享）
      this.embeddingFactory = EmbeddingFactory.createFromEnv();
      await this.embeddingFactory.initialize();

      // 注册自身到 rag-tools 模块级引用，供 searchKnowledge 工具调用
      setRagService(this);

      this.logger.log(
        `RAG 检索服务已初始化（vector: ${!!this.vector}, embedding: ${this.embeddingFactory.getProvider()}, rerank: ${this.embeddingFactory.supportsRerank()}）`,
      );
    } catch (error) {
      this.logger.error(
        `RAG 检索服务初始化失败: ${(error as Error).message}。知识库搜索功能不可用，其他模块不受影响。`,
      );
    }
  }

  /**
   * 在知识库中搜索相关内容
   */
  async search(
    query: string,
    options?: RagSearchOptions,
  ): Promise<RagSearchResult[]> {
    if (!this.embeddingFactory || !this.vector) {
      throw new Error('RAG 服务未初始化（embeddingFactory 或 vector 不可用）');
    }

    const topK = options?.topK ?? 5;
    const knowledgeBaseId = options?.knowledgeBaseId;

    this.logger.log(
      `[RAG Search] query="${query.substring(0, 60)}", kb=${knowledgeBaseId || 'all'}, topK=${topK}`,
    );

    try {
      // 1. 使用 EmbeddingFactory 编码 query 为向量
      const embeddings = await this.embeddingFactory.embed([query]);
      const queryVector: number[] = embeddings[0] || [];

      // 2. 确定搜索的 index 名称
      let results: Array<{ id: string; score: number; metadata?: Record<string, any> }> = [];

      if (knowledgeBaseId) {
        // 搜索指定知识库
        const indexName = `kb-${knowledgeBaseId}`;
        try {
          const queryResults = await this.vector.query({
            indexName,
            queryVector,
            topK,
          });
          results = queryResults;
        } catch (error) {
          this.logger.warn(`[RAG Search] index ${indexName} 查询失败: ${(error as Error).message}`);
        }
      } else {
        // 搜索所有知识库：找出所有 kb-* index
        const knowledgeBases = await this.prisma.knowledgeBase.findMany({
          select: { id: true },
        });

        // 并行搜索所有知识库
        const searchPromises = knowledgeBases.map(async (kb) => {
          const indexName = `kb-${kb.id}`;
          try {
            return await this.vector.query({
              indexName,
              queryVector,
              topK,
            });
          } catch (error) {
            // index 可能不存在（知识库还没有文档），记录警告
            this.logger.warn(`[RAG Search] index kb-${kb.id} 查询失败: ${(error as Error).message}`);
            return [];
          }
        });

        const allResults = await Promise.all(searchPromises);
        results = allResults.flat();

        // 按 score 排序后取 topK
        results.sort((a, b) => b.score - a.score);
        results = results.slice(0, topK);
      }

      if (results.length === 0) {
        this.logger.log('[RAG Search] 未找到相关结果');
        return [];
      }

      // 3. 根据 vectorId 从 Prisma DocumentChunk 获取完整内容
      const vectorIds = results.map((r) => r.id);
      const chunks = await this.prisma.documentChunk.findMany({
        where: { vectorId: { in: vectorIds } },
        include: {
          document: {
            select: {
              originalName: true,
              filename: true,
              knowledgeBaseId: true,
            },
          },
        },
      });

      // 建立 vectorId -> chunk 映射
      const chunkMap = new Map(chunks.map((c) => [c.vectorId, c]));

      // 4. 组装返回结果
      const searchResults: RagSearchResult[] = [];
      for (const r of results) {
        const chunk = chunkMap.get(r.id);
        if (!chunk) continue;

        searchResults.push({
          content: chunk.content,
          score: r.score,
          documentName: chunk.document.originalName || chunk.document.filename,
          chunkIndex: chunk.index,
          metadata: (chunk.metadata as Record<string, any>) || {},
        });
      }

      // 5. Rerank 精排（如果可用）
      if (this.embeddingFactory.supportsRerank() && searchResults.length > 1) {
        try {
          const docs = searchResults.map((r) => r.content);
          const rerankResults = await this.embeddingFactory.rerank(query, docs, topK);
          if (rerankResults && rerankResults.length > 0) {
            const reranked: RagSearchResult[] = rerankResults
              .filter((rr) => searchResults[rr.index])
              .map((rr) => ({
                ...searchResults[rr.index]!,
                score: rr.score,
              }));
            this.logger.log(`[RAG Search] Rerank 完成: ${reranked.length} 条结果`);
            return reranked;
          }
        } catch (rerankError) {
          this.logger.warn(`[RAG Search] Rerank 失败，使用原始排序: ${(rerankError as Error).message}`);
        }
      }

      this.logger.log(`[RAG Search] 返回 ${searchResults.length} 条结果`);
      return searchResults;
    } catch (error) {
      this.logger.error(`[RAG Search] 搜索失败: ${(error as Error).message}`);
      throw error;
    }
  }
}
