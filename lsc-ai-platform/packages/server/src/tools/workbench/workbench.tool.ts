import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ============================================================================
// 共享 Zod 定义
// ============================================================================

/** WorkbenchAction — 所有工具共用的 Action Zod schema */
const WorkbenchActionZod = z.object({
  type: z.enum(['chat', 'api', 'export', 'navigate', 'update', 'custom', 'shell']),
  label: z.string().optional().describe('按钮显示文字'),
  message: z.string().optional().describe('chat: 发送给AI的消息'),
  endpoint: z.string().optional().describe('api: API端点'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
  params: z.record(z.any()).optional(),
  format: z.enum(['excel', 'csv', 'pdf', 'json', 'png', 'svg']).optional(),
  filename: z.string().optional(),
  path: z.string().optional().describe('navigate: 目标路径'),
  targetId: z.string().optional().describe('update: 目标组件ID'),
  data: z.any().optional(),
  handler: z.string().optional().describe('custom: 处理器名称'),
  command: z.string().optional().describe('shell: 要执行的命令'),
});

/** Action 按钮条目 */
const ActionEntryZod = z.object({
  label: z.string().describe('按钮文字'),
  action: WorkbenchActionZod,
});

// ============================================================================
// 旧 blocks 格式的 Zod（workbench 通用工具向后兼容）
// ============================================================================

const SimpleContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('code'),
    language: z.string(),
    code: z.string(),
    filename: z.string().optional(),
    highlightLines: z.array(z.number()).optional(),
  }),
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))),
    title: z.string().optional(),
    sortable: z.boolean().optional(),
    filterable: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('chart'),
    chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'radar', 'custom']),
    option: z.record(z.any()),
    title: z.string().optional(),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]).optional(),
  }),
  z.object({
    type: z.literal('markdown'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('json'),
    data: z.any(),
    title: z.string().optional(),
    collapsed: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('image'),
    url: z.string(),
    alt: z.string().optional(),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]).optional(),
  }),
  z.object({
    type: z.literal('file'),
    path: z.string(),
    name: z.string(),
    size: z.number().optional(),
    downloadUrl: z.string().optional(),
  }),
]);

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

const ContentBlockSchema = z.union([SimpleContentBlockSchema, TabsBlockSchema]);

// ============================================================================
// 内部 helper：旧 blocks → 新 tabs 转换（从 schema-transformer.ts 搬入）
// ============================================================================

function convertBlocksToTabs(blocks: any[], schemaTitle?: string) {
  const tabs = blocks
    .map((block: any, index: number) => {
      let componentSchema: any = null;

      switch (block.type) {
        case 'code':
          if (block.code) {
            componentSchema = {
              type: 'CodeEditor',
              code: block.code,
              language: block.language || 'javascript',
              readOnly: true,
            };
          }
          break;

        case 'table':
          if (block.headers && block.rows) {
            componentSchema = {
              type: 'DataTable',
              title: block.title,
              columns: block.headers.map((h: string) => ({
                title: h,
                dataIndex: h,
                key: h,
              })),
              data: block.rows.map((row: any[], rowIndex: number) => {
                const obj: any = { key: rowIndex };
                block.headers.forEach((h: string, i: number) => {
                  obj[h] = row[i];
                });
                return obj;
              }),
            };
          }
          break;

        case 'chart': {
          const chartTypeMap: Record<string, string> = {
            line: 'LineChart',
            bar: 'BarChart',
            pie: 'PieChart',
            scatter: 'ScatterChart',
          };
          const chartType = chartTypeMap[block.chartType] || 'BarChart';

          if (block.chartType === 'pie' && block.option?.series?.[0]?.data) {
            componentSchema = {
              type: 'PieChart',
              data: block.option.series[0].data,
              title: block.title,
            };
          } else if (
            (chartType === 'BarChart' || chartType === 'LineChart') &&
            block.option?.xAxis &&
            block.option?.series
          ) {
            componentSchema = {
              type: chartType,
              xAxis: block.option.xAxis,
              series: block.option.series,
              title: block.title,
            };
          } else if (block.option) {
            componentSchema = {
              type: 'MarkdownView',
              content: `**${block.title || '图表'}**\n\n图表数据格式不完整，无法显示。`,
            };
          }
          break;
        }

        case 'markdown':
          if (block.content) {
            componentSchema = {
              type: 'MarkdownView',
              content: block.content,
            };
          }
          break;

        case 'json':
          if (block.data) {
            componentSchema = {
              type: 'CodeEditor',
              code: JSON.stringify(block.data, null, 2),
              language: 'json',
              readOnly: true,
            };
          }
          break;

        case 'tabs':
          // 嵌套 tabs → 展平为多个 tab
          return block.tabs.map((tab: any, tabIndex: number) => {
            let tabComponent: any;
            const c = tab.content;

            if (c?.type === 'code') {
              tabComponent = {
                type: 'CodeEditor',
                code: c.code,
                language: c.language || 'javascript',
                readOnly: true,
              };
            } else if (c?.type === 'markdown') {
              tabComponent = { type: 'MarkdownView', content: c.content };
            } else if (c?.type === 'table' && c.headers && c.rows) {
              tabComponent = {
                type: 'DataTable',
                title: c.title,
                columns: c.headers.map((h: string) => ({ title: h, dataIndex: h, key: h })),
                data: c.rows.map((row: any[], ri: number) => {
                  const obj: any = { key: ri };
                  c.headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
                  return obj;
                }),
              };
            } else {
              tabComponent = {
                type: 'Card',
                title: tab.label,
                children: [{ type: 'MarkdownView', content: JSON.stringify(c, null, 2) }],
              };
            }

            return {
              key: `tab-${index}-${tabIndex}`,
              title: tab.label,
              components: [tabComponent],
            };
          });

        default:
          componentSchema = {
            type: 'Card',
            title: '未知类型',
            children: [
              { type: 'Alert', alertType: 'warning', message: `不支持的block类型: ${block.type}` },
            ],
          };
      }

      if (!componentSchema) return null;

      return {
        key: `tab-${index}`,
        title: block.title || block.type || `Tab ${index + 1}`,
        components: [componentSchema],
      };
    })
    .flat()
    .filter((tab: any) => tab !== null);

  if (tabs.length === 0) {
    throw new Error('转换后没有有效的 tabs');
  }

  return {
    type: 'workbench' as const,
    title: schemaTitle || 'Workbench',
    tabs,
    defaultActiveKey: tabs[0]?.key,
  };
}

// ============================================================================
// showTable — 表格展示
// ============================================================================

export const showTableTool = createTool({
  id: 'showTable',
  description: '在 Workbench 中展示数据表格（带排序），可附加操作按钮',
  inputSchema: z.object({
    headers: z.array(z.string()).describe('表头'),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean()]))).describe('数据行'),
    title: z.string().optional().describe('表格标题'),
    sortable: z.boolean().default(true).describe('是否可排序'),
    actions: z.array(ActionEntryZod).optional().describe('操作按钮列表，如导出、深入分析等'),
  }),
  execute: async ({ headers, rows, title, sortable, actions }) => {
    const tabTitle = title || '数据表格';

    // headers/rows → columns/data
    const columns = headers.map((h) => ({ title: h, dataIndex: h, key: h }));
    const data = rows.map((row, rowIndex) => {
      const obj: Record<string, unknown> = { key: rowIndex };
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    const components: any[] = [
      { type: 'DataTable', title: tabTitle, columns, data, sortable },
    ];

    // 如果 AI 传了 actions，每个 action 生成一个 Button 组件
    if (actions && actions.length > 0) {
      for (const entry of actions) {
        components.push({
          type: 'Button',
          text: entry.label,
          variant: 'default',
          action: entry.action,
        });
      }
    }

    const schema = {
      type: 'workbench' as const,
      title: tabTitle,
      tabs: [{ key: 'tab-0', title: tabTitle, components }],
      defaultActiveKey: 'tab-0',
    };

    return { success: true, schema, message: '表格已展示' };
  },
});

// ============================================================================
// showChart — 图表展示
// ============================================================================

export const showChartTool = createTool({
  id: 'showChart',
  description: '在 Workbench 中展示图表（基于 ECharts），可附加操作按钮',
  inputSchema: z.object({
    chartType: z.enum(['line', 'bar', 'pie', 'scatter', 'radar', 'custom']),
    option: z.record(z.any()).describe('ECharts 配置对象'),
    title: z.string().optional().describe('图表标题'),
    actions: z.array(ActionEntryZod).optional().describe('操作按钮列表'),
  }),
  execute: async ({ chartType, option, title, actions }) => {
    const tabTitle = title || '图表';
    let chartComponent: any = null;

    // chartType → 前端组件类型映射
    const chartTypeMap: Record<string, string> = {
      bar: 'BarChart',
      line: 'LineChart',
      pie: 'PieChart',
      scatter: 'ScatterChart',
      radar: 'BarChart',   // 降级
      custom: 'BarChart',  // 降级
    };
    const componentType = chartTypeMap[chartType] || 'BarChart';

    if (chartType === 'pie' && option?.series?.[0]?.data) {
      // PieChart 特殊：从 option.series[0].data 提取
      chartComponent = {
        type: 'PieChart',
        data: option.series[0].data,
        title: tabTitle,
      };
    } else if (
      (componentType === 'BarChart' || componentType === 'LineChart') &&
      option?.xAxis &&
      option?.series
    ) {
      chartComponent = {
        type: componentType,
        xAxis: option.xAxis,
        series: option.series,
        title: tabTitle,
      };
    } else if (componentType === 'ScatterChart' && option?.series) {
      chartComponent = {
        type: 'ScatterChart',
        data: option.series?.[0]?.data || [],
        title: tabTitle,
      };
    } else {
      // 数据不完整 → 降级为 MarkdownView
      chartComponent = {
        type: 'MarkdownView',
        content: `**${tabTitle}**\n\n图表数据格式不完整，无法显示。\n\n\`\`\`json\n${JSON.stringify(option, null, 2)}\n\`\`\``,
      };
    }

    const components: any[] = [chartComponent];

    if (actions && actions.length > 0) {
      for (const entry of actions) {
        components.push({
          type: 'Button',
          text: entry.label,
          variant: 'default',
          action: entry.action,
        });
      }
    }

    const schema = {
      type: 'workbench' as const,
      title: tabTitle,
      tabs: [{ key: 'tab-0', title: tabTitle, components }],
      defaultActiveKey: 'tab-0',
    };

    return { success: true, schema, message: '图表已展示' };
  },
});

// ============================================================================
// showCode — 代码展示
// ============================================================================

export const showCodeTool = createTool({
  id: 'showCode',
  description: '在 Workbench 中展示代码块（带语法高亮），可附加操作按钮',
  inputSchema: z.object({
    code: z.string().describe('代码内容'),
    language: z.string().default('javascript').describe('编程语言'),
    filename: z.string().optional().describe('文件名'),
    title: z.string().optional().describe('标题'),
    actions: z.array(ActionEntryZod).optional().describe('操作按钮列表，如应用修复、在VS Code打开等'),
  }),
  execute: async ({ code, language, filename, title, actions }) => {
    const tabTitle = title || filename || '代码';

    const components: any[] = [
      {
        type: 'CodeEditor',
        code,
        language: language || 'javascript',
        readOnly: true,
      },
    ];

    if (actions && actions.length > 0) {
      for (const entry of actions) {
        components.push({
          type: 'Button',
          text: entry.label,
          variant: 'default',
          action: entry.action,
        });
      }
    }

    const schema = {
      type: 'workbench' as const,
      title: tabTitle,
      tabs: [{ key: 'tab-0', title: tabTitle, components }],
      defaultActiveKey: 'tab-0',
    };

    return { success: true, schema, message: '代码已展示' };
  },
});

// ============================================================================
// workbench — 通用工具（支持旧 blocks + 新 tabs 两种输入格式）
// ============================================================================

/**
 * 统一输入格式：同时支持旧 blocks 和新 tabs，但用单一 z.object 避免 z.union 生成 anyOf
 * （DeepSeek 要求工具 schema 必须为 type: "object"，z.union 生成的 anyOf 会被拒绝）
 */
const WorkbenchInput = z.object({
  title: z.string().optional().describe('Workbench 标题'),
  // ---- 新 tabs 格式（推荐）----
  tabs: z.array(z.object({
    title: z.string(),
    icon: z.string().optional(),
    components: z.array(z.object({
      type: z.string().describe('组件类型，如 DataTable, BarChart, CodeEditor, Button, Statistic, Terminal 等'),
    }).passthrough()),
  })).optional().describe('新格式：Tab 列表，每个 Tab 包含多个组件'),
  // ---- 旧 blocks 格式（兼容）----
  version: z.string().optional().describe('旧格式版本号，如 "1.0"'),
  description: z.string().optional(),
  blocks: z.array(ContentBlockSchema).optional().describe('旧格式：内容块列表'),
  metadata: z.record(z.any()).optional(),
});

export const workbenchTool = createTool({
  id: 'workbench',
  description: `创建 Workbench 可视化内容展示。支持两种格式：

**推荐：新 tabs 格式（支持完整交互）**
\`\`\`json
{
  "title": "销售分析",
  "tabs": [{
    "title": "数据表",
    "components": [
      {
        "type": "DataTable",
        "columns": [{ "title": "产品", "dataIndex": "产品", "key": "产品" }],
        "data": [{ "key": 0, "产品": "商品A" }]
      },
      {
        "type": "Button",
        "text": "导出 Excel",
        "variant": "default",
        "action": { "type": "export", "format": "excel", "filename": "销售数据.xlsx" }
      }
    ]
  }, {
    "title": "柱状图",
    "components": [{
      "type": "BarChart",
      "xAxis": ["1月","2月","3月"],
      "series": [{ "name": "销量", "data": [120, 200, 150] }],
      "title": "月度趋势"
    }]
  }]
}
\`\`\`

**支持的组件类型**: DataTable, BarChart, LineChart, PieChart, ScatterChart, CodeEditor, Terminal, Button, Statistic, Card, List, Form, Alert, Progress, MarkdownView, FileBrowser, FileViewer 等 30+ 种。

**支持的 Action 类型**: chat（发消息给AI）、export（导出文件）、api（调用接口）、navigate（页面跳转）、shell（执行命令）、update（更新组件）、custom（自定义）。

**兼容：旧 blocks 格式**
\`\`\`json
{
  "blocks": [{
    "type": "table",
    "headers": ["产品", "销量"],
    "rows": [["商品A", 100]]
  }]
}
\`\`\``,
  inputSchema: WorkbenchInput,
  execute: async (input) => {
    try {
      // 判断输入格式：有 blocks 字段 → 旧格式，有 tabs 字段 → 新格式
      if ('blocks' in input && Array.isArray(input.blocks)) {
        // 旧 blocks 格式 → 内部转换为 tabs 格式
        const schema = convertBlocksToTabs(input.blocks, input.title);
        return { success: true, schema, message: 'Workbench Schema 创建成功' };
      }

      if ('tabs' in input && Array.isArray(input.tabs)) {
        // 新 tabs 格式 → 直接构造 WorkbenchSchema 输出
        const tabs = input.tabs.map((tab: any, index: number) => ({
          key: `tab-${index}`,
          title: tab.title,
          icon: tab.icon,
          components: tab.components,
        }));

        const schema = {
          type: 'workbench' as const,
          title: input.title || 'Workbench',
          tabs,
          defaultActiveKey: tabs[0]?.key || 'tab-0',
        };

        return { success: true, schema, message: 'Workbench Schema 创建成功' };
      }

      throw new Error('输入格式无效：需要 blocks 或 tabs 字段');
    } catch (error) {
      throw new Error(`创建 Workbench Schema 失败: ${(error as Error).message}`);
    }
  },
});
