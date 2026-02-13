/**
 * IDP 智能文档处理工具（Mastra 格式）
 *
 * 通过模块级单例引用 IdpService 实例
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IdpService } from '../modules/idp/idp.service.js';

let _idpService: IdpService | null = null;

export function setIdpService(service: IdpService) {
  _idpService = service;
}

export const ocrDocumentTool = createTool({
  id: 'ocrDocument',
  description: `对文档进行 OCR 文字识别。支持 PDF 和图片文件。当用户说"识别"、"OCR"、"扫描"、"文字提取"、"文档识别"时使用此工具。
返回每页的识别文字和置信度。`,
  inputSchema: z.object({
    fileContent: z.string().describe('文件的 base64 编码内容'),
    filename: z.string().describe('文件名（含扩展名，如 report.pdf）'),
    language: z.string().optional().default('ch').describe('识别语言，默认中文(ch)'),
  }),
  execute: async ({ fileContent, filename, language }) => {
    if (!_idpService) {
      return { success: false, error: 'IDP 服务尚未初始化' };
    }
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const result = await _idpService.ocrDocument(buffer, filename, { language });
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: `OCR 识别失败: ${(error as Error).message}` };
    }
  },
});

export const extractTableTool = createTool({
  id: 'extractTable',
  description: `从文档中提取表格数据。支持 PDF 和图片。当用户说"提取表格"、"表格识别"、"读取表格"时使用此工具。
返回结构化的表头和行数据，可直接用于 showTable 展示。`,
  inputSchema: z.object({
    fileContent: z.string().describe('文件的 base64 编码内容'),
    filename: z.string().describe('文件名（含扩展名）'),
  }),
  execute: async ({ fileContent, filename }) => {
    if (!_idpService) {
      return { success: false, error: 'IDP 服务尚未初始化' };
    }
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const result = await _idpService.extractTables(buffer, filename);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: `表格提取失败: ${(error as Error).message}` };
    }
  },
});

export const analyzeDocumentTool = createTool({
  id: 'analyzeDocument',
  description: `全面分析文档，包括 OCR 文字识别、表格提取和版面分析。当用户说"分析文档"、"文档分析"、"全面分析"时使用此工具。`,
  inputSchema: z.object({
    fileContent: z.string().describe('文件的 base64 编码内容'),
    filename: z.string().describe('文件名（含扩展名）'),
  }),
  execute: async ({ fileContent, filename }) => {
    if (!_idpService) {
      return { success: false, error: 'IDP 服务尚未初始化' };
    }
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const result = await _idpService.analyzeDocumentFull(buffer, filename);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: `文档分析失败: ${(error as Error).message}` };
    }
  },
});

export const compareDocumentsTool = createTool({
  id: 'compareDocuments',
  description: `对比两份文档的差异。当用户说"对比文档"、"比较文件"、"文档差异"时使用此工具。`,
  inputSchema: z.object({
    fileContent1: z.string().describe('第一份文件的 base64 编码'),
    filename1: z.string().describe('第一份文件名'),
    fileContent2: z.string().describe('第二份文件的 base64 编码'),
    filename2: z.string().describe('第二份文件名'),
  }),
  execute: async ({ fileContent1, filename1, fileContent2, filename2 }) => {
    if (!_idpService) {
      return { success: false, error: 'IDP 服务尚未初始化' };
    }
    try {
      const buffer1 = Buffer.from(fileContent1, 'base64');
      const buffer2 = Buffer.from(fileContent2, 'base64');
      const [result1, result2] = await Promise.all([
        _idpService.ocrDocument(buffer1, filename1),
        _idpService.ocrDocument(buffer2, filename2),
      ]);
      const text1 = result1.pages?.map((p: any) => p.full_text).join('\n') || '';
      const text2 = result2.pages?.map((p: any) => p.full_text).join('\n') || '';
      return {
        success: true,
        document1: { filename: filename1, text: text1, pages: result1.total_pages },
        document2: { filename: filename2, text: text2, pages: result2.total_pages },
        identical: text1 === text2,
        summary: text1 === text2 ? '两份文档内容完全相同' : '两份文档存在差异',
      };
    } catch (error) {
      return { success: false, error: `文档对比失败: ${(error as Error).message}` };
    }
  },
});

export const idpTools = {
  ocrDocument: ocrDocumentTool,
  extractTable: extractTableTool,
  analyzeDocument: analyzeDocumentTool,
  compareDocuments: compareDocumentsTool,
};
