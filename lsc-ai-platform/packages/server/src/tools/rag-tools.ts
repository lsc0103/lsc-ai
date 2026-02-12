/**
 * RAG 知识库检索工具（Mastra 格式）
 *
 * 提供 searchKnowledge 工具供 AI Agent 调用
 * 通过模块级单例引用 RagService 实例
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { RagService } from '../services/rag.service.js';

// 模块级 RagService 引用（由 mastra-agent.service.ts 初始化后注入）
let _ragService: RagService | null = null;

/**
 * 注入 RagService 实例（在服务初始化后调用）
 */
export function setRagService(service: RagService) {
  _ragService = service;
}

export const searchKnowledgeTool = createTool({
  id: 'searchKnowledge',
  description: `在知识库中搜索相关内容。当用户询问特定业务知识、文档内容、规章制度、技术资料等需要查阅资料的问题时使用此工具。
搜索结果包含文档片段、相似度分数和来源文档名称。`,
  inputSchema: z.object({
    query: z.string().describe('搜索关键词或问题'),
    knowledgeBaseId: z
      .string()
      .optional()
      .describe('指定知识库ID，不传则搜索全部知识库'),
    topK: z
      .number()
      .optional()
      .default(5)
      .describe('返回结果数量，默认5条'),
  }),
  execute: async ({ query, knowledgeBaseId, topK }) => {
    if (!_ragService) {
      return {
        success: false,
        error: '知识库检索服务尚未初始化',
        results: [],
      };
    }

    try {
      const results = await _ragService.search(query, {
        knowledgeBaseId,
        topK,
      });

      if (results.length === 0) {
        return {
          success: true,
          message: '未找到相关知识库内容',
          results: [],
        };
      }

      // 格式化结果供 AI 阅读
      const formatted = results.map((r, i) => ({
        rank: i + 1,
        content: r.content,
        score: Math.round(r.score * 100) / 100,
        source: r.documentName,
        chunkIndex: r.chunkIndex,
      }));

      return {
        success: true,
        message: `找到 ${results.length} 条相关内容`,
        results: formatted,
      };
    } catch (error) {
      return {
        success: false,
        error: `知识库搜索失败: ${(error as Error).message}`,
        results: [],
      };
    }
  },
});

export const ragTools = {
  searchKnowledge: searchKnowledgeTool,
};
