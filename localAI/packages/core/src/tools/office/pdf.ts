import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import type { Tool, ToolResult } from '../types.js';
import { processChartsToTemp } from './chartEmbed.js';

/**
 * 预设配色方案 - 专业PDF风格
 */
const PDF_THEMES = {
  // 商务蓝 - 稳重专业
  business: {
    primary: '#2563EB',
    secondary: '#1E40AF',
    accent: '#3B82F6',
    text: '#1E293B',
    textLight: '#64748B',
    heading: '#1E40AF',
    link: '#2563EB',
  },
  // 学术灰 - 论文报告
  academic: {
    primary: '#374151',
    secondary: '#1F2937',
    accent: '#6B7280',
    text: '#111827',
    textLight: '#6B7280',
    heading: '#111827',
    link: '#374151',
  },
  // 创意橙 - 活力设计
  creative: {
    primary: '#EA580C',
    secondary: '#C2410C',
    accent: '#F97316',
    text: '#431407',
    textLight: '#9A3412',
    heading: '#C2410C',
    link: '#EA580C',
  },
  // 优雅紫 - 高端大气
  elegant: {
    primary: '#7C3AED',
    secondary: '#6D28D9',
    accent: '#8B5CF6',
    text: '#1E1B4B',
    textLight: '#6D28D9',
    heading: '#5B21B6',
    link: '#7C3AED',
  },
  // 自然绿 - 清新环保
  nature: {
    primary: '#059669',
    secondary: '#047857',
    accent: '#10B981',
    text: '#064E3B',
    textLight: '#047857',
    heading: '#065F46',
    link: '#059669',
  },
};

type PDFThemeKey = keyof typeof PDF_THEMES;

/**
 * 常用中文字体路径（Windows 和 macOS）
 * 注意：优先使用 TTF 格式，TTC 格式在某些 pdfkit 版本中有兼容性问题
 */
const CHINESE_FONT_PATHS = [
  // Windows - TTF 格式优先
  'C:/Windows/Fonts/simhei.ttf',    // 黑体 (TTF)
  'C:/Windows/Fonts/simkai.ttf',    // 楷体 (TTF)
  'C:/Windows/Fonts/simsun.ttf',    // 宋体 (TTF，如果存在)
  // Linux
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf',
  // macOS
  '/Library/Fonts/Arial Unicode.ttf',
];

/**
 * 查找可用的中文字体
 */
function findChineseFont(): string | null {
  for (const fontPath of CHINESE_FONT_PATHS) {
    if (fs.existsSync(fontPath)) {
      return fontPath;
    }
  }
  return null;
}

/**
 * PDF 内容类型
 */
interface PDFContent {
  /** 段落数组 */
  paragraphs?: Array<{
    text: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
  }>;
  /** 标题 */
  headings?: Array<{
    text: string;
    level: 1 | 2 | 3;
  }>;
  /** 列表 */
  lists?: Array<{
    items: string[];
    ordered?: boolean;
  }>;
  /** 表格 */
  tables?: Array<{
    headers?: string[];
    rows: string[][];
  }>;
  /** 图片 */
  images?: Array<{
    path: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
    caption?: string;
  }>;
}

/**
 * 解析 Markdown 为 PDF 内容结构
 * 支持: 标题、列表、图片、粗体、斜体、表格
 */
function parseMarkdownToPDFContent(markdown: string): { content: PDFContent; mainTitle?: string } {
  const lines = markdown.split('\n');
  const paragraphs: PDFContent['paragraphs'] = [];
  const headings: PDFContent['headings'] = [];
  const lists: PDFContent['lists'] = [];
  const tables: PDFContent['tables'] = [];
  const images: PDFContent['images'] = [];

  let mainTitle: string | undefined;
  let currentList: string[] = [];
  let isOrderedList = false;

  // 表格解析状态
  let inTable = false;
  let currentTableHeaders: string[] = [];
  let currentTableRows: string[][] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      lists.push({ items: [...currentList], ordered: isOrderedList });
      currentList = [];
    }
  };

  const flushTable = () => {
    if (currentTableHeaders.length > 0 || currentTableRows.length > 0) {
      tables.push({
        headers: currentTableHeaders.length > 0 ? [...currentTableHeaders] : undefined,
        rows: [...currentTableRows],
      });
      currentTableHeaders = [];
      currentTableRows = [];
      inTable = false;
    }
  };

  // 解析表格行
  const parseTableRow = (line: string): string[] | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      return null;
    }
    // 分割单元格，去除首尾的 |
    const cells = trimmed.slice(1, -1).split('|').map(cell => cell.trim());
    return cells;
  };

  // 检查是否为分隔行 (|---|---|)
  const isSeparatorRow = (line: string): boolean => {
    const trimmed = line.trim();
    return /^\|[\s\-:]+\|$/.test(trimmed) || /^\|(\s*[-:]+\s*\|)+$/.test(trimmed);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      flushList();
      flushTable();
      continue;
    }

    // 检查是否为表格行
    const tableRow = parseTableRow(trimmed);
    if (tableRow) {
      flushList();

      if (!inTable) {
        // 开始新表格，这是表头
        currentTableHeaders = tableRow;
        inTable = true;
      } else if (isSeparatorRow(trimmed)) {
        // 分隔行，跳过
        continue;
      } else {
        // 数据行
        currentTableRows.push(tableRow);
      }
      continue;
    } else if (inTable) {
      // 表格结束
      flushTable();
    }

    // 图片语法: ![alt](path)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      flushList();
      images.push({
        path: imageMatch[2],
        width: 400,
        align: 'center',
        caption: imageMatch[1] || undefined,
      });
      continue;
    }

    // 一级标题作为文档标题
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      flushList();
      if (!mainTitle) {
        mainTitle = h1Match[1];
      }
      continue;
    }

    // 标题 (2-3级)
    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = (headingMatch[1].length - 1) as 1 | 2 | 3; // ##=1, ###=2
      headings.push({ text: headingMatch[2], level: Math.min(level, 3) as 1 | 2 | 3 });
      continue;
    }

    // 无序列表
    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      if (currentList.length > 0 && isOrderedList) {
        flushList();
      }
      isOrderedList = false;
      currentList.push(listMatch[1]);
      continue;
    }

    // 有序列表
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (currentList.length > 0 && !isOrderedList) {
        flushList();
      }
      isOrderedList = true;
      currentList.push(orderedMatch[1]);
      continue;
    }

    // 普通段落 - 处理粗体和斜体
    flushList();
    let text = trimmed;
    let bold = false;
    let italic = false;

    // 检测 **bold**
    if (/^\*\*(.+)\*\*$/.test(text)) {
      text = text.slice(2, -2);
      bold = true;
    }
    // 检测 *italic*
    if (/^\*(.+)\*$/.test(text)) {
      text = text.slice(1, -1);
      italic = true;
    }

    paragraphs.push({ text, bold, italic });
  }

  flushList();
  flushTable();

  return {
    content: {
      paragraphs,
      headings,
      lists,
      tables: tables.length > 0 ? tables : undefined,
      images: images.length > 0 ? images : undefined
    },
    mainTitle,
  };
}

/**
 * PDF 创建工具
 */
export class CreatePDFTool implements Tool {
  definition = {
    name: 'createPDF',
    description: `创建专业的 PDF 文档。支持中文、图片、表格、图表、配色主题。

**Markdown 格式说明**：
- # 一级标题: 文档主标题
- ## 二级标题, ### 三级标题
- - 或 * 列表项
- 1. 有序列表
- **粗体** 和 *斜体*
- ![描述](图片路径) 插入图片
- | 表头1 | 表头2 | 表格语法
- @chart{...} 内嵌图表

**内嵌图表语法**：
@chart{"type":"bar","title":"数据分析","labels":["A","B","C"],"data":[100,200,150]}

**配色主题**：
- business: 商务蓝（默认）
- academic: 学术灰
- creative: 创意橙
- elegant: 优雅紫
- nature: 自然绿

**示例**：
\`\`\`markdown
# 项目报告

## 数据概览
| 指标 | Q1 | Q2 |
|------|----|----|
| 收入 | 100 | 150 |
| 成本 | 60 | 80 |

## 趋势分析
@chart{"type":"line","title":"收入趋势","labels":["1月","2月","3月"],"data":[80,100,130]}

## 总结
- 整体增长良好
- 成本控制到位
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要创建的文件路径（应以 .pdf 结尾）',
        },
        markdown: {
          type: 'string',
          description: '【推荐】Markdown 格式的文档内容。支持标题、列表、图片、粗体斜体。',
        },
        theme: {
          type: 'string',
          description: '配色主题：business(商务蓝)、academic(学术灰)、creative(创意橙)、elegant(优雅紫)、nature(自然绿)',
          enum: ['business', 'academic', 'creative', 'elegant', 'nature'],
        },
        title: {
          type: 'string',
          description: '文档标题（可选，会覆盖 markdown 中的 # 标题）',
        },
        author: {
          type: 'string',
          description: '作者名称（可选）',
        },
        content: {
          type: 'object',
          description: '结构化内容（高级用法），包含 paragraphs、headings、lists、images',
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
    const themeName = (args.theme as PDFThemeKey) || 'business';
    const rawContent = args.content as PDFContent | undefined;

    // 获取配色主题
    const theme = PDF_THEMES[themeName] || PDF_THEMES.business;

    // 图表颜色方案映射
    const chartColorMap: Record<string, 'colorful' | 'business' | 'finance' | 'warm' | 'elegant'> = {
      business: 'business',
      academic: 'business',
      creative: 'warm',
      elegant: 'elegant',
      nature: 'finance',
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

    // 优先使用 markdown
    let content: PDFContent;
    if (markdown) {
      const parsed = parseMarkdownToPDFContent(markdown);
      content = parsed.content;
      if (parsed.mainTitle && !title) {
        title = parsed.mainTitle;
      }
    } else if (rawContent) {
      content = rawContent;
    } else {
      return {
        success: false,
        output: '',
        error: '必须提供 markdown 或 content 参数',
      };
    }

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // 获取文件所在目录用于解析相对图片路径
      const baseDir = path.dirname(absolutePath);

      // 确保目录存在
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 查找中文字体
      const chineseFont = findChineseFont();
      const hasChinese = /[\u4e00-\u9fa5]/.test(markdown || JSON.stringify(content));
      let fontWarning = '';

      if (hasChinese && !chineseFont) {
        fontWarning = '\n注意：未找到系统中文字体，中文可能显示异常';
      }

      return new Promise((resolve) => {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          info: {
            Title: title || 'Untitled',
            Author: author || 'LSC AI',
            Creator: 'LSC AI',
          },
          autoFirstPage: true,
          bufferPages: true,
        });

        const stream = fs.createWriteStream(absolutePath);
        doc.pipe(stream);

        // 注册中文字体（如果找到）
        let mainFont = 'Helvetica';
        let boldFont = 'Helvetica-Bold';
        let italicFont = 'Helvetica-Oblique';
        let fontRegistered = false;

        if (chineseFont) {
          try {
            doc.registerFont('ChineseFont', chineseFont);
            // 测试字体是否真正可用（有些字体在注册时不报错，使用时才报错）
            doc.font('ChineseFont');
            doc.font('Helvetica'); // 切回默认
            mainFont = 'ChineseFont';
            boldFont = 'ChineseFont'; // 中文字体通常没有独立的粗体变体
            italicFont = 'ChineseFont';
            fontRegistered = true;
          } catch {
            // 字体注册或使用失败，使用默认字体
            fontWarning = '\n注意：中文字体加载失败，使用默认字体';
          }
        }

        let pageNum = 0;

        // 添加页眉页脚
        const addHeaderFooter = () => {
          const pages = doc.bufferedPageRange();
          for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);

            // 页脚：页码
            doc
              .fontSize(9)
              .fillColor(theme.textLight)
              .text(
                `${i + 1}`,
                0,
                doc.page.height - 40,
                { align: 'center', width: doc.page.width }
              );

            // 页脚：作者信息
            if (author) {
              doc
                .fontSize(8)
                .fillColor(theme.textLight)
                .text(
                  author,
                  60,
                  doc.page.height - 40,
                  { align: 'left' }
                );
            }
          }
        };

        // 添加文档标题
        if (title) {
          // 标题装饰线
          doc
            .moveTo(60, 50)
            .lineTo(doc.page.width - 60, 50)
            .strokeColor(theme.accent)
            .lineWidth(2)
            .stroke();

          doc
            .fontSize(28)
            .font(boldFont)
            .fillColor(theme.heading)
            .text(title, { align: 'center' });

          doc.moveDown(0.3);

          // 作者和日期
          if (author) {
            doc
              .fontSize(12)
              .font(mainFont)
              .fillColor(theme.textLight)
              .text(author, { align: 'center' });
          }

          // 日期
          const dateStr = new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          doc
            .fontSize(10)
            .font(mainFont)
            .fillColor(theme.textLight)
            .text(dateStr, { align: 'center' });

          doc.moveDown(1);

          // 标题下装饰线
          doc
            .moveTo(doc.page.width / 2 - 50, doc.y)
            .lineTo(doc.page.width / 2 + 50, doc.y)
            .strokeColor(theme.accent)
            .lineWidth(1)
            .stroke();

          doc.moveDown(1.5);
        }

        // 重置颜色
        doc.fillColor(theme.text);

        // 混合渲染内容（按顺序处理标题、段落、列表）
        // 这里简化处理：先渲染标题，再渲染段落和列表

        // 添加标题元素
        if (content.headings) {
          for (const heading of content.headings) {
            const sizes = { 1: 18, 2: 15, 3: 13 };
            const spacing = { 1: 1.2, 2: 1, 3: 0.8 };

            doc.moveDown(spacing[heading.level]);

            // 标题左侧装饰条
            if (heading.level === 1) {
              const yPos = doc.y;
              doc
                .rect(55, yPos, 4, sizes[heading.level])
                .fill(theme.primary);
            }

            doc
              .fontSize(sizes[heading.level])
              .font(boldFont)
              .fillColor(theme.heading)
              .text(heading.text, heading.level === 1 ? 65 : undefined);

            doc.moveDown(0.5);
          }
        }

        // 添加段落
        if (content.paragraphs) {
          for (const p of content.paragraphs) {
            const fontSize = p.fontSize || 11;
            const font = p.bold ? boldFont : (p.italic ? italicFont : mainFont);

            doc
              .fontSize(fontSize)
              .font(font)
              .fillColor(p.color || theme.text)
              .text(p.text, {
                align: p.align || 'justify',
                lineGap: 4,
                paragraphGap: 8,
              });

            doc.moveDown(0.4);
          }
        }

        // 添加列表
        if (content.lists) {
          for (const list of content.lists) {
            doc.moveDown(0.3);
            doc.fontSize(11).font(mainFont).fillColor(theme.text);

            list.items.forEach((item, index) => {
              const prefix = list.ordered ? `${index + 1}. ` : '• ';
              doc.text(prefix + item, {
                indent: 20,
                lineGap: 3,
              });
            });
            doc.moveDown(0.5);
          }
        }

        // 添加表格
        if (content.tables && content.tables.length > 0) {
          for (const table of content.tables) {
            doc.moveDown(0.5);

            const pageWidth = doc.page.width - 120; // 左右各60边距
            const colCount = table.headers?.length || (table.rows[0]?.length || 1);
            const colWidth = pageWidth / colCount;
            const cellPadding = 5;
            const rowHeight = 22;
            const startX = 60;
            let currentY = doc.y;

            // 绘制表头
            if (table.headers && table.headers.length > 0) {
              // 表头背景
              doc
                .rect(startX, currentY, pageWidth, rowHeight)
                .fill(theme.primary);

              // 表头文字
              doc.fontSize(10).font(boldFont).fillColor('#FFFFFF');
              table.headers.forEach((header, colIdx) => {
                const cellX = startX + colIdx * colWidth;
                doc.text(header, cellX + cellPadding, currentY + cellPadding, {
                  width: colWidth - cellPadding * 2,
                  height: rowHeight - cellPadding * 2,
                  align: 'center',
                });
              });
              currentY += rowHeight;
            }

            // 绘制数据行
            doc.fontSize(10).font(mainFont);
            for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
              const row = table.rows[rowIdx];

              // 检查是否需要换页
              if (currentY + rowHeight > doc.page.height - 80) {
                doc.addPage();
                currentY = 60;
              }

              // 斑马纹背景
              if (rowIdx % 2 === 1) {
                doc
                  .rect(startX, currentY, pageWidth, rowHeight)
                  .fill('#F8FAFC');
              }

              // 单元格边框
              doc
                .rect(startX, currentY, pageWidth, rowHeight)
                .stroke(theme.accent);

              // 单元格文字
              doc.fillColor(theme.text);
              row.forEach((cell, colIdx) => {
                const cellX = startX + colIdx * colWidth;
                // 绘制列分隔线
                if (colIdx > 0) {
                  doc
                    .moveTo(cellX, currentY)
                    .lineTo(cellX, currentY + rowHeight)
                    .stroke(theme.accent);
                }
                doc.text(cell || '', cellX + cellPadding, currentY + cellPadding, {
                  width: colWidth - cellPadding * 2,
                  height: rowHeight - cellPadding * 2,
                  align: 'left',
                });
              });

              currentY += rowHeight;
            }

            // 更新文档 y 位置
            doc.y = currentY;
            doc.moveDown(0.5);
          }
        }

        // 添加图片
        if (content.images && content.images.length > 0) {
          for (const img of content.images) {
            try {
              let imgPath = img.path;
              if (!path.isAbsolute(imgPath)) {
                imgPath = path.resolve(baseDir, imgPath);
              }

              if (fs.existsSync(imgPath)) {
                doc.moveDown(0.5);

                // 计算图片位置
                const imgWidth = img.width || 400;
                let x = 60; // left
                if (img.align === 'center') {
                  x = (doc.page.width - imgWidth) / 2;
                } else if (img.align === 'right') {
                  x = doc.page.width - 60 - imgWidth;
                }

                doc.image(imgPath, x, doc.y, { width: imgWidth });

                // 添加图片说明
                if (img.caption) {
                  doc.moveDown(0.3);
                  doc
                    .fontSize(9)
                    .font(italicFont)
                    .fillColor(theme.textLight)
                    .text(img.caption, { align: 'center' });
                }

                doc.moveDown(0.5);
              } else {
                // 图片不存在，显示占位文本
                doc
                  .fontSize(10)
                  .font(italicFont)
                  .fillColor(theme.textLight)
                  .text(`[图片: ${img.path}]`, { align: 'center' });
                doc.moveDown(0.5);
              }
            } catch {
              // 图片加载失败
              doc
                .fontSize(10)
                .font(italicFont)
                .fillColor(theme.textLight)
                .text(`[图片加载失败: ${img.path}]`, { align: 'center' });
              doc.moveDown(0.5);
            }
          }
        }

        // 添加页眉页脚
        addHeaderFooter();

        doc.end();

        stream.on('finish', () => {
          const imageCount = content.images?.length || 0;
          const tableCount = content.tables?.length || 0;
          let output = `PDF 文档已创建: ${absolutePath}\n`;
          output += `配色主题: ${themeName}`;
          if (chineseFont) {
            output += `\n中文字体: 已加载`;
          }
          if (tableCount > 0) {
            output += `\n表格: ${tableCount} 个`;
          }
          if (imageCount > 0) {
            output += `\n图片: ${imageCount} 张`;
          }
          output += fontWarning;

          resolve({
            success: true,
            output,
          });
        });

        stream.on('error', (err) => {
          resolve({
            success: false,
            output: '',
            error: `创建 PDF 失败: ${err.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `创建 PDF 失败: ${(error as Error).message}`,
      };
    }
  }
}
