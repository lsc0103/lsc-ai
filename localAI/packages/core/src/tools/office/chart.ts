/**
 * 图表生成工具
 * 使用 QuickChart API 生成图表图片
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult } from '../types.js';

// 延迟加载 QuickChart
let QuickChartModule: any = null;
async function getQuickChart() {
  if (!QuickChartModule) {
    try {
      const qc = await import('quickchart-js');
      QuickChartModule = qc.default || qc;
    } catch {
      return null;
    }
  }
  return QuickChartModule;
}

/**
 * 图表类型定义
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble';

/**
 * 图表数据集
 */
export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  fill?: boolean;
}

/**
 * 图表配置
 */
export interface ChartConfig {
  type: ChartType;
  labels: string[];
  datasets: ChartDataset[];
  title?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  showLegend?: boolean;
  showGrid?: boolean;
}

/**
 * 预设配色方案 - 专业图表风格
 */
export const CHART_COLORS = {
  // 商务蓝色系
  business: [
    'rgba(37, 99, 235, 0.8)',   // 蓝
    'rgba(59, 130, 246, 0.8)',  // 浅蓝
    'rgba(96, 165, 250, 0.8)',  // 更浅蓝
    'rgba(147, 197, 253, 0.8)', // 淡蓝
    'rgba(191, 219, 254, 0.8)', // 极淡蓝
  ],
  // 多彩配色
  colorful: [
    'rgba(37, 99, 235, 0.8)',   // 蓝
    'rgba(16, 185, 129, 0.8)',  // 绿
    'rgba(245, 158, 11, 0.8)',  // 橙
    'rgba(239, 68, 68, 0.8)',   // 红
    'rgba(139, 92, 246, 0.8)',  // 紫
    'rgba(236, 72, 153, 0.8)',  // 粉
    'rgba(20, 184, 166, 0.8)',  // 青
    'rgba(234, 179, 8, 0.8)',   // 黄
  ],
  // 财务绿色系
  finance: [
    'rgba(5, 150, 105, 0.8)',   // 深绿
    'rgba(16, 185, 129, 0.8)',  // 绿
    'rgba(52, 211, 153, 0.8)',  // 浅绿
    'rgba(110, 231, 183, 0.8)', // 淡绿
    'rgba(167, 243, 208, 0.8)', // 极淡绿
  ],
  // 暖色系
  warm: [
    'rgba(234, 88, 12, 0.8)',   // 橙
    'rgba(249, 115, 22, 0.8)',  // 浅橙
    'rgba(251, 146, 60, 0.8)',  // 淡橙
    'rgba(253, 186, 116, 0.8)', // 极淡橙
    'rgba(254, 215, 170, 0.8)', // 米色
  ],
  // 优雅紫色系
  elegant: [
    'rgba(124, 58, 237, 0.8)',  // 紫
    'rgba(139, 92, 246, 0.8)',  // 浅紫
    'rgba(167, 139, 250, 0.8)', // 淡紫
    'rgba(196, 181, 253, 0.8)', // 极淡紫
    'rgba(221, 214, 254, 0.8)', // 粉紫
  ],
};

export type ChartColorScheme = keyof typeof CHART_COLORS;

/**
 * 生成图表图片
 */
export async function generateChartImage(
  config: ChartConfig,
  colorScheme: ChartColorScheme = 'colorful'
): Promise<Buffer | null> {
  const QuickChart = await getQuickChart();
  if (!QuickChart) {
    console.error('QuickChart 不可用');
    return null;
  }

  const colors = CHART_COLORS[colorScheme] || CHART_COLORS.colorful;

  // 为数据集分配颜色
  const datasetsWithColors = config.datasets.map((ds, index) => {
    const color = colors[index % colors.length];
    const borderColor = color.replace('0.8)', '1)');

    // 饼图和环形图需要为每个数据点分配颜色
    if (config.type === 'pie' || config.type === 'doughnut' || config.type === 'polarArea') {
      return {
        ...ds,
        backgroundColor: ds.backgroundColor || config.labels.map((_, i) => colors[i % colors.length]),
        borderColor: ds.borderColor || '#ffffff',
        borderWidth: 2,
      };
    }

    // 雷达图和极坐标图默认填充
    const needsFill = ['radar', 'polarArea'].includes(config.type as string);
    return {
      ...ds,
      backgroundColor: ds.backgroundColor || color,
      borderColor: ds.borderColor || borderColor,
      borderWidth: 2,
      fill: ds.fill ?? needsFill,
    };
  });

  // 构建 Chart.js 配置
  const chartConfig = {
    type: config.type,
    data: {
      labels: config.labels,
      datasets: datasetsWithColors,
    },
    options: {
      responsive: true,
      plugins: {
        title: config.title
          ? {
              display: true,
              text: config.title,
              font: { size: 16, weight: 'bold' },
              padding: { top: 10, bottom: 20 },
            }
          : { display: false },
        legend: {
          display: config.showLegend !== false,
          position: 'bottom' as const,
          labels: {
            font: { size: 12 },
            padding: 15,
          },
        },
      },
      scales: (['bar', 'line', 'scatter', 'bubble'] as ChartType[]).includes(config.type)
        ? {
            x: {
              grid: { display: config.showGrid !== false },
              ticks: { font: { size: 11 } },
            },
            y: {
              grid: { display: config.showGrid !== false },
              ticks: { font: { size: 11 } },
              beginAtZero: true,
            },
          }
        : undefined,
    },
  };

  try {
    const chart = new QuickChart();
    chart.setConfig(chartConfig);
    chart.setWidth(config.width || 600);
    chart.setHeight(config.height || 400);
    if (config.backgroundColor) {
      chart.setBackgroundColor(config.backgroundColor);
    } else {
      chart.setBackgroundColor('white');
    }

    // 获取图表图片
    const imageBuffer = await chart.toBinary();
    return Buffer.from(imageBuffer);
  } catch (error) {
    console.error('生成图表失败:', error);
    return null;
  }
}

/**
 * 图表生成工具
 */
export class CreateChartTool implements Tool {
  definition = {
    name: 'createChart',
    description: `生成专业的数据图表图片 (.png)。

**支持的图表类型**：
- bar: 柱状图 - 适合比较类别数据
- line: 折线图 - 适合展示趋势变化
- pie: 饼图 - 适合展示占比分布
- doughnut: 环形图 - 类似饼图，中心空心
- radar: 雷达图 - 适合多维度对比
- polarArea: 极坐标区域图
- scatter: 散点图 - 适合展示相关性
- bubble: 气泡图 - 散点图+大小维度

**配色方案**：
- colorful: 多彩配色（默认）
- business: 商务蓝色系
- finance: 财务绿色系
- warm: 暖色系
- elegant: 优雅紫色系

**示例**：
\`\`\`json
{
  "file_path": "sales_chart.png",
  "type": "bar",
  "title": "月度销售数据",
  "labels": ["1月", "2月", "3月", "4月"],
  "datasets": [
    {"label": "销售额", "data": [12000, 15000, 18000, 22000]},
    {"label": "成本", "data": [8000, 9000, 11000, 13000]}
  ]
}
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要保存的图片路径（应以 .png 结尾）',
        },
        type: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'],
          description: '图表类型',
        },
        title: {
          type: 'string',
          description: '图表标题',
        },
        labels: {
          type: 'array',
          description: 'X轴标签数组（如月份、类别名称）',
        },
        datasets: {
          type: 'array',
          description: '数据集数组，每个数据集包含 label（系列名称）和 data（数值数组）',
        },
        color_scheme: {
          type: 'string',
          enum: ['colorful', 'business', 'finance', 'warm', 'elegant'],
          description: '配色方案',
        },
        width: {
          type: 'number',
          description: '图表宽度（像素），默认 600',
        },
        height: {
          type: 'number',
          description: '图表高度（像素），默认 400',
        },
        show_legend: {
          type: 'boolean',
          description: '是否显示图例，默认 true',
        },
        show_grid: {
          type: 'boolean',
          description: '是否显示网格线，默认 true',
        },
      },
      required: ['file_path', 'type', 'labels', 'datasets'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const type = args.type as ChartType;
    const title = args.title as string | undefined;
    const labels = args.labels as string[];
    const datasets = args.datasets as ChartDataset[];
    const colorScheme = (args.color_scheme as ChartColorScheme) || 'colorful';
    const width = args.width as number | undefined;
    const height = args.height as number | undefined;
    const showLegend = args.show_legend as boolean | undefined;
    const showGrid = args.show_grid as boolean | undefined;

    // 验证参数
    if (!filePath || !type || !labels || !datasets) {
      return {
        success: false,
        output: '',
        error: '缺少必需参数：file_path, type, labels, datasets',
      };
    }

    if (!['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter', 'bubble'].includes(type)) {
      return {
        success: false,
        output: '',
        error: `不支持的图表类型: ${type}`,
      };
    }

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // 确保目录存在
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // 生成图表
      const config: ChartConfig = {
        type,
        title,
        labels,
        datasets,
        width,
        height,
        showLegend,
        showGrid,
      };

      const imageBuffer = await generateChartImage(config, colorScheme);

      if (!imageBuffer) {
        return {
          success: false,
          output: '',
          error: '图表生成失败，请检查 quickchart-js 是否已安装',
        };
      }

      // 保存图片
      await fs.writeFile(absolutePath, imageBuffer);

      return {
        success: true,
        output: `图表已生成: ${absolutePath}\n类型: ${type}\n配色: ${colorScheme}\n尺寸: ${width || 600}x${height || 400}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `创建图表失败: ${(error as Error).message}`,
      };
    }
  }
}
