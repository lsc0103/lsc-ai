/**
 * 内嵌图表解析工具
 * 支持在 Markdown 中使用 @chart{...} 语法内嵌图表
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { generateChartImage, type ChartConfig, type ChartColorScheme, type ChartType } from './chart.js';

/**
 * 内嵌图表语法格式：
 * @chart{type:bar,title:"月度销售",labels:["1月","2月","3月"],datasets:[{label:"销售额",data:[100,200,300]}]}
 *
 * 或者简化格式（单数据系列）：
 * @chart{type:pie,title:"市场占比",labels:["A","B","C"],data:[30,50,20]}
 */

export interface ParsedChart {
  type: ChartType;
  title?: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
  }>;
  colorScheme?: ChartColorScheme;
  width?: number;
  height?: number;
}

/**
 * 解析内嵌图表语法
 */
export function parseChartSyntax(text: string): ParsedChart | null {
  try {
    // 尝试 JSON 解析
    const config = JSON.parse(text);

    if (!config.type || !config.labels) {
      return null;
    }

    // 处理简化格式（直接使用 data 数组）
    if (config.data && !config.datasets) {
      config.datasets = [{
        label: config.title || '数据',
        data: config.data,
      }];
    }

    if (!config.datasets || !Array.isArray(config.datasets)) {
      return null;
    }

    return {
      type: config.type as ChartType,
      title: config.title,
      labels: config.labels,
      datasets: config.datasets,
      colorScheme: config.colorScheme || config.color_scheme,
      width: config.width,
      height: config.height,
    };
  } catch {
    return null;
  }
}

/**
 * 从文本中提取所有内嵌图表
 * 返回图表配置和它们在文本中的位置
 */
export function extractCharts(text: string): Array<{
  match: string;
  index: number;
  chart: ParsedChart;
}> {
  const results: Array<{
    match: string;
    index: number;
    chart: ParsedChart;
  }> = [];

  // 匹配 @chart{...} 语法，支持嵌套大括号
  const regex = /@chart\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const chartText = `{${match[1]}}`;
    const parsed = parseChartSyntax(chartText);

    if (parsed) {
      results.push({
        match: match[0],
        index: match.index,
        chart: parsed,
      });
    }
  }

  return results;
}

/**
 * 处理文本中的内嵌图表，生成图片并替换为图片路径
 * 返回处理后的文本和生成的图片路径列表
 */
export async function processEmbeddedCharts(
  text: string,
  outputDir: string,
  colorScheme: ChartColorScheme = 'colorful'
): Promise<{
  processedText: string;
  chartImages: string[];
}> {
  const charts = extractCharts(text);

  if (charts.length === 0) {
    return { processedText: text, chartImages: [] };
  }

  // 确保输出目录存在
  await fs.mkdir(outputDir, { recursive: true });

  const chartImages: string[] = [];
  let processedText = text;
  let offset = 0; // 跟踪替换导致的偏移量

  for (let i = 0; i < charts.length; i++) {
    const chartItem = charts[i];
    if (!chartItem) continue;
    const { match, index, chart } = chartItem;

    // 生成图表图片
    const chartConfig: ChartConfig = {
      type: chart.type,
      title: chart.title,
      labels: chart.labels,
      datasets: chart.datasets,
      width: chart.width || 500,
      height: chart.height || 300,
    };

    const imageBuffer = await generateChartImage(chartConfig, chart.colorScheme || colorScheme);

    if (imageBuffer) {
      // 保存图片
      const imageName = `chart_${Date.now()}_${i}.png`;
      const imagePath = path.join(outputDir, imageName);
      await fs.writeFile(imagePath, imageBuffer);
      chartImages.push(imagePath);

      // 替换为 Markdown 图片语法
      const replacement = `![${chart.title || '图表'}](${imagePath})`;
      const actualIndex = index + offset;

      processedText =
        processedText.substring(0, actualIndex) +
        replacement +
        processedText.substring(actualIndex + match.length);

      // 更新偏移量
      offset += replacement.length - match.length;
    }
  }

  return { processedText, chartImages };
}

/**
 * 在系统临时目录创建图表
 */
export async function processChartsToTemp(
  text: string,
  colorScheme: ChartColorScheme = 'colorful'
): Promise<{
  processedText: string;
  chartImages: string[];
}> {
  const tempDir = path.join(os.tmpdir(), 'lsc-ai-charts');
  return processEmbeddedCharts(text, tempDir, colorScheme);
}
