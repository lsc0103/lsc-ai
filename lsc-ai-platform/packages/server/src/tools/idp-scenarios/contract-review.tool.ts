import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IdpService } from '../../modules/idp/idp.service.js';
import { evaluateContractRisks } from './contract-risk-rules.js';

let _idpService: IdpService | null = null;
export function setContractReviewIdpService(service: IdpService) { _idpService = service; }

export const reviewContractTool = createTool({
  id: 'reviewContract',
  description: `审查合同文档。OCR 提取全文后，结构化抽取合同要素并评估风险等级。
当用户说"审查合同"、"合同审查"、"合同风险"、"合同分析"时使用。
输出包含: 合同要素(30+字段)、三级风险评估(红/橙/黄)、审查建议`,
  inputSchema: z.object({
    fileContent: z.string().describe('合同文件的 base64 编码'),
    filename: z.string().describe('文件名'),
  }),
  execute: async ({ fileContent, filename }) => {
    if (!_idpService) return { success: false, error: 'IDP 服务尚未初始化' };
    try {
      const buffer = Buffer.from(fileContent, 'base64');
      const ocrResult = await _idpService.ocrDocument(buffer, filename);
      const fullText = ocrResult.pages?.map((p: any) => p.full_text).join('\n') || '';

      if (!fullText.trim()) {
        return { success: false, error: '无法从文档中提取文字' };
      }

      const elements = extractContractElements(fullText);
      const risks = evaluateContractRisks(elements);

      return {
        success: true,
        filename,
        fullText: fullText.substring(0, 2000) + (fullText.length > 2000 ? '...' : ''),
        elements,
        risks,
        summary: {
          totalElements: Object.keys(elements).length,
          highRisk: risks.filter((r) => r.level === 'high').length,
          mediumRisk: risks.filter((r) => r.level === 'medium').length,
          lowRisk: risks.filter((r) => r.level === 'low').length,
        },
      };
    } catch (error) {
      return { success: false, error: `合同审查失败: ${(error as Error).message}` };
    }
  },
});

function extractContractElements(text: string): Record<string, string | null> {
  const patterns: Record<string, RegExp> = {
    contractNo: /合同(?:编号|号)[：:]\s*([A-Za-z0-9\-\/]+)/,
    contractName: /合同(?:名称|标题)[：:]\s*(.+?)(?:\n|$)/,
    partyA: /甲\s*方[：:]\s*(.+?)(?:\n|$)/,
    partyB: /乙\s*方[：:]\s*(.+?)(?:\n|$)/,
    contractAmount: /合同(?:金额|总价|总额)[：:]\s*(.+?)(?:元|万|$)/,
    currency: /(人民币|美元|欧元|日元)/,
    signDate: /签(?:订|署)(?:日期|时间)?[：:]\s*([\d]{4}[-\/年][\d]{1,2}[-\/月][\d]{1,2}[日]?)/,
    startDate: /(?:开工|开始|起始)(?:日期|时间)?[：:]\s*([\d]{4}[-\/年][\d]{1,2}[-\/月][\d]{1,2}[日]?)/,
    endDate: /(?:完工|结束|截止|交付)(?:日期|时间)?[：:]\s*([\d]{4}[-\/年][\d]{1,2}[-\/月][\d]{1,2}[日]?)/,
    deliveryTerms: /交付(?:条件|条款|方式)[：:]\s*(.+?)(?:\n|$)/,
    paymentTerms: /付款(?:条件|条款|方式)[：:]\s*(.+?)(?:\n|$)/,
    warranty: /(?:质保|保修|质量保证)(?:期|期限)?[：:]\s*(.+?)(?:\n|$)/,
    penaltyClause: /(?:违约金|罚金|罚款|延期罚金)[：:]\s*(.+?)(?:\n|$)/,
    insuranceClause: /(?:保险|投保)[：:]\s*(.+?)(?:\n|$)/,
    forceMajeure: /不可抗力/,
    jurisdiction: /(?:管辖|仲裁|争议解决)[：:]\s*(.+?)(?:\n|$)/,
  };

  const elements: Record<string, string | null> = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    elements[key] = match ? (match[1] || match[0]).trim() : null;
  }
  return elements;
}
