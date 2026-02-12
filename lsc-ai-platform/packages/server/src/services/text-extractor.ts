/**
 * 文本提取工具类
 * 从不同格式的文件中提取纯文本内容
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 延迟加载 pdf-parse
 */
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
 * 根据 MIME 类型或文件扩展名提取文本
 *
 * @param filePath  文件的本地路径
 * @param mimeType  MIME 类型（可选，会根据扩展名推断）
 * @returns 提取的纯文本
 */
export async function extractText(filePath: string, mimeType?: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeType || guessMime(ext);

  if (mime === 'text/plain' || mime === 'text/markdown' || ext === '.txt' || ext === '.md') {
    return extractPlainText(filePath);
  }

  if (mime === 'application/pdf' || ext === '.pdf') {
    return extractPdf(filePath);
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    return extractDocx(filePath);
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === '.xlsx'
  ) {
    return extractXlsx(filePath);
  }

  throw new Error(`不支持的文件格式: ${ext} (${mime})`);
}

/**
 * 纯文本 / Markdown — 直接读取
 */
async function extractPlainText(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * PDF — 使用 pdf-parse
 */
async function extractPdf(filePath: string): Promise<string> {
  const parser = await getPdfParser();
  if (!parser) {
    throw new Error('PDF 解析依赖 pdf-parse 未安装');
  }
  const buffer = await fs.readFile(filePath);
  const data = await parser(buffer);
  return data.text || '';
}

/**
 * DOCX — 使用 mammoth
 */
async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.default.extractRawText({ buffer });
  return result.value || '';
}

/**
 * XLSX — 使用 exceljs，每个 sheet 转为文本表格
 */
async function extractXlsx(filePath: string): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const outputs: string[] = [];

  for (const worksheet of workbook.worksheets) {
    if (!worksheet) continue;
    outputs.push(`=== ${worksheet.name} ===`);

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as (string | number | boolean | null)[];
      const cells = values.slice(1).map((v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object' && 'text' in v) return (v as any).text;
        if (typeof v === 'object' && 'result' in v) return (v as any).result;
        return String(v);
      });
      outputs.push(cells.join('\t'));
    });

    outputs.push(''); // 空行分隔 sheet
  }

  return outputs.join('\n');
}

/**
 * 根据扩展名猜测 MIME 类型
 */
function guessMime(ext: string): string {
  const map: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] || 'application/octet-stream';
}
