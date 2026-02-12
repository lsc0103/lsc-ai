/**
 * 知识库搜索 Controller
 *
 * 提供 REST API 供前端进行知识库语义搜索
 */

import {
  Controller,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RagService } from '../../services/rag.service.js';

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeSearchController {
  private readonly logger = new Logger(KnowledgeSearchController.name);

  constructor(
    private readonly ragService: RagService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/knowledge-bases/:id/search
   * 在指定知识库中搜索
   */
  @Post(':id/search')
  async searchInKnowledgeBase(
    @Param('id') knowledgeBaseId: string,
    @Request() req: any,
    @Body() body: { query: string; topK?: number },
  ) {
    if (!body.query || typeof body.query !== 'string') {
      throw new HttpException('query 参数为必填字符串', HttpStatus.BAD_REQUEST);
    }

    // 校验知识库归属
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      select: { userId: true },
    });
    if (!kb) {
      throw new HttpException('知识库不存在', HttpStatus.NOT_FOUND);
    }
    if (kb.userId !== req.user.id) {
      throw new ForbiddenException('无权搜索该知识库');
    }

    const query =
      body.query.length > 500 ? body.query.slice(0, 500) : body.query;
    const topK =
      typeof body.topK === 'number' && body.topK >= 1 && body.topK <= 50
        ? body.topK
        : 5;

    try {
      const results = await this.ragService.search(query, {
        knowledgeBaseId,
        topK,
      });

      return {
        success: true,
        data: {
          query,
          knowledgeBaseId,
          results: results.map((r) => ({
            content: r.content,
            score: Math.round(r.score * 100) / 100,
            documentName: r.documentName,
            chunkIndex: r.chunkIndex,
            metadata: r.metadata,
          })),
        },
      };
    } catch (error) {
      this.logger.error(`搜索失败: ${(error as Error).message}`);
      throw new HttpException(
        `知识库搜索失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/knowledge-bases/search
   * 在所有知识库中搜索
   */
  @Post('search')
  async searchAll(
    @Request() req: any,
    @Body() body: { query: string; topK?: number },
  ) {
    if (!body.query || typeof body.query !== 'string') {
      throw new HttpException('query 参数为必填字符串', HttpStatus.BAD_REQUEST);
    }

    // 获取当前用户拥有的知识库 ID 列表
    const userKBs = await this.prisma.knowledgeBase.findMany({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (userKBs.length === 0) {
      return { success: true, data: { query: body.query, results: [] } };
    }

    const query =
      body.query.length > 500 ? body.query.slice(0, 500) : body.query;
    const topK =
      typeof body.topK === 'number' && body.topK >= 1 && body.topK <= 50
        ? body.topK
        : 5;

    try {
      // 逐个知识库搜索，合并结果，按分数排序
      const allResults: any[] = [];

      for (const kb of userKBs) {
        const results = await this.ragService.search(query, {
          knowledgeBaseId: kb.id,
          topK,
        });
        allResults.push(...results);
      }

      // 按分数降序排序，取 topK
      allResults.sort((a, b) => b.score - a.score);
      const topResults = allResults.slice(0, topK);

      return {
        success: true,
        data: {
          query,
          results: topResults.map((r) => ({
            content: r.content,
            score: Math.round(r.score * 100) / 100,
            documentName: r.documentName,
            chunkIndex: r.chunkIndex,
            metadata: r.metadata,
          })),
        },
      };
    } catch (error) {
      this.logger.error(`搜索失败: ${(error as Error).message}`);
      throw new HttpException(
        `知识库搜索失败: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
