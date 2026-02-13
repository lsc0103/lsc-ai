interface RiskItem {
  level: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  suggestion: string;
}

export function evaluateContractRisks(elements: Record<string, string | null>): RiskItem[] {
  const risks: RiskItem[] = [];

  // === 红色（高风险） ===

  if (elements.penaltyClause) {
    const percentMatch = elements.penaltyClause.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch && percentMatch[1] && parseFloat(percentMatch[1]) > 5) {
      risks.push({
        level: 'high',
        category: '延迟罚金过高',
        description: `延迟罚金比例为 ${percentMatch[1]}%，超过 5% 的安全阈值`,
        suggestion: '建议将延迟罚金比例降至 3%-5% 的行业标准范围',
      });
    }
  }

  if (!elements.forceMajeure) {
    risks.push({
      level: 'high',
      category: '缺少不可抗力条款',
      description: '合同中未发现不可抗力条款',
      suggestion: '强烈建议添加不可抗力条款，明确自然灾害、疫情等情况下的免责范围',
    });
  }

  if (elements.startDate && elements.endDate) {
    if (!elements.deliveryTerms?.includes('宽限')) {
      risks.push({
        level: 'high',
        category: '无交付宽限期',
        description: '合同中未发现交付宽限期的约定',
        suggestion: '建议约定 30 天以上的交付宽限期，避免不合理违约风险',
      });
    }
  }

  // === 橙色（注意） ===

  if (elements.paymentTerms) {
    if (elements.paymentTerms.includes('一次性') || elements.paymentTerms.includes('全额')) {
      risks.push({
        level: 'medium',
        category: '付款方式风险',
        description: '合同约定一次性付款，存在资金风险',
        suggestion: '建议采用分期付款方式（如 30/30/30/10），降低单次付款风险',
      });
    }
  }

  if (!elements.jurisdiction) {
    risks.push({
      level: 'medium',
      category: '管辖权未约定',
      description: '合同未明确争议解决方式和管辖法院',
      suggestion: '建议明确约定仲裁机构或管辖法院',
    });
  }

  if (!elements.insuranceClause) {
    risks.push({
      level: 'medium',
      category: '缺少保险条款',
      description: '合同中未发现保险相关约定',
      suggestion: '建议要求施工方购买工程一切险和第三方责任险',
    });
  }

  // === 黄色（提示） ===

  if (!elements.warranty) {
    risks.push({
      level: 'low',
      category: '质保期未约定',
      description: '合同中未发现质保期限的约定',
      suggestion: '建议约定 12-24 个月的质保期限',
    });
  }

  if (!elements.contractAmount) {
    risks.push({
      level: 'low',
      category: '合同金额未明确',
      description: '未能识别到明确的合同金额',
      suggestion: '请确认合同金额是否在正文或附件中明确标注',
    });
  }

  return risks;
}
