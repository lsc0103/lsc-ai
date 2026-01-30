import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  Footer,
  PageNumber,
  convertInchesToTwip,
  ShadingType,
  SectionType,
  ColumnBreak,
} from 'docx';
import type { Tool, ToolResult } from '../types.js';
import { processChartsToTemp } from './chartEmbed.js';

/**
 * 预设配色方案 - 专业文档风格
 */
const WORD_THEMES = {
  // 商务蓝 - 稳重专业
  business: {
    primary: '2563EB',
    secondary: '1E40AF',
    accent: '3B82F6',
    text: '1E293B',
    textLight: '64748B',
    heading: '1E40AF',
    tableHeader: 'DBEAFE',
    tableStripe: 'F8FAFC',
  },
  // 学术灰 - 论文报告
  academic: {
    primary: '374151',
    secondary: '1F2937',
    accent: '6B7280',
    text: '111827',
    textLight: '6B7280',
    heading: '111827',
    tableHeader: 'E5E7EB',
    tableStripe: 'F9FAFB',
  },
  // 创意橙 - 活力设计
  creative: {
    primary: 'EA580C',
    secondary: 'C2410C',
    accent: 'F97316',
    text: '431407',
    textLight: '9A3412',
    heading: 'C2410C',
    tableHeader: 'FFEDD5',
    tableStripe: 'FFF7ED',
  },
  // 优雅紫 - 高端大气
  elegant: {
    primary: '7C3AED',
    secondary: '6D28D9',
    accent: '8B5CF6',
    text: '1E1B4B',
    textLight: '6D28D9',
    heading: '5B21B6',
    tableHeader: 'EDE9FE',
    tableStripe: 'FAF5FF',
  },
  // 自然绿 - 清新环保
  nature: {
    primary: '059669',
    secondary: '047857',
    accent: '10B981',
    text: '064E3B',
    textLight: '047857',
    heading: '065F46',
    tableHeader: 'D1FAE5',
    tableStripe: 'ECFDF5',
  },
};

type WordThemeKey = keyof typeof WORD_THEMES;

/**
 * 分栏内容定义
 */
interface ColumnSection {
  /** 栏数 */
  count: number;
  /** 栏内容（数组，每个元素是一栏的 markdown 内容） */
  columns: string[];
}

/**
 * Word 文档内容类型
 */
interface WordContent {
  /** 段落或标题 */
  paragraphs?: Array<{
    text: string;
    heading?: 1 | 2 | 3 | 4 | 5 | 6;
    bold?: boolean;
    italic?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    /** 标记为分栏开始 */
    columnStart?: ColumnSection;
    /** 标记为分栏结束 */
    columnEnd?: boolean;
    /** 标记为分栏分隔符（换到下一栏） */
    columnBreak?: boolean;
  }>;
  /** 表格 */
  tables?: Array<{
    headers?: string[];
    rows: string[][];
  }>;
  /** 图片 */
  images?: Array<{
    path: string;
    width?: number;  // 英寸
    height?: number; // 英寸
    alignment?: 'left' | 'center' | 'right';
  }>;
}

/**
 * 解析 Markdown 文本为 Word 内容结构
 * 支持: 标题、列表、图片、粗体、斜体、分栏
 *
 * 分栏语法:
 * :::columns{count=2}
 * 第一栏内容...
 *
 * ---column---
 *
 * 第二栏内容...
 * :::
 */
function parseMarkdownToContent(markdown: string): WordContent {
  const lines = markdown.split('\n');
  const paragraphs: WordContent['paragraphs'] = [];
  const images: WordContent['images'] = [];

  let inColumnSection = false;
  let columnCount = 0;
  let columnContents: string[] = [];
  let currentColumnContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const trimmed = line.trim();

    // 检测分栏开始: :::columns{count=N}
    const columnStartMatch = trimmed.match(/^:::columns\{count=(\d+)\}$/);
    if (columnStartMatch && columnStartMatch[1]) {
      inColumnSection = true;
      columnCount = parseInt(columnStartMatch[1], 10);
      columnContents = [];
      currentColumnContent = [];
      continue;
    }

    // 检测分栏结束: :::
    if (inColumnSection && trimmed === ':::') {
      // 保存最后一栏内容
      if (currentColumnContent.length > 0) {
        columnContents.push(currentColumnContent.join('\n'));
      }

      // 添加分栏开始标记
      paragraphs.push({
        text: '',
        columnStart: {
          count: columnCount,
          columns: columnContents,
        },
      });

      // 解析每栏内容并添加
      for (let colIdx = 0; colIdx < columnContents.length; colIdx++) {
        const colContent = columnContents[colIdx];
        if (!colContent) continue;
        const colParagraphs = parseColumnContent(colContent, images);

        for (const p of colParagraphs) {
          paragraphs.push(p);
        }

        // 如果不是最后一栏，添加换栏标记
        if (colIdx < columnContents.length - 1) {
          paragraphs.push({ text: '', columnBreak: true });
        }
      }

      // 添加分栏结束标记
      paragraphs.push({ text: '', columnEnd: true });

      inColumnSection = false;
      columnCount = 0;
      columnContents = [];
      currentColumnContent = [];
      continue;
    }

    // 检测栏分隔符: ---column---
    if (inColumnSection && trimmed === '---column---') {
      columnContents.push(currentColumnContent.join('\n'));
      currentColumnContent = [];
      continue;
    }

    // 如果在分栏区域内，收集内容
    if (inColumnSection) {
      if (line) {
        currentColumnContent.push(line);
      }
      continue;
    }

    // 普通内容处理
    if (!trimmed) {
      paragraphs.push({ text: '' });
      continue;
    }

    // 检测图片语法: ![alt](path)
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch && imageMatch[2]) {
      images.push({
        path: imageMatch[2],
        width: 5,
        height: 3,
        alignment: 'center',
      });
      paragraphs.push({ text: `__IMAGE_PLACEHOLDER_${images.length - 1}__` });
      continue;
    }

    // 检测标题级别
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      paragraphs.push({
        text: headingMatch[2],
        heading: level,
        bold: true,
      });
      continue;
    }

    // 检测列表项
    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch && listMatch[1]) {
      paragraphs.push({ text: `• ${listMatch[1]}` });
      continue;
    }

    // 检测有序列表
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch && orderedMatch[1] && orderedMatch[2]) {
      paragraphs.push({ text: `${orderedMatch[1]}. ${orderedMatch[2]}` });
      continue;
    }

    // 检测缩进列表项
    const indentedListMatch = trimmed.match(/^\s+[-*+]\s+(.+)$/);
    if (indentedListMatch && indentedListMatch[1]) {
      paragraphs.push({ text: `  ◦ ${indentedListMatch[1]}` });
      continue;
    }

    // 普通段落 - 处理粗体和斜体
    let text = trimmed;
    let bold = false;
    let italic = false;

    if (/^\*\*(.+)\*\*$/.test(text) || /^__(.+)__$/.test(text)) {
      text = text.slice(2, -2);
      bold = true;
    }

    if (/^\*(.+)\*$/.test(text) || /^_(.+)_$/.test(text)) {
      text = text.slice(1, -1);
      italic = true;
    }

    paragraphs.push({ text, bold, italic });
  }

  return { paragraphs, images: images.length > 0 ? images : undefined };
}

/**
 * 解析单栏内容为段落数组
 */
function parseColumnContent(
  content: string,
  images: WordContent['images']
): NonNullable<WordContent['paragraphs']> {
  const lines = content.split('\n');
  const paragraphs: NonNullable<WordContent['paragraphs']> = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push({ text: '' });
      continue;
    }

    // 检测图片语法
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch && imageMatch[2] && images) {
      images.push({
        path: imageMatch[2],
        width: 3,
        height: 2,
        alignment: 'center',
      });
      paragraphs.push({ text: `__IMAGE_PLACEHOLDER_${images.length - 1}__` });
      continue;
    }

    // 检测标题级别
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      paragraphs.push({ text: headingMatch[2], heading: level, bold: true });
      continue;
    }

    // 检测列表项
    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch && listMatch[1]) {
      paragraphs.push({ text: `• ${listMatch[1]}` });
      continue;
    }

    // 普通段落
    let text = trimmed;
    let bold = false;
    let italic = false;

    if (/^\*\*(.+)\*\*$/.test(text) || /^__(.+)__$/.test(text)) {
      text = text.slice(2, -2);
      bold = true;
    }

    if (/^\*(.+)\*$/.test(text) || /^_(.+)_$/.test(text)) {
      text = text.slice(1, -1);
      italic = true;
    }

    paragraphs.push({ text, bold, italic });
  }

  return paragraphs;
}

/**
 * Word 文档创建工具
 */
export class CreateWordTool implements Tool {
  definition = {
    name: 'createWord',
    description: `创建精美的 Word 文档 (.docx)。支持图片、表格、图表、分栏、配色主题和专业排版。

**Markdown 格式说明**：
- # 一级标题, ## 二级标题 ... ###### 六级标题
- - 或 * 列表项
- 1. 有序列表
- **粗体** 和 *斜体*
- ![描述](图片路径) 插入图片
- @chart{...} 内嵌图表（自动生成）

**分栏语法**（支持2-4栏）：
\`\`\`markdown
:::columns{count=2}
第一栏内容...

---column---

第二栏内容...
:::
\`\`\`

**内嵌图表语法**（图表会自动生成并插入文档）：
@chart{"type":"bar","title":"销售数据","labels":["Q1","Q2","Q3","Q4"],"datasets":[{"label":"销售额","data":[100,200,150,300]}]}

支持的图表类型：bar(柱状图)、line(折线图)、pie(饼图)、doughnut(环形图)

**配色主题**：
- business: 商务蓝（默认）- 稳重专业
- academic: 学术灰 - 论文报告
- creative: 创意橙 - 活力设计
- elegant: 优雅紫 - 高端大气
- nature: 自然绿 - 清新环保

**示例**：
\`\`\`markdown
# 项目报告

## 项目概述
这是一个创新项目...

## 数据分析
@chart{"type":"bar","title":"季度销售","labels":["Q1","Q2","Q3","Q4"],"data":[120,180,150,220]}

:::columns{count=2}
### 优势
- 技术领先
- 团队专业

---column---

### 挑战
- 市场竞争
- 资源有限
:::

## 总结
**项目取得显著成果**
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要创建的文件路径（应以 .docx 结尾）',
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
          description: '文档标题（可选，会覆盖 markdown 中的 # 一级标题）',
        },
        author: {
          type: 'string',
          description: '作者名称（可选，显示在页脚）',
        },
        content: {
          type: 'object',
          description: '结构化内容（高级用法），包含 paragraphs、tables、images 数组',
        },
      },
      required: ['file_path', 'markdown'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    let title = args.title as string | undefined;
    const author = args.author as string | undefined;
    const themeName = (args.theme as WordThemeKey) || 'business';
    let markdown = args.markdown as string | undefined;
    const rawContent = args.content as WordContent | undefined;

    // 获取配色主题
    const theme = WORD_THEMES[themeName] || WORD_THEMES.business;

    // 图表颜色方案映射
    const chartColorMap: Record<string, 'colorful' | 'business' | 'finance' | 'warm' | 'elegant'> = {
      business: 'business',
      academic: 'business',
      creative: 'warm',
      elegant: 'elegant',
      nature: 'finance',
    };

    // 处理内嵌图表（如果 markdown 中包含 @chart{...} 语法）
    if (markdown && markdown.includes('@chart{')) {
      try {
        const result = await processChartsToTemp(markdown, chartColorMap[themeName] || 'colorful');
        markdown = result.processedText;
        // chartImages are automatically embedded in markdown as image references
      } catch {
        // 图表处理失败，继续使用原始 markdown
      }
    }

    // 优先使用 markdown，否则使用 content
    let content: WordContent;
    if (markdown) {
      content = parseMarkdownToContent(markdown);
      // 从markdown中提取一级标题作为文档标题
      const titlePara = content.paragraphs?.find(p => p.heading === 1);
      if (titlePara && !title) {
        title = titlePara.text;
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
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      // 用于构建多个 section 的数组
      interface SectionData {
        children: (Paragraph | Table)[];
        columnCount?: number;
      }
      const sections: SectionData[] = [];
      let currentSection: SectionData = { children: [] };

      // 添加文档标题（如果有）
      if (title) {
        currentSection.children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 56, // 28pt
                color: theme.heading,
                font: 'Microsoft YaHei',
              }),
            ],
          })
        );
        // 标题下装饰线
        currentSection.children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 12, color: theme.accent },
            },
            children: [new TextRun({ text: '' })],
          })
        );
      }

      // 字号映射
      const fontSizeMap: Record<number, number> = {
        1: 48, // 24pt
        2: 40, // 20pt
        3: 32, // 16pt
        4: 28, // 14pt
        5: 24, // 12pt
        6: 22, // 11pt
      };

      // 添加段落
      if (content.paragraphs) {
        for (let i = 0; i < content.paragraphs.length; i++) {
          const p = content.paragraphs[i];
          if (!p) continue;

          // 处理分栏开始
          if (p.columnStart) {
            // 保存当前 section（如果有内容）
            if (currentSection.children.length > 0) {
              sections.push(currentSection);
            }
            // 开始新的分栏 section
            currentSection = { children: [], columnCount: p.columnStart.count };
            continue;
          }

          // 处理分栏换栏
          if (p.columnBreak) {
            currentSection.children.push(
              new Paragraph({
                children: [new ColumnBreak()],
              })
            );
            continue;
          }

          // 处理分栏结束
          if (p.columnEnd) {
            // 保存分栏 section
            if (currentSection.children.length > 0) {
              sections.push(currentSection);
            }
            // 开始新的普通 section
            currentSection = { children: [] };
            continue;
          }

          // 检查是否为图片占位符
          const imgMatch = p.text.match(/^__IMAGE_PLACEHOLDER_(\d+)__$/);
          if (imgMatch && imgMatch[1] && content.images) {
            const imgIndex = parseInt(imgMatch[1], 10);
            const imgDef = content.images[imgIndex];
            if (imgDef) {
              try {
                // 解析图片路径
                let imgPath = imgDef.path;
                if (!path.isAbsolute(imgPath)) {
                  imgPath = path.resolve(baseDir, imgPath);
                }

                // 读取图片
                const imageBuffer = await fs.readFile(imgPath);
                const width = imgDef.width || 5;
                const height = imgDef.height || 3;

                const alignmentMap: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
                  left: AlignmentType.LEFT,
                  center: AlignmentType.CENTER,
                  right: AlignmentType.RIGHT,
                };

                currentSection.children.push(
                  new Paragraph({
                    alignment: alignmentMap[imgDef.alignment || 'center'],
                    spacing: { before: 200, after: 200 },
                    children: [
                      new ImageRun({
                        data: imageBuffer,
                        transformation: {
                          width: convertInchesToTwip(width) / 20, // 转换为EMU
                          height: convertInchesToTwip(height) / 20,
                        },
                        type: 'png', // 默认类型
                      }),
                    ],
                  })
                );
              } catch {
                // 图片加载失败，显示占位文本
                currentSection.children.push(
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 200, after: 200 },
                    children: [
                      new TextRun({
                        text: `[图片: ${imgDef.path}]`,
                        italics: true,
                        color: theme.textLight,
                        size: 20,
                      }),
                    ],
                  })
                );
              }
              continue;
            }
          }

          // 跳过已作为标题使用的一级标题
          if (p.heading === 1 && p.text === title) {
            continue;
          }

          const alignmentMap: Record<string, typeof AlignmentType[keyof typeof AlignmentType]> = {
            left: AlignmentType.LEFT,
            center: AlignmentType.CENTER,
            right: AlignmentType.RIGHT,
            justify: AlignmentType.JUSTIFIED,
          };

          if (p.heading) {
            // 标题段落
            currentSection.children.push(
              new Paragraph({
                alignment: p.alignment ? alignmentMap[p.alignment] : AlignmentType.LEFT,
                spacing: { before: 300, after: 120 },
                children: [
                  new TextRun({
                    text: p.text,
                    bold: true,
                    size: fontSizeMap[p.heading] || 24,
                    color: theme.heading,
                    font: 'Microsoft YaHei',
                  }),
                ],
              })
            );
          } else if (p.text === '') {
            // 空行
            currentSection.children.push(new Paragraph({ spacing: { after: 120 } }));
          } else if (p.text.startsWith('•') || p.text.startsWith('  ◦')) {
            // 列表项
            const indent = p.text.startsWith('  ◦') ? 720 : 360;
            currentSection.children.push(
              new Paragraph({
                indent: { left: indent },
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: p.text,
                    size: 24,
                    color: theme.text,
                    font: 'Microsoft YaHei',
                  }),
                ],
              })
            );
          } else if (/^\d+\./.test(p.text)) {
            // 有序列表项
            currentSection.children.push(
              new Paragraph({
                indent: { left: 360 },
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: p.text,
                    size: 24,
                    color: theme.text,
                    font: 'Microsoft YaHei',
                  }),
                ],
              })
            );
          } else {
            // 普通段落
            currentSection.children.push(
              new Paragraph({
                alignment: p.alignment ? alignmentMap[p.alignment] : AlignmentType.JUSTIFIED,
                spacing: { after: 120, line: 360 },
                indent: { firstLine: 480 }, // 首行缩进
                children: [
                  new TextRun({
                    text: p.text,
                    bold: p.bold,
                    italics: p.italic,
                    size: 24, // 12pt
                    color: theme.text,
                    font: 'Microsoft YaHei',
                  }),
                ],
              })
            );
          }
        }
      }

      // 添加表格
      if (content.tables) {
        for (const t of content.tables) {
          if (!t) continue;
          const tableRows: TableRow[] = [];

          // 表头
          if (t.headers && t.headers.length > 0) {
            tableRows.push(
              new TableRow({
                children: t.headers.map(
                  (header) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: header,
                              bold: true,
                              size: 22,
                              color: theme.text,
                              font: 'Microsoft YaHei',
                            }),
                          ],
                        }),
                      ],
                      shading: { fill: theme.tableHeader, type: ShadingType.CLEAR },
                    })
                ),
              })
            );
          }

          // 数据行（斑马纹）
          for (let rowIdx = 0; rowIdx < t.rows.length; rowIdx++) {
            const row = t.rows[rowIdx];
            if (!row) continue;
            tableRows.push(
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: cell,
                              size: 20,
                              color: theme.text,
                              font: 'Microsoft YaHei',
                            }),
                          ],
                        }),
                      ],
                      shading: {
                        fill: rowIdx % 2 === 0 ? 'FFFFFF' : theme.tableStripe,
                        type: ShadingType.CLEAR,
                      },
                    })
                ),
              })
            );
          }

          currentSection.children.push(new Paragraph({ spacing: { after: 200 } })); // 表格前空行
          currentSection.children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            })
          );
          currentSection.children.push(new Paragraph({ spacing: { after: 200 } })); // 表格后空行
        }
      }

      // 保存最后一个 section
      if (currentSection.children.length > 0) {
        sections.push(currentSection);
      }

      // 创建页脚
      const footerChildren = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: author ? `${author} | ` : '',
              size: 18,
              color: theme.textLight,
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 18,
              color: theme.textLight,
            }),
            new TextRun({
              text: ' / ',
              size: 18,
              color: theme.textLight,
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              size: 18,
              color: theme.textLight,
            }),
          ],
        }),
      ];

      // 构建 Document sections
      const docSections = sections
        .filter((section): section is SectionData => section !== null && section !== undefined)
        .map((section, idx) => {
          const sectionProps: any = {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.25),
                right: convertInchesToTwip(1.25),
              },
            },
          };

          // 如果是分栏 section，添加 column 属性
          if (section.columnCount && section.columnCount > 1) {
            sectionProps.column = {
              count: section.columnCount,
              space: convertInchesToTwip(0.3), // 栏间距 0.3 英寸
              equalWidth: true,
            };
            // 非最后一个 section 使用 continuous 类型
            if (idx < sections.length - 1) {
              sectionProps.type = SectionType.CONTINUOUS;
            }
          } else if (idx > 0) {
            // 非第一个普通 section 也使用 continuous
            sectionProps.type = SectionType.CONTINUOUS;
          }

          return {
            properties: sectionProps,
            children: section.children,
            footers: {
              default: new Footer({ children: footerChildren }),
            },
          };
        });

      // 创建文档
      const doc = new Document({
        creator: author || 'LSC AI',
        title: title,
        description: '由 LSC AI 创建的文档',
        sections: docSections.length > 0 ? docSections : [
          {
            properties: {
              page: {
                margin: {
                  top: convertInchesToTwip(1),
                  bottom: convertInchesToTwip(1),
                  left: convertInchesToTwip(1.25),
                  right: convertInchesToTwip(1.25),
                },
              },
            },
            children: [],
            footers: {
              default: new Footer({ children: footerChildren }),
            },
          },
        ],
      });

      // 生成并保存
      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(absolutePath, buffer);

      const imageCount = content.images?.length || 0;
      const tableCount = content.tables?.length || 0;

      return {
        success: true,
        output: `Word 文档已创建: ${absolutePath}\n配色主题: ${themeName}${imageCount > 0 ? `\n图片: ${imageCount} 张` : ''}${tableCount > 0 ? `\n表格: ${tableCount} 个` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `创建 Word 文档失败: ${(error as Error).message}`,
      };
    }
  }
}
