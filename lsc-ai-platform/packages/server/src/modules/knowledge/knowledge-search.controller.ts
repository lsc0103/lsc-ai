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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RagService } from '../../services/rag.service.js';

@Controller('knowledge-bases')
@UseGuards(JwtAuthGuard)
export class KnowledgeSearchController {
  private readonly logger = new Logger(KnowledgeSearchController.name);

  constructor(private readonly ragService: RagService) {}

  /**
   * POST /api/knowledge-bases/:id/search
   * 在指定知识库中搜索
   */
  @Post(':id/search')
  async searchInKnowledgeBase(
    @Param('id') knowledgeBaseId: string,
    @Body() body: { query: string; topK?: number },
  ) {
    if (!body.query || typeof body.query !== 'string') {
      throw new HttpException('query 参数为必填字符串', HttpStatus.BAD_REQUEST);
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
  async searchAll(@Body() body: { query: string; topK?: number }) {
    if (!body.query || typeof body.query !== 'string') {
      throw new HttpException('query 参数为必填字符串', HttpStatus.BAD_REQUEST);
    }

    const query =
      body.query.length > 500 ? body.query.slice(0, 500) : body.query;
    const topK =
      typeof body.topK === 'number' && body.topK >= 1 && body.topK <= 50
        ? body.topK
        : 5;

    try {
      const results = await this.ragService.search(query, {
        topK,
      });

      return {
        success: true,
        data: {
          query,
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
}
