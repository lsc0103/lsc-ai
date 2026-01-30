/**
 * Office工具真实场景测试
 * 测试所有Office工具的实际文档生成效果
 */

import { CreateWordTool } from './packages/core/dist/tools/office/word.js';
import { CreateExcelTool } from './packages/core/dist/tools/office/excel.js';
import { CreatePPTTool } from './packages/core/dist/tools/office/ppt.js';
import { CreatePDFTool } from './packages/core/dist/tools/office/pdf.js';
import * as fs from 'fs/promises';

console.log('=== Office工具真实场景测试 ===\n');

// 确保输出目录存在
await fs.mkdir('./test-output', { recursive: true });

let passCount = 0;
let failCount = 0;
const issues = [];

// 1. 测试Word文档生成
console.log('1. 测试Word文档生成（商务报告）...');
const wordTool = new CreateWordTool();
const wordContent = `# 2024年第四季度业务报告

## 执行摘要

本季度公司业绩稳健增长，营收同比增长 **25%**，净利润增长 **18%**。

## 关键数据

| 指标 | Q3 | Q4 | 环比 |
|------|-----|-----|------|
| 营收 | 1.2亿 | 1.5亿 | +25% |
| 净利润 | 2000万 | 2360万 | +18% |
| 用户数 | 50万 | 68万 | +36% |

## 下季度计划

1. 扩展华东市场
2. 推出新产品线
3. 优化运营效率

> 注：本报告数据已经审计确认。
`;

try {
  const wordResult = await wordTool.execute({
    file_path: './test-output/测试报告.docx',
    theme: 'business',
    content: wordContent
  });

  if (wordResult.success) {
    console.log('   ✓ Word生成成功');
    // 检查文件是否存在且大小合理
    const stat = await fs.stat('./test-output/测试报告.docx');
    console.log('   - 文件大小:', (stat.size / 1024).toFixed(2), 'KB');
    if (stat.size < 1000) {
      issues.push('Word文件过小，可能内容未正确生成');
      failCount++;
    } else {
      passCount++;
    }
  } else {
    console.log('   ✗ Word生成失败:', wordResult.error);
    issues.push('Word: ' + wordResult.error);
    failCount++;
  }
} catch (err) {
  console.log('   ✗ Word异常:', err.message);
  issues.push('Word异常: ' + err.message);
  failCount++;
}

// 2. 测试Excel文档生成
console.log('\n2. 测试Excel文档生成（销售数据）...');
const excelTool = new CreateExcelTool();

try {
  const excelResult = await excelTool.execute({
    file_path: './test-output/销售数据.xlsx',
    theme: 'sales',
    sheets: [{
      name: '月度销售',
      headers: ['月份', '销售额', '成本', '利润', '利润率'],
      rows: [
        ['1月', 120000, 72000, 48000, '40%'],
        ['2月', 135000, 81000, 54000, '40%'],
        ['3月', 150000, 85000, 65000, '43%'],
        ['4月', 142000, 80000, 62000, '44%'],
        ['5月', 168000, 95000, 73000, '43%'],
        ['6月', 185000, 102000, 83000, '45%'],
      ],
      formulas: [
        { cell: 'D2', formula: 'B2-C2' },
      ],
      freezePane: { row: 1 }
    }]
  });

  if (excelResult.success) {
    console.log('   ✓ Excel生成成功');
    const stat = await fs.stat('./test-output/销售数据.xlsx');
    console.log('   - 文件大小:', (stat.size / 1024).toFixed(2), 'KB');
    if (stat.size < 1000) {
      issues.push('Excel文件过小');
      failCount++;
    } else {
      passCount++;
    }
  } else {
    console.log('   ✗ Excel生成失败:', excelResult.error);
    issues.push('Excel: ' + excelResult.error);
    failCount++;
  }
} catch (err) {
  console.log('   ✗ Excel异常:', err.message);
  issues.push('Excel异常: ' + err.message);
  failCount++;
}

// 3. 测试PPT生成
console.log('\n3. 测试PPT生成（产品介绍）...');
const pptTool = new CreatePPTTool();

try {
  const pptResult = await pptTool.execute({
    file_path: './test-output/产品介绍.pptx',
    theme: 'tech',
    slides: [
      {
        title: 'LSC-AI 智能助手',
        content: '下一代AI办公解决方案',
        layout: 'title'
      },
      {
        title: '核心功能',
        content: `- 智能文档生成
- 多格式支持
- 专业配色方案
- 中文优化支持`,
        layout: 'content'
      },
      {
        title: '技术架构',
        content: `采用模块化设计：
1. LLM 智能核心
2. 工具执行层
3. 文档渲染引擎`,
        layout: 'content'
      },
      {
        title: '联系我们',
        content: '感谢您的关注！',
        layout: 'title'
      }
    ]
  });

  if (pptResult.success) {
    console.log('   ✓ PPT生成成功');
    const stat = await fs.stat('./test-output/产品介绍.pptx');
    console.log('   - 文件大小:', (stat.size / 1024).toFixed(2), 'KB');
    if (stat.size < 5000) {
      issues.push('PPT文件过小，可能样式未正确应用');
      failCount++;
    } else {
      passCount++;
    }
  } else {
    console.log('   ✗ PPT生成失败:', pptResult.error);
    issues.push('PPT: ' + pptResult.error);
    failCount++;
  }
} catch (err) {
  console.log('   ✗ PPT异常:', err.message);
  issues.push('PPT异常: ' + err.message);
  failCount++;
}

// 4. 测试PDF生成
console.log('\n4. 测试PDF生成（技术文档）...');
const pdfTool = new CreatePDFTool();

const pdfContent = `# LSC-AI 技术文档

## 系统概述

LSC-AI 是一款基于大语言模型的智能办公助手，提供专业的文档生成能力。

## 主要特性

### 1. 多格式支持

支持生成以下格式的文档：
- Microsoft Word (.docx)
- Microsoft PowerPoint (.pptx)
- Microsoft Excel (.xlsx)
- PDF 文档

### 2. 专业排版

所有文档均采用专业设计：
- 精心设计的配色方案
- 统一的字体规范
- 美观的表格样式

## 代码示例

\`\`\`typescript
const tool = new CreateWordTool();
await tool.execute({
  file_path: 'report.docx',
  theme: 'business',
  content: '# 报告标题'
});
\`\`\`

## 总结

LSC-AI 致力于提供最佳的AI办公体验。
`;

try {
  const pdfResult = await pdfTool.execute({
    file_path: './test-output/技术文档.pdf',
    theme: 'professional',
    content: pdfContent
  });

  if (pdfResult.success) {
    console.log('   ✓ PDF生成成功');
    const stat = await fs.stat('./test-output/技术文档.pdf');
    console.log('   - 文件大小:', (stat.size / 1024).toFixed(2), 'KB');
    if (stat.size < 1000) {
      issues.push('PDF文件过小');
      failCount++;
    } else {
      passCount++;
    }
  } else {
    console.log('   ✗ PDF生成失败:', pdfResult.error);
    issues.push('PDF: ' + pdfResult.error);
    failCount++;
  }
} catch (err) {
  console.log('   ✗ PDF异常:', err.message);
  issues.push('PDF异常: ' + err.message);
  failCount++;
}

// 测试总结
console.log('\n' + '='.repeat(50));
console.log('测试总结:');
console.log(`  通过: ${passCount}/4`);
console.log(`  失败: ${failCount}/4`);

if (issues.length > 0) {
  console.log('\n发现的问题:');
  issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. ${issue}`);
  });
}

console.log('\n生成的文件在 test-output 目录，请手动打开检查：');
console.log('  - 测试报告.docx - 检查表格、粗体、配色');
console.log('  - 销售数据.xlsx - 检查表头样式、斑马纹、公式');
console.log('  - 产品介绍.pptx - 检查配色方案、幻灯片布局');
console.log('  - 技术文档.pdf  - 检查中文显示、代码块样式');
