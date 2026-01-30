import * as path from 'path';
import * as fs from 'fs/promises';
import type { Tool, ToolResult } from '../types.js';
import { processChartsToTemp } from './chartEmbed.js';

// 动态导入 pptxgenjs 以解决 ESM 兼容性问题
async function createPptx(): Promise<any> {
  const pptxgenjs = await import('pptxgenjs');
  // pptxgenjs 的默认导出是类，但 TypeScript 类型定义有问题
  const PptxGenJS = pptxgenjs.default as any;
  return new PptxGenJS();
}

/**
 * 预设配色方案 - 专业设计风格
 */
const COLOR_SCHEMES = {
  // 商务蓝 - 稳重专业
  business: {
    primary: '2563EB',      // 主色-蓝
    secondary: '1E40AF',    // 深蓝
    accent: '3B82F6',       // 强调色
    background: 'F8FAFC',   // 浅灰背景
    text: '1E293B',         // 深色文字
    textLight: '64748B',    // 浅色文字
  },
  // 科技绿 - 现代创新
  tech: {
    primary: '10B981',
    secondary: '059669',
    accent: '34D399',
    background: 'F0FDF4',
    text: '064E3B',
    textLight: '6B7280',
  },
  // 优雅紫 - 创意设计
  creative: {
    primary: '8B5CF6',
    secondary: '6D28D9',
    accent: 'A78BFA',
    background: 'FAF5FF',
    text: '4C1D95',
    textLight: '7C3AED',
  },
  // 暖橙 - 活力动感
  warm: {
    primary: 'F97316',
    secondary: 'EA580C',
    accent: 'FB923C',
    background: 'FFF7ED',
    text: '9A3412',
    textLight: 'C2410C',
  },
  // 极简黑白 - 简约大气
  minimal: {
    primary: '18181B',
    secondary: '3F3F46',
    accent: '52525B',
    background: 'FFFFFF',
    text: '18181B',
    textLight: '71717A',
  },
  // 深色主题 - 高端商务
  dark: {
    primary: '60A5FA',
    secondary: '3B82F6',
    accent: '93C5FD',
    background: '1E293B',
    text: 'F8FAFC',
    textLight: 'CBD5E1',
  },
};

/**
 * 原生图表数据系列
 */
interface NativeChartSeries {
  name: string;
  labels: string[];
  values: number[];
}

/**
 * 原生图表定义
 */
interface NativeChartDef {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'area' | 'scatter';
  title?: string;
  data: NativeChartSeries[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

/**
 * 幻灯片内容类型
 */
interface SlideContent {
  /** 幻灯片标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 正文内容（支持多段） */
  body?: string[];
  /** 项目符号列表 */
  bullets?: string[];
  /** 表格 */
  table?: {
    headers?: string[];
    rows: string[][];
  };
  /** 图片 */
  images?: Array<{
    path: string;           // 图片路径
    x?: string | number;    // X位置
    y?: string | number;    // Y位置
    w?: string | number;    // 宽度
    h?: string | number;    // 高度
    sizing?: 'contain' | 'cover' | 'crop';
  }>;
  /** 原生图表（可在 PowerPoint 中编辑数据） */
  nativeCharts?: NativeChartDef[];
  /** 背景颜色（十六进制） */
  backgroundColor?: string;
  /** 背景图片 */
  backgroundImage?: string;
  /** 布局类型 */
  layout?: 'title' | 'titleAndContent' | 'blank' | 'twoContent' | 'imageLeft' | 'imageRight';
}

type ColorSchemeKey = keyof typeof COLOR_SCHEMES;

/**
 * 解析 Markdown 为幻灯片数组
 * 每个 ## 标题作为一张新幻灯片
 * 支持图片语法: ![alt](path)
 */
function parseMarkdownToSlides(markdown: string): { title?: string; slides: SlideContent[] } {
  const lines = markdown.split('\n');
  const slides: SlideContent[] = [];
  let mainTitle: string | undefined;
  let currentSlide: SlideContent | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // # 主标题
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      mainTitle = h1Match[1];
      continue;
    }

    // ## 幻灯片标题
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      if (currentSlide) {
        slides.push(currentSlide);
      }
      currentSlide = { title: h2Match[1], bullets: [] };
      continue;
    }

    // ### 副标题
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match && currentSlide) {
      currentSlide.subtitle = h3Match[1];
      continue;
    }

    // 图片语法: ![alt](path)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch && currentSlide) {
      if (!currentSlide.images) currentSlide.images = [];
      currentSlide.images.push({
        path: imageMatch[2],
        w: '40%',
        h: '40%',
        x: '30%',
        y: '35%',
      });
      continue;
    }

    // 原生图表语法: @nativechart{...}
    const nativeChartMatch = trimmed.match(/^@nativechart(\{.*\})$/);
    if (nativeChartMatch && currentSlide) {
      try {
        const chartDef = JSON.parse(nativeChartMatch[1]) as NativeChartDef;
        if (!currentSlide.nativeCharts) currentSlide.nativeCharts = [];
        currentSlide.nativeCharts.push(chartDef);
      } catch {
        // 解析失败，忽略
      }
      continue;
    }

    // 列表项
    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch && currentSlide) {
      if (!currentSlide.bullets) currentSlide.bullets = [];
      currentSlide.bullets.push(listMatch[1]);
      continue;
    }

    // 缩进列表项
    const indentedMatch = line.match(/^\s+[-*+]\s+(.+)$/);
    if (indentedMatch && currentSlide) {
      if (!currentSlide.bullets) currentSlide.bullets = [];
      currentSlide.bullets.push(`  ${indentedMatch[1]}`);
      continue;
    }

    // 有序列表
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch && currentSlide) {
      if (!currentSlide.bullets) currentSlide.bullets = [];
      currentSlide.bullets.push(`${orderedMatch[1]}. ${orderedMatch[2]}`);
      continue;
    }

    // 普通段落
    if (currentSlide && trimmed) {
      if (!currentSlide.body) currentSlide.body = [];
      currentSlide.body.push(trimmed);
    }
  }

  // 添加最后一张幻灯片
  if (currentSlide) {
    slides.push(currentSlide);
  }

  return { title: mainTitle, slides };
}

/**
 * PowerPoint 创建工具
 */
export class CreatePPTTool implements Tool {
  definition = {
    name: 'createPPT',
    description: `创建精美的 PowerPoint 演示文稿 (.pptx)。支持配色方案、图片、图表插入、原生图表、专业布局。

**Markdown 格式说明**：
- # 一级标题: 首页大标题
- ## 二级标题: 每个 ## 创建一张新幻灯片
- - 列表项: 幻灯片的要点内容
- ![描述](图片路径): 插入图片
- @chart{...}: 内嵌图表（自动生成为图片）
- @nativechart{...}: 原生图表（可在 PowerPoint 中编辑数据）

**内嵌图表语法**（生成为图片）：
@chart{"type":"pie","title":"市场份额","labels":["产品A","产品B","产品C"],"data":[45,35,20]}

**原生图表语法**（可编辑，推荐）：
@nativechart{"type":"bar","title":"季度销售","data":[{"name":"销售额","labels":["Q1","Q2","Q3","Q4"],"values":[100,150,120,200]}]}

支持的原生图表类型：bar(柱状图)、line(折线图)、pie(饼图)、doughnut(环形图)、area(面积图)

**配色方案**：
- business: 商务蓝（默认）- 稳重专业
- tech: 科技绿 - 现代创新
- creative: 优雅紫 - 创意设计
- warm: 暖橙 - 活力动感
- minimal: 极简黑白 - 简约大气
- dark: 深色主题 - 高端商务

**示例**：
\`\`\`markdown
# 2024年度报告

## 业绩概览
- 营收增长 35%
- 用户突破 100 万
- 满意度达 95%

## 数据分析
@nativechart{"type":"bar","title":"季度对比","data":[{"name":"2023","labels":["Q1","Q2","Q3","Q4"],"values":[80,100,90,110]},{"name":"2024","labels":["Q1","Q2","Q3","Q4"],"values":[100,130,120,150]}]}

## 未来规划
- 拓展海外市场
- 推出新产品线
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要创建的文件路径（应以 .pptx 结尾）',
        },
        markdown: {
          type: 'string',
          description: '【必需】Markdown 格式的幻灯片内容。支持标题、列表、图片。',
        },
        theme: {
          type: 'string',
          description: '配色方案：business(商务蓝)、tech(科技绿)、creative(优雅紫)、warm(暖橙)、minimal(极简)、dark(深色)',
          enum: ['business', 'tech', 'creative', 'warm', 'minimal', 'dark'],
        },
        title: {
          type: 'string',
          description: '演示文稿标题（可选，会覆盖 markdown 中的 # 标题）',
        },
        author: {
          type: 'string',
          description: '作者名称（可选）',
        },
        slides: {
          type: 'array',
          description: '结构化幻灯片数组（高级用法，一般使用 markdown 即可）',
        },
      },
      required: ['file_path', 'markdown'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    let markdown = args.markdown as string | undefined;
    let title = args.title as string | undefined;
    const author = args.author as string | undefined;
    const themeName = (args.theme as ColorSchemeKey) || 'business';
    let slides = args.slides as SlideContent[] | undefined;

    // 获取配色方案
    const theme = COLOR_SCHEMES[themeName] || COLOR_SCHEMES.business;

    // 图表颜色方案映射
    const chartColorMap: Record<string, 'colorful' | 'business' | 'finance' | 'warm' | 'elegant'> = {
      business: 'business',
      tech: 'finance',
      creative: 'elegant',
      warm: 'warm',
      minimal: 'business',
      dark: 'colorful',
    };

    // 处理内嵌图表（如果 markdown 中包含 @chart{...} 语法）
    let chartImages: string[] = [];
    if (markdown && markdown.includes('@chart{')) {
      try {
        const result = await processChartsToTemp(markdown, chartColorMap[themeName] || 'colorful');
        markdown = result.processedText;
        chartImages = result.chartImages;
      } catch {
        // 图表处理失败，继续使用原始 markdown
      }
    }

    // 解析 Markdown
    if (markdown) {
      const parsed = parseMarkdownToSlides(markdown);
      if (parsed.title) title = parsed.title;
      slides = parsed.slides;
    }

    if (!slides || slides.length === 0) {
      return {
        success: false,
        output: '',
        error: 'markdown 内容必须包含至少一个 ## 二级标题来创建幻灯片。格式示例：\n## 第一页标题\n- 要点1\n- 要点2\n\n## 第二页标题\n- 内容',
      };
    }

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // 获取文件所在目录用于解析相对图片路径
      const baseDir = path.dirname(absolutePath);

      const pptx = await createPptx();

      // 设置元数据
      if (title) pptx.title = title;
      if (author) pptx.author = author;
      pptx.company = 'LSC AI';

      // 如果有标题，创建标题页
      if (title) {
        const titleSlide = pptx.addSlide();
        // 设置背景
        titleSlide.background = { color: theme.background };

        // 添加装饰性色块（左侧强调条）
        titleSlide.addShape('rect', {
          x: 0,
          y: 0,
          w: 0.15,
          h: '100%',
          fill: { color: theme.primary },
        });

        // 添加底部装饰线
        titleSlide.addShape('rect', {
          x: '10%',
          y: '70%',
          w: '80%',
          h: 0.02,
          fill: { color: theme.accent },
        });

        // 主标题
        titleSlide.addText(title, {
          x: '10%',
          y: '35%',
          w: '80%',
          h: 1.2,
          fontSize: 44,
          bold: true,
          align: 'center',
          color: theme.text,
          fontFace: 'Microsoft YaHei',
        });

        // 副标题/作者
        if (author) {
          titleSlide.addText(author, {
            x: '10%',
            y: '55%',
            w: '80%',
            h: 0.6,
            fontSize: 20,
            align: 'center',
            color: theme.textLight,
            fontFace: 'Microsoft YaHei',
          });
        }

        // 日期
        const dateStr = new Date().toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        titleSlide.addText(dateStr, {
          x: '10%',
          y: '75%',
          w: '80%',
          h: 0.4,
          fontSize: 14,
          align: 'center',
          color: theme.textLight,
          fontFace: 'Microsoft YaHei',
        });
      }

      // 添加内容幻灯片
      for (let slideIndex = 0; slideIndex < slides.length; slideIndex++) {
        const slideContent = slides[slideIndex];
        const slide = pptx.addSlide();

        // 设置背景色
        const bgColor = slideContent.backgroundColor?.replace('#', '') || theme.background;
        slide.background = { color: bgColor };

        // 添加顶部装饰条
        slide.addShape('rect', {
          x: 0,
          y: 0,
          w: '100%',
          h: 0.08,
          fill: { color: theme.primary },
        });

        // 添加左侧装饰条
        slide.addShape('rect', {
          x: 0,
          y: 0.08,
          w: 0.08,
          h: '100%',
          fill: { color: theme.accent },
        });

        // 添加页码
        slide.addText(`${slideIndex + 1}`, {
          x: '92%',
          y: '92%',
          w: 0.5,
          h: 0.3,
          fontSize: 12,
          color: theme.textLight,
          align: 'right',
        });

        let yPosition = 0.4;
        const hasImages = slideContent.images && slideContent.images.length > 0;
        const contentWidth = hasImages ? '55%' : '90%';

        // 添加标题
        if (slideContent.title) {
          slide.addText(slideContent.title, {
            x: 0.5,
            y: yPosition,
            w: '90%',
            h: 0.9,
            fontSize: 32,
            bold: true,
            color: theme.primary,
            fontFace: 'Microsoft YaHei',
          });
          yPosition += 1.1;

          // 标题下装饰线
          slide.addShape('rect', {
            x: 0.5,
            y: yPosition - 0.15,
            w: 1.5,
            h: 0.04,
            fill: { color: theme.accent },
          });
        }

        // 添加副标题
        if (slideContent.subtitle) {
          slide.addText(slideContent.subtitle, {
            x: 0.5,
            y: yPosition,
            w: contentWidth,
            h: 0.5,
            fontSize: 18,
            color: theme.textLight,
            fontFace: 'Microsoft YaHei',
          });
          yPosition += 0.7;
        }

        // 添加正文
        if (slideContent.body && slideContent.body.length > 0) {
          for (const paragraph of slideContent.body) {
            slide.addText(paragraph, {
              x: 0.5,
              y: yPosition,
              w: contentWidth,
              h: 0.5,
              fontSize: 16,
              color: theme.text,
              fontFace: 'Microsoft YaHei',
            });
            yPosition += 0.6;
          }
        }

        // 添加项目符号列表
        if (slideContent.bullets && slideContent.bullets.length > 0) {
          const bulletText = slideContent.bullets.map((text) => ({
            text,
            options: {
              bullet: { type: 'bullet', color: theme.primary },
              fontSize: 18,
              color: theme.text,
              fontFace: 'Microsoft YaHei',
              paraSpaceBefore: 8,
              paraSpaceAfter: 4,
            },
          }));

          slide.addText(bulletText as any, {
            x: 0.5,
            y: yPosition,
            w: contentWidth,
            h: Math.min(slideContent.bullets.length * 0.55, 4),
            valign: 'top',
          });
          yPosition += slideContent.bullets.length * 0.55 + 0.3;
        }

        // 添加图片
        if (slideContent.images && slideContent.images.length > 0) {
          for (const img of slideContent.images) {
            try {
              // 解析图片路径
              let imgPath = img.path;
              if (!path.isAbsolute(imgPath)) {
                imgPath = path.resolve(baseDir, imgPath);
              }

              // 检查图片文件是否存在
              await fs.access(imgPath);

              // 根据是否有文本内容调整图片位置
              const hasTextContent = slideContent.bullets?.length || slideContent.body?.length;
              const imgX = hasTextContent ? '58%' : (img.x || '25%');
              const imgY = hasTextContent ? '25%' : (img.y || '25%');
              const imgW = hasTextContent ? '38%' : (img.w || '50%');
              const imgH = hasTextContent ? '55%' : (img.h || '50%');

              slide.addImage({
                path: imgPath,
                x: imgX,
                y: imgY,
                w: imgW,
                h: imgH,
                sizing: { type: img.sizing || 'contain', w: imgW, h: imgH },
              });

              // 添加图片边框装饰
              slide.addShape('rect', {
                x: imgX,
                y: imgY,
                w: imgW,
                h: imgH,
                fill: { type: 'none' },
                line: { color: theme.accent, pt: 2 },
              });
            } catch {
              // 图片加载失败时显示占位符
              const placeholderX = '58%';
              const placeholderY = '25%';
              slide.addShape('rect', {
                x: placeholderX,
                y: placeholderY,
                w: '38%',
                h: '55%',
                fill: { color: 'F3F4F6' },
                line: { color: theme.textLight, pt: 1, dashType: 'dash' },
              });
              slide.addText(`[图片: ${img.path}]`, {
                x: placeholderX,
                y: '48%',
                w: '38%',
                h: 0.5,
                fontSize: 12,
                color: theme.textLight,
                align: 'center',
              });
            }
          }
        }

        // 添加表格
        if (slideContent.table) {
          const tableData: any[][] = [];

          // 表头样式
          if (slideContent.table.headers) {
            tableData.push(
              slideContent.table.headers.map((h) => ({
                text: h,
                options: {
                  bold: true,
                  color: 'FFFFFF',
                  fill: { color: theme.primary },
                  align: 'center',
                  fontFace: 'Microsoft YaHei',
                },
              }))
            );
          }

          // 数据行样式（斑马纹）
          slideContent.table.rows.forEach((row, rowIdx) => {
            tableData.push(
              row.map((cell) => ({
                text: cell,
                options: {
                  color: theme.text,
                  fill: { color: rowIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
                  fontFace: 'Microsoft YaHei',
                },
              }))
            );
          });

          slide.addTable(tableData, {
            x: 0.5,
            y: yPosition,
            w: 9,
            fontSize: 13,
            border: { pt: 0.5, color: theme.accent },
            align: 'left',
            valign: 'middle',
          });
        }

        // 添加原生图表
        if (slideContent.nativeCharts && slideContent.nativeCharts.length > 0) {
          // PPT 标准尺寸: 10" x 7.5"
          const slideWidth = 10;
          const slideHeight = 7.5;
          const margin = 0.5;
          const bottomReserve = 0.6; // 底部预留空间（页码等）

          for (const chartDef of slideContent.nativeCharts) {
            try {
              // 映射图表类型到 pptxgenjs 类型
              const chartTypeMap: Record<string, string> = {
                bar: 'bar',
                line: 'line',
                pie: 'pie',
                doughnut: 'doughnut',
                area: 'area',
                scatter: 'scatter',
              };

              const chartType = chartTypeMap[chartDef.type] || 'bar';

              // 构建图表数据
              const chartData = chartDef.data.map((series) => ({
                name: series.name,
                labels: series.labels,
                values: series.values,
              }));

              // 计算可用空间
              const availableHeight = slideHeight - yPosition - bottomReserve;
              const availableWidth = slideWidth - 2 * margin;

              // 智能计算图表尺寸
              const isPieType = ['pie', 'doughnut'].includes(chartDef.type);

              // 饼图需要更多底部空间给图例，所以限制更严格
              const maxChartH = isPieType ? 3.2 : 3.5;
              const maxChartW = isPieType ? 4.5 : 8;

              let chartW = chartDef.w ?? Math.min(availableWidth, maxChartW);
              let chartH = chartDef.h ?? Math.min(availableHeight - 0.3, maxChartH);

              // 确保图表不超出边界，最小高度 2 英寸
              chartW = Math.min(chartW, availableWidth);
              chartH = Math.min(chartH, Math.max(availableHeight - 0.3, 2));

              // 计算居中位置
              const chartX = chartDef.x ?? (slideWidth - chartW) / 2;
              const chartY = chartDef.y ?? yPosition;

              // 图表颜色
              const chartColors = [theme.primary, theme.secondary, theme.accent, theme.textLight];

              // 添加图表
              slide.addChart(chartType as any, chartData, {
                x: chartX,
                y: chartY,
                w: chartW,
                h: chartH,
                title: chartDef.title,
                titleFontFace: 'Microsoft YaHei',
                titleFontSize: 12,
                titleColor: theme.text,
                showLegend: chartDef.data.length > 1,
                legendPos: 'b',
                legendFontFace: 'Microsoft YaHei',
                legendFontSize: 9,
                chartColors: chartColors,
                dataBorder: { pt: 1, color: 'FFFFFF' },
                dataLabelPosition: chartDef.type === 'pie' ? 'bestFit' : 'outEnd',
                dataLabelFontSize: 9,
                showValue: !['line', 'area'].includes(chartDef.type),
                valAxisTitle: '',
                catAxisTitle: '',
                valGridLine: { style: 'dash', color: 'E0E0E0' },
                catGridLine: { style: 'none' },
                catAxisLabelFontSize: 9,
                valAxisLabelFontSize: 9,
              });

              yPosition += chartH + 0.3;
            } catch {
              // 图表创建失败时显示占位符
              const placeholderH = Math.min(3, slideHeight - yPosition - bottomReserve);
              slide.addShape('rect', {
                x: 1,
                y: yPosition,
                w: 8,
                h: placeholderH,
                fill: { color: 'F3F4F6' },
                line: { color: theme.textLight, pt: 1, dashType: 'dash' },
              });
              slide.addText(`[图表: ${chartDef.title || chartDef.type}]`, {
                x: 1,
                y: yPosition + placeholderH / 2 - 0.25,
                w: 8,
                h: 0.5,
                fontSize: 14,
                color: theme.textLight,
                align: 'center',
              });
              yPosition += placeholderH + 0.3;
            }
          }
        }
      }

      // 添加结束页
      const endSlide = pptx.addSlide();
      endSlide.background = { color: theme.primary };
      endSlide.addText('谢谢观看', {
        x: '10%',
        y: '40%',
        w: '80%',
        h: 1,
        fontSize: 48,
        bold: true,
        align: 'center',
        color: 'FFFFFF',
        fontFace: 'Microsoft YaHei',
      });
      endSlide.addText('Thank You', {
        x: '10%',
        y: '55%',
        w: '80%',
        h: 0.6,
        fontSize: 24,
        align: 'center',
        color: theme.accent,
        fontFace: 'Arial',
      });

      // 保存文件
      await pptx.writeFile({ fileName: absolutePath });

      return {
        success: true,
        output: `PowerPoint 演示文稿已创建: ${absolutePath}\n包含 ${slides.length + (title ? 1 : 0) + 1} 张幻灯片（含封面和结束页）\n配色方案: ${themeName}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `创建 PowerPoint 失败: ${(error as Error).message}`,
      };
    }
  }
}
