import * as fs from 'fs/promises';
import * as path from 'path';
import mammoth from 'mammoth';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Footer,
  PageNumber,
  convertInchesToTwip,
} from 'docx';
import type { Tool, ToolResult } from '../types.js';

/**
 * Word 文档编辑工具 - 修改现有 Word 文件
 *
 * 注意：由于 Word 文档格式的复杂性，此工具使用 mammoth 读取并用 docx 重建。
 * 这意味着复杂格式（表格、图片、特殊样式）可能丢失。适合简单文本编辑场景。
 */
export class EditWordTool implements Tool {
  definition = {
    name: 'editWord',
    description: `编辑现有的 Word 文档 (.docx)。支持文本替换和追加内容。

**重要提示**：由于技术限制，此工具会重建文档结构。复杂格式（如表格、图片、特殊样式）可能丢失。适合简单文本文档的编辑。

**支持的操作**：
- replace: 替换第一个匹配的文本
- replaceAll: 替换所有匹配的文本
- append: 在文档末尾追加 Markdown 内容

**示例**：
\`\`\`json
{
  "file_path": "document.docx",
  "operations": [
    {
      "type": "replace",
      "search": "旧文本",
      "replacement": "新文本"
    },
    {
      "type": "replaceAll",
      "search": "公司名称",
      "replacement": "ABC科技有限公司"
    },
    {
      "type": "append",
      "content": "## 新增章节\\n\\n这是追加的内容。"
    }
  ]
}
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要编辑的 Word 文件路径',
        },
        operations: {
          type: 'array',
          description: '要执行的操作列表',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['replace', 'replaceAll', 'append'],
                description: '操作类型',
              },
              search: {
                type: 'string',
                description: '要搜索的文本（replace 和 replaceAll 操作需要）',
              },
              replacement: {
                type: 'string',
                description: '替换的文本（replace 和 replaceAll 操作需要）',
              },
              content: {
                type: 'string',
                description: 'Markdown 格式的追加内容（append 操作需要）',
              },
            },
          },
        },
      },
      required: ['file_path', 'operations'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const operations = args.operations as Array<Record<string, unknown>>;

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // 检查文件是否存在
      try {
        await fs.access(absolutePath);
      } catch {
        return {
          success: false,
          output: '',
          error: `文件不存在: ${absolutePath}`,
        };
      }

      // 读取文件内容
      const fileBuffer = await fs.readFile(absolutePath);

      // 使用 mammoth 提取文本
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      let text = result.value;

      const results: string[] = [];
      const appendContent: string[] = [];

      // 执行操作
      for (const operation of operations) {
        const opType = operation.type as string;

        switch (opType) {
          case 'replace': {
            const search = operation.search as string;
            const replacement = operation.replacement as string;

            if (!search) {
              results.push('replace: 缺少 search 参数');
              break;
            }

            const index = text.indexOf(search);
            if (index !== -1) {
              text = text.substring(0, index) + replacement + text.substring(index + search.length);
              results.push(`replace: 替换了 "${search}" -> "${replacement}"`);
            } else {
              results.push(`replace: 未找到 "${search}"`);
            }
            break;
          }

          case 'replaceAll': {
            const search = operation.search as string;
            const replacement = operation.replacement as string;

            if (!search) {
              results.push('replaceAll: 缺少 search 参数');
              break;
            }

            const regex = new RegExp(escapeRegExp(search), 'g');
            const matches = text.match(regex);
            const count = matches ? matches.length : 0;

            if (count > 0) {
              text = text.replace(regex, replacement);
              results.push(`replaceAll: 替换了 ${count} 处 "${search}" -> "${replacement}"`);
            } else {
              results.push(`replaceAll: 未找到 "${search}"`);
            }
            break;
          }

          case 'append': {
            const content = operation.content as string;
            if (content) {
              appendContent.push(content);
              results.push(`append: 将追加 ${content.length} 字符的内容`);
            } else {
              results.push('append: 缺少 content 参数');
            }
            break;
          }

          default:
            results.push(`未知操作类型: ${opType}`);
        }
      }

      // 重建文档
      const children: Paragraph[] = [];

      // 解析原有文本为段落
      const paragraphs = text.split(/\n\n+/);
      for (const para of paragraphs) {
        if (para.trim()) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: para.trim(),
                  size: 24,
                  font: 'Microsoft YaHei',
                }),
              ],
              spacing: { after: 200, line: 360 },
            })
          );
        }
      }

      // 处理追加内容
      if (appendContent.length > 0) {
        // 添加分隔空行
        children.push(new Paragraph({ spacing: { after: 400 } }));

        for (const markdown of appendContent) {
          const appendParagraphs = parseMarkdownToParagraphs(markdown);
          children.push(...appendParagraphs);
        }
      }

      // 创建新文档
      const doc = new Document({
        creator: 'LSC AI',
        description: '由 LSC AI 编辑的文档',
        sections: [
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
            children,
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 18,
                        color: '666666',
                      }),
                      new TextRun({
                        text: ' / ',
                        size: 18,
                        color: '666666',
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: 18,
                        color: '666666',
                      }),
                    ],
                  }),
                ],
              }),
            },
          },
        ],
      });

      // 保存文件
      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(absolutePath, buffer);

      return {
        success: true,
        output: `Word 文档已更新: ${absolutePath}\n\n操作结果:\n${results.map((r) => `- ${r}`).join('\n')}\n\n注意：文档已重建，原有复杂格式可能已简化。`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `编辑 Word 文档失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 解析 Markdown 为段落数组
 */
function parseMarkdownToParagraphs(markdown: string): Paragraph[] {
  const lines = markdown.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // 检测标题
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      const level = headingMatch[1].length;
      const fontSizeMap: Record<number, number> = { 1: 48, 2: 40, 3: 32, 4: 28, 5: 24, 6: 22 };

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: headingMatch[2],
              bold: true,
              size: fontSizeMap[level] || 24,
              font: 'Microsoft YaHei',
            }),
          ],
          spacing: { before: 300, after: 120 },
        })
      );
      continue;
    }

    // 检测列表项
    const listMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (listMatch) {
      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `• ${listMatch[1]}`,
              size: 24,
              font: 'Microsoft YaHei',
            }),
          ],
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // 检测有序列表
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `${orderedMatch[1]}. ${orderedMatch[2]}`,
              size: 24,
              font: 'Microsoft YaHei',
            }),
          ],
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // 普通段落
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

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold,
            italics: italic,
            size: 24,
            font: 'Microsoft YaHei',
          }),
        ],
        spacing: { after: 120, line: 360 },
        indent: { firstLine: 480 },
      })
    );
  }

  return paragraphs;
}
