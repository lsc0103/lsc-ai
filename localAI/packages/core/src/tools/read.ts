import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult } from './types.js';
import { fileTracker } from './fileTracker.js';
import { Errors } from './errors.js';

// 延迟加载 pdf-parse
let pdfParser: ((buffer: Buffer) => Promise<any>) | null = null;
async function getPdfParser() {
  if (!pdfParser) {
    try {
      const pdfParse = await import('pdf-parse');
      pdfParser = (pdfParse as any).default || pdfParse;
    } catch {
      return null;
    }
  }
  return pdfParser;
}

/**
 * 支持的图片扩展名及其 MIME 类型
 */
const IMAGE_EXTENSIONS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
};

/**
 * 支持的 PDF 扩展名
 */
const PDF_EXTENSION = '.pdf';

/**
 * 检查文件是否为图片
 */
function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext in IMAGE_EXTENSIONS;
}

/**
 * 获取图片的 MIME 类型
 */
function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS[ext] || 'image/png';
}

/**
 * 检查文件是否为 PDF
 */
function isPdfFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === PDF_EXTENSION;
}

/**
 * 文件读取工具
 * 支持文本文件、图片文件的读取
 */
export class ReadTool implements Tool {
  definition = {
    name: 'read',
    description: '读取文件内容。支持文本文件（返回带行号的内容）和图片文件（返回图片数据供视觉分析）。支持的图片格式：jpg、png、gif、webp、bmp、svg。',
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要读取的文件的绝对路径',
        },
        offset: {
          type: 'number',
          description: '从第几行开始读取（可选，默认从第1行开始，仅对文本文件有效）',
        },
        limit: {
          type: 'number',
          description: '读取的行数限制（可选，默认读取全部，仅对文本文件有效）',
        },
      },
      required: ['file_path'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const offset = (args.offset as number) || 0;
    const limit = args.limit as number | undefined;

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      // 检查文件是否存在
      await fs.access(absolutePath);

      // 处理图片文件
      if (isImageFile(absolutePath)) {
        const imageBuffer = await fs.readFile(absolutePath);
        const base64 = imageBuffer.toString('base64');
        const mimeType = getImageMimeType(absolutePath);

        return {
          success: true,
          output: `[图片文件: ${path.basename(absolutePath)}，大小: ${(imageBuffer.length / 1024).toFixed(1)}KB]`,
          image: {
            base64,
            mimeType,
          },
        };
      }

      // 处理 PDF 文件
      if (isPdfFile(absolutePath)) {
        try {
          const pdf = await getPdfParser();
          if (!pdf) {
            return {
              success: false,
              output: '',
              error: 'PDF 解析功能不可用（pdf-parse 未安装）',
            };
          }
          const pdfBuffer = await fs.readFile(absolutePath);
          const pdfData = await pdf(pdfBuffer);

          const info = [
            `[PDF 文件: ${path.basename(absolutePath)}]`,
            `页数: ${pdfData.numpages}`,
            pdfData.info?.Title ? `标题: ${pdfData.info.Title}` : null,
            pdfData.info?.Author ? `作者: ${pdfData.info.Author}` : null,
            '---',
          ].filter(Boolean).join('\n');

          // 应用 offset 和 limit
          const lines = pdfData.text.split('\n');
          const startLine = offset;
          const endLine = limit ? startLine + limit : lines.length;
          const selectedLines = lines.slice(startLine, endLine);

          return {
            success: true,
            output: info + '\n' + selectedLines.join('\n'),
          };
        } catch (pdfError) {
          return {
            success: false,
            output: '',
            error: `PDF 解析失败: ${(pdfError as Error).message}`,
          };
        }
      }

      // 处理文本文件
      const content = await fs.readFile(absolutePath, 'utf-8');

      // 记录文件状态（用于编辑冲突检测）
      await fileTracker.recordFileState(absolutePath, content);

      const lines = content.split('\n');

      const startLine = offset;
      const endLine = limit ? startLine + limit : lines.length;
      const selectedLines = lines.slice(startLine, endLine);

      // 添加行号
      const numberedContent = selectedLines
        .map((line, index) => `${String(startLine + index + 1).padStart(4, ' ')}\t${line}`)
        .join('\n');

      return {
        success: true,
        output: numberedContent,
      };
    } catch (error) {
      // 使用错误分类系统
      const toolError = Errors.fromError(error as Error);
      return {
        success: false,
        output: '',
        error: toolError.toToolResultError(),
      };
    }
  }
}
