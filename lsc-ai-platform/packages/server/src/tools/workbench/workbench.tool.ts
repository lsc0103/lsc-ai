import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { WorkbenchSchema } from './types.js';

/**
 * Zod Schema 定义
 * 简化版本：不支持递归的 tabs（避免循环引用）
 */
const SimpleContentBlockSchema = z.discriminatedUnion('type', [
  // 代码块
  z.object({
    type: z.literal('code'),
    language: z.string(),
    code: z.string(),
    filename: z.string().optional(),
    highlightLines: z.array(z.number()).optional(),
  }),
  // 表格块
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))),
    title: z.string().optional(),
    sortable: z.boolean().optional(),
    filterable: z.boolean().optional(),
  }),
  // 图表块
  z.object({
    type: z.literal('chart'),
    chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'radar', 'custom']),
    option: z.record(z.any()),
    title: z.string().optional(),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]).optional(),
  }),
  // Markdown 块
  z.object({
    type: z.literal('markdown'),
    content: z.string(),
  }),
  // JSON 块
  z.object({
    type: z.literal('json'),
    data: z.any(),
    title: z.string().optional(),
    collapsed: z.boolean().optional(),
  }),
  // 图片块
  z.object({
    type: z.literal('image'),
    url: z.string(),
    alt: z.string().optional(),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]).optional(),
  }),
  // 文件块
  z.object({
    type: z.literal('file'),
    path: z.string(),
    name: z.string(),
    size: z.number().optional(),
    downloadUrl: z.string().optional(),
  }),
]);

// 标签页块（使用简化的内容块）
const TabsBlockSchema = z.object({
  type: z.literal('tabs'),
  tabs: z.array(
    z.object({
      label: z.string(),
      content: SimpleContentBlockSchema,
    })
  ),
  defaultTab: z.number().optional(),
});

// 完整的内容块（包含tabs）
const ContentBlockSchema = z.union([SimpleContentBlockSchema, TabsBlockSchema]);

const WorkbenchSchemaInput = z.object({
  version: z.literal('1.0').default('1.0'),
  title: z.string().optional(),
  description: z.string().optional(),
  blocks: z.array(ContentBlockSchema),
  metadata: z
    .object({
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
});

/**
 * Workbench 工具
 * 用于生成和展示 Workbench Schema
 */
export const workbenchTool = createTool({
  id: 'workbench',
  description: `创建 Workbench 可视化内容展示。

**支持的内容类型**：
- **code**: 代码块（支持语法高亮）
- **table**: 数据表格（支持排序、筛选）
- **chart**: 图表（基于 ECharts）
- **markdown**: Markdown 渲染
- **json**: JSON 数据查看器
- **image**: 图片展示
- **file**: 文件下载链接
- **tabs**: 多标签页展示

**使用示例**：

1. **展示代码**：
\`\`\`json
{
  "blocks": [{
    "type": "code",
    "language": "javascript",
    "code": "console.log('Hello World');",
    "filename": "example.js"
  }]
}
\`\`\`

2. **展示数据表格**：
\`\`\`json
{
  "title": "销售数据",
  "blocks": [{
    "type": "table",
    "headers": ["产品", "销量", "金额"],
    "rows": [
      ["商品A", 100, 5000],
      ["商品B", 200, 10000]
    ]
  }]
}
\`\`\`

3. **展示图表**：
\`\`\`json
{
  "blocks": [{
    "type": "chart",
    "chartType": "bar",
    "title": "月度销售趋势",
    "option": {
      "xAxis": { "type": "category", "data": ["1月", "2月", "3月"] },
      "yAxis": { "type": "value" },
      "series": [{ "data": [120, 200, 150], "type": "bar" }]
    }
  }]
}
\`\`\`

4. **多标签页展示**：
\`\`\`json
{
  "blocks": [{
    "type": "tabs",
    "tabs": [
      {
        "label": "代码",
        "content": { "type": "code", "language": "python", "code": "print('tab1')" }
      },
      {
        "label": "数据",
        "content": { "type": "table", "headers": ["A", "B"], "rows": [[1, 2]] }
      }
    ]
  }]
}
\`\`\`

**重要提示**：
- 生成 Workbench Schema 后，会自动通过 WebSocket 推送到前端展示
- 建议为复杂数据使用多标签页，提升用户体验
- 图表使用 ECharts 配置格式`,
  inputSchema: WorkbenchSchemaInput,
  execute: async (schema) => {
    try {
      // 验证 schema
      const validatedSchema = {
        version: '1.0' as const,
        ...schema,
      } as WorkbenchSchema;

      // 这里可以添加 WebSocket 推送逻辑
      // 暂时返回 schema，由 Agent 或 Gateway 负责推送

      return {
        success: true,
        schema: validatedSchema,
        message: 'Workbench Schema 创建成功',
      };
    } catch (error) {
      throw new Error(`创建 Workbench Schema 失败: ${(error as Error).message}`);
    }
  },
});

/**
 * 快捷工具：展示代码
 */
export const showCodeTool = createTool({
  id: 'showCode',
  description: '在 Workbench 中展示代码块（带语法高亮）',
  inputSchema: z.object({
    code: z.string().describe('代码内容'),
    language: z.string().default('javascript').describe('编程语言'),
    filename: z.string().optional().describe('文件名'),
    title: z.string().optional().describe('标题'),
  }),
  execute: async ({ code, language, filename, title }) => {
    const schema: WorkbenchSchema = {
      version: '1.0',
      title,
      blocks: [
        {
          type: 'code',
          language: language || 'javascript',
          code,
          filename,
        },
      ],
    };

    return {
      success: true,
      schema,
      message: '代码已展示',
    };
  },
});

/**
 * 快捷工具：展示表格
 */
export const showTableTool = createTool({
  id: 'showTable',
  description: '在 Workbench 中展示数据表格',
  inputSchema: z.object({
    headers: z.array(z.string()).describe('表头'),
    rows: z
      .array(z.array(z.union([z.string(), z.number(), z.boolean()])))
      .describe('数据行'),
    title: z.string().optional().describe('表格标题'),
    sortable: z.boolean().default(true).describe('是否可排序'),
  }),
  execute: async ({ headers, rows, title, sortable }) => {
    const schema: WorkbenchSchema = {
      version: '1.0',
      title,
      blocks: [
        {
          type: 'table',
          headers,
          rows,
          title,
          sortable,
        },
      ],
    };

    return {
      success: true,
      schema,
      message: '表格已展示',
    };
  },
});

/**
 * 快捷工具：展示图表
 */
export const showChartTool = createTool({
  id: 'showChart',
  description: '在 Workbench 中展示图表（基于 ECharts）',
  inputSchema: z.object({
    chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'radar', 'custom']),
    option: z.record(z.any()).describe('ECharts 配置对象'),
    title: z.string().optional().describe('图表标题'),
  }),
  execute: async ({ chartType, option, title }) => {
    const schema: WorkbenchSchema = {
      version: '1.0',
      title,
      blocks: [
        {
          type: 'chart',
          chartType,
          option,
          title,
        },
      ],
    };

    return {
      success: true,
      schema,
      message: '图表已展示',
    };
  },
});
