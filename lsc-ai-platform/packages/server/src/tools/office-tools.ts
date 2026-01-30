/**
 * Office 工具（Mastra 格式）
 *
 * 复用 @lsc-ai/core 的 Office 工具实现
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ============================================================================
// Office 文件读取工具
// ============================================================================

export const readOfficeTool = createTool({
  id: 'readOffice',
  description: `读取 Office 文件内容（Word、Excel、PDF、PPT）。

支持的文件格式：
- Word: .docx
- Excel: .xlsx
- PDF: .pdf
- PowerPoint: .pptx`,
  inputSchema: z.object({
    filePath: z.string().describe('Office 文件的绝对路径'),
  }),
  execute: async ({ filePath }) => {
    try {
      const { ReadOfficeTool } = await import('./mastra/office/reader.js');
      const tool = new ReadOfficeTool();
      const result = await tool.execute({ filePath });
      return result;
    } catch (error) {
      throw new Error(`读取 Office 文件失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Word 文档工具
// ============================================================================

export const createWordTool = createTool({
  id: 'createWord',
  description: `创建 Word 文档。支持 Markdown 格式内容。

支持的 Markdown 语法：
- 标题（# ## ###）
- 粗体（**text**）
- 斜体（*text*）
- 列表（- item）
- 代码块（\`\`\`code\`\`\`）`,
  inputSchema: z.object({
    filePath: z.string().describe('Word 文档保存路径'),
    content: z.string().describe('文档内容（支持 Markdown）'),
    title: z.string().optional().describe('文档标题（可选）'),
  }),
  execute: async ({ filePath, content, title }) => {
    try {
      const { CreateWordTool } = await import('./mastra/office/word.js');
      const tool = new CreateWordTool();
      const result = await tool.execute({ filePath, content, title });
      return result;
    } catch (error) {
      throw new Error(`创建 Word 文档失败: ${(error as Error).message}`);
    }
  },
});

export const editWordTool = createTool({
  id: 'editWord',
  description: `编辑 Word 文档。追加内容到文档末尾。`,
  inputSchema: z.object({
    filePath: z.string().describe('Word 文档路径'),
    content: z.string().describe('要追加的内容'),
  }),
  execute: async ({ filePath, content }) => {
    try {
      const { EditWordTool } = await import('./mastra/office/wordEdit.js');
      const tool = new EditWordTool();
      const result = await tool.execute({ filePath, content });
      return result;
    } catch (error) {
      throw new Error(`编辑 Word 文档失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Excel 表格工具
// ============================================================================

export const createExcelTool = createTool({
  id: 'createExcel',
  description: `创建 Excel 表格。支持多个工作表、样式、公式。`,
  inputSchema: z.object({
    filePath: z.string().describe('Excel 文件保存路径'),
    sheets: z.array(z.object({
      name: z.string().describe('工作表名称'),
      data: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).describe('表格数据（二维数组）'),
      headers: z.array(z.string()).optional().describe('表头（可选）'),
    })).describe('工作表列表'),
  }),
  execute: async ({ filePath, sheets }) => {
    try {
      const { CreateExcelTool } = await import('./mastra/office/excel.js');
      const tool = new CreateExcelTool();
      const result = await tool.execute({ filePath, sheets });
      return result;
    } catch (error) {
      throw new Error(`创建 Excel 表格失败: ${(error as Error).message}`);
    }
  },
});

export const editExcelTool = createTool({
  id: 'editExcel',
  description: `编辑 Excel 表格。修改指定单元格或追加行。`,
  inputSchema: z.object({
    filePath: z.string().describe('Excel 文件路径'),
    sheetName: z.string().describe('工作表名称'),
    operations: z.array(z.object({
      type: z.enum(['set', 'append']).describe('操作类型'),
      row: z.number().optional().describe('行号（set 时必填）'),
      col: z.number().optional().describe('列号（set 时必填）'),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]).describe('值'),
    })).describe('操作列表'),
  }),
  execute: async ({ filePath, sheetName, operations }) => {
    try {
      const { EditExcelTool } = await import('./mastra/office/excelEdit.js');
      const tool = new EditExcelTool();
      const result = await tool.execute({ filePath, sheetName, operations });
      return result;
    } catch (error) {
      throw new Error(`编辑 Excel 表格失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// PDF 文档工具
// ============================================================================

export const createPDFTool = createTool({
  id: 'createPDF',
  description: `创建 PDF 文档。支持文本、列表、表格。`,
  inputSchema: z.object({
    filePath: z.string().describe('PDF 文件保存路径'),
    content: z.string().describe('PDF 内容（支持 Markdown）'),
    title: z.string().optional().describe('文档标题'),
  }),
  execute: async ({ filePath, content, title }) => {
    try {
      const { CreatePDFTool } = await import('./mastra/office/pdf.js');
      const tool = new CreatePDFTool();
      const result = await tool.execute({ filePath, content, title });
      return result;
    } catch (error) {
      throw new Error(`创建 PDF 文档失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// PPT 演示文稿工具
// ============================================================================

export const createPPTTool = createTool({
  id: 'createPPT',
  description: `创建 PowerPoint 演示文稿。从 Markdown 大纲生成 PPT。`,
  inputSchema: z.object({
    filePath: z.string().describe('PPT 文件保存路径'),
    outline: z.string().describe('PPT 大纲（Markdown 格式，# 为标题，## 为幻灯片标题）'),
    title: z.string().optional().describe('演示文稿标题'),
  }),
  execute: async ({ filePath, outline, title }) => {
    try {
      const { CreatePPTTool } = await import('./mastra/office/ppt.js');
      const tool = new CreatePPTTool();
      const result = await tool.execute({ filePath, outline, title });
      return result;
    } catch (error) {
      throw new Error(`创建 PPT 失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 图表工具
// ============================================================================

export const createChartTool = createTool({
  id: 'createChart',
  description: `创建图表（柱状图、折线图、饼图等）。生成图片文件。`,
  inputSchema: z.object({
    type: z.enum(['bar', 'line', 'pie', 'scatter', 'radar']).describe('图表类型'),
    data: z.object({
      labels: z.array(z.string()).optional().describe('标签'),
      datasets: z.array(z.object({
        label: z.string().describe('数据集名称'),
        data: z.array(z.number()).describe('数据'),
      })).describe('数据集'),
    }).describe('图表数据'),
    outputPath: z.string().describe('输出图片路径'),
    title: z.string().optional().describe('图表标题'),
  }),
  execute: async ({ type, data, outputPath, title }) => {
    try {
      const { CreateChartTool } = await import('./mastra/office/chart.js');
      const tool = new CreateChartTool();
      const result = await tool.execute({ type, data, outputPath, title });
      return result;
    } catch (error) {
      throw new Error(`创建图表失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 导出所有 Office 工具
// ============================================================================

export const officeTools = {
  readOffice: readOfficeTool,
  createWord: createWordTool,
  editWord: editWordTool,
  createExcel: createExcelTool,
  editExcel: editExcelTool,
  createPDF: createPDFTool,
  createPPT: createPPTTool,
  createChart: createChartTool,
};
