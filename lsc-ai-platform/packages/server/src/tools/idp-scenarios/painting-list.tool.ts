import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IdpService } from '../../modules/idp/idp.service.js';

let _idpService: IdpService | null = null;
export function setPaintingListIdpService(service: IdpService) { _idpService = service; }

export const processPaintingListTool = createTool({
  id: 'processPaintingList',
  description: `处理出入涂清单文档。自动识别表格、合并跨页表格、提取涂装项目明细。
当用户提到"涂装清单"、"出入涂"、"涂装表"时使用。`,
  inputSchema: z.object({
    fileContent: z.string().describe('文件的 base64 编码内容'),
    filename: z.string().describe('文件名'),
  }),
  execute: async ({ fileContent, filename }) => {
    if (!_idpService) return { success: false, error: 'IDP 服务尚未初始化' };
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const result = await _idpService.processPaintingList(buffer, filename);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: `涂装清单处理失败: ${(error as Error).message}` };
    }
  },
});
