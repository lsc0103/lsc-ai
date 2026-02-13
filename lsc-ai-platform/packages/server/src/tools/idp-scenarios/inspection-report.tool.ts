import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IdpService } from '../../modules/idp/idp.service.js';

let _idpService: IdpService | null = null;
export function setInspectionReportIdpService(service: IdpService) { _idpService = service; }

export const processInspectionReportTool = createTool({
  id: 'processInspectionReport',
  description: `处理检验报告（NDT 无损检测报告）。自动分类（RT/UT/MT/PT）、提取关键字段、质量校验。
当用户提到"检验报告"、"NDT"、"无损检测"、"探伤报告"时使用。
提取字段: 报告编号, 日期, 检验员, 设备号, 焊缝号, 材质, 厚度, 验收标准, 结果, 缺陷描述`,
  inputSchema: z.object({
    fileContent: z.string().describe('文件的 base64 编码内容'),
    filename: z.string().describe('文件名'),
  }),
  execute: async ({ fileContent, filename }) => {
    if (!_idpService) return { success: false, error: 'IDP 服务尚未初始化' };
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const result = await _idpService.processInspectionReport(buffer, filename);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: `检验报告处理失败: ${(error as Error).message}` };
    }
  },
});
