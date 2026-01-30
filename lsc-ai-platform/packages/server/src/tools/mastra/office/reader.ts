import * as fs from 'fs/promises';
import * as path from 'path';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import type { Tool, ToolResult } from '../types.js';

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

// 延迟加载 JSZip
let JSZipModule: any = null;
async function getJSZip() {
  if (!JSZipModule) {
    try {
      const jszip = await import('jszip');
      JSZipModule = jszip.default || jszip;
    } catch {
      return null;
    }
  }
  return JSZipModule;
}

/**
 * Office 文件读取工具
 * 支持读取 Word (.docx)、Excel (.xlsx)、PDF (.pdf)、PowerPoint (.pptx) 文件
 */
export class ReadOfficeTool implements Tool {
  definition = {
    name: 'readOffice',
    description: `读取 Office 文档内容。返回文本和结构信息。

**支持的文件格式**：
- Word (.docx/.doc) - 提取文本内容
- Excel (.xlsx/.xls) - 提取表格数据，支持指定工作表
- PDF (.pdf) - 提取文本和元数据
- PowerPoint (.pptx) - 提取每页幻灯片的标题和内容

**使用示例**：
- 读取 Word：readOffice file_path="report.docx"
- 读取 Excel 特定表：readOffice file_path="data.xlsx" sheet_name="Sheet1"
- 读取 PPT：readOffice file_path="presentation.pptx"`,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要读取的文件路径',
        },
        sheet_name: {
          type: 'string',
          description: '（仅 Excel）要读取的工作表名称。如果不指定，读取所有工作表。',
        },
        max_rows: {
          type: 'number',
          description: '（仅 Excel）最大读取行数，默认 100',
        },
        max_slides: {
          type: 'number',
          description: '（仅 PPT）最大读取幻灯片数，默认 50',
        },
      },
      required: ['file_path'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const sheetName = args.sheet_name as string | undefined;
    const maxRows = (args.max_rows as number) || 100;
    const maxSlides = (args.max_slides as number) || 50;

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      const ext = path.extname(absolutePath).toLowerCase();

      switch (ext) {
        case '.docx':
        case '.doc':
          return await this.readWord(absolutePath);
        case '.xlsx':
        case '.xls':
          return await this.readExcel(absolutePath, sheetName, maxRows);
        case '.pdf':
          return await this.readPDF(absolutePath);
        case '.pptx':
          return await this.readPPT(absolutePath, maxSlides);
        default:
          return {
            success: false,
            output: '',
            error: `不支持的文件格式: ${ext}。支持的格式: .docx, .xlsx, .pdf, .pptx`,
          };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `读取文件失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 读取 Word 文档
   */
  private async readWord(filePath: string): Promise<ToolResult> {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      const warnings = result.messages.map((m) => m.message).join('; ');
      return {
        success: true,
        output: `[警告: ${warnings}]\n\n${result.value}`,
      };
    }

    return {
      success: true,
      output: result.value || '[文档为空]',
    };
  }

  /**
   * 读取 Excel 文件
   */
  private async readExcel(
    filePath: string,
    sheetName?: string,
    maxRows: number = 100
  ): Promise<ToolResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const outputs: string[] = [];

    const sheetsToRead = sheetName
      ? [workbook.getWorksheet(sheetName)].filter(Boolean)
      : workbook.worksheets;

    if (sheetsToRead.length === 0) {
      return {
        success: false,
        output: '',
        error: sheetName
          ? `未找到工作表: ${sheetName}`
          : '文件中没有工作表',
      };
    }

    for (const worksheet of sheetsToRead) {
      if (!worksheet) continue;

      outputs.push(`\n=== 工作表: ${worksheet.name} ===\n`);

      let rowCount = 0;
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowCount >= maxRows) return;

        const values = row.values as (string | number | boolean | null)[];
        // row.values 第一个元素是 undefined（1-indexed）
        const cellValues = values.slice(1).map((v) => {
          if (v === null || v === undefined) return '';
          if (typeof v === 'object' && 'text' in v) return (v as any).text;
          if (typeof v === 'object' && 'result' in v) return (v as any).result;
          return String(v);
        });

        outputs.push(`${rowNumber}: ${cellValues.join('\t')}`);
        rowCount++;
      });

      if (worksheet.rowCount > maxRows) {
        outputs.push(`\n... 还有 ${worksheet.rowCount - maxRows} 行未显示 ...`);
      }
    }

    return {
      success: true,
      output: outputs.join('\n'),
    };
  }

  /**
   * 读取 PDF 文件
   */
  private async readPDF(filePath: string): Promise<ToolResult> {
    const pdf = await getPdfParser();
    if (!pdf) {
      return {
        success: false,
        output: '',
        error: 'PDF 解析功能不可用（pdf-parse 未安装）',
      };
    }
    const buffer = await fs.readFile(filePath);
    const data = await pdf(buffer);

    const info = [
      `页数: ${data.numpages}`,
      `版本: ${data.info?.PDFFormatVersion || '未知'}`,
      data.info?.Title ? `标题: ${data.info.Title}` : null,
      data.info?.Author ? `作者: ${data.info.Author}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      output: `[PDF 信息]\n${info}\n\n[内容]\n${data.text}`,
    };
  }

  /**
   * 读取 PowerPoint 文件
   * PPTX 是 ZIP 格式，内部包含 XML 文件
   */
  private async readPPT(filePath: string, maxSlides: number = 50): Promise<ToolResult> {
    const JSZip = await getJSZip();
    if (!JSZip) {
      return {
        success: false,
        output: '',
        error: 'PPT 解析功能不可用（jszip 未安装）',
      };
    }

    const buffer = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const outputs: string[] = [];
    let slideCount = 0;

    // 获取所有幻灯片文件并排序
    const slideFiles: string[] = [];
    zip.forEach((relativePath: string) => {
      if (relativePath.match(/^ppt\/slides\/slide\d+\.xml$/)) {
        slideFiles.push(relativePath);
      }
    });

    // 按幻灯片编号排序
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
      return numA - numB;
    });

    // 读取每个幻灯片
    for (const slideFile of slideFiles) {
      if (slideCount >= maxSlides) break;

      const slideContent = await zip.file(slideFile)?.async('text');
      if (!slideContent) continue;

      slideCount++;
      const slideNum = slideFile.match(/slide(\d+)\.xml/)?.[1] || slideCount.toString();

      // 提取文本内容
      const texts = this.extractTextFromPPTXml(slideContent);

      outputs.push(`\n=== 幻灯片 ${slideNum} ===`);
      if (texts.title) {
        outputs.push(`标题: ${texts.title}`);
      }
      if (texts.content.length > 0) {
        outputs.push('内容:');
        texts.content.forEach((text) => outputs.push(`  • ${text}`));
      }
      if (texts.notes) {
        outputs.push(`备注: ${texts.notes}`);
      }
    }

    // 读取演示文稿属性
    let presentationInfo = '';
    const corePropsFile = zip.file('docProps/core.xml');
    if (corePropsFile) {
      const coreProps = await corePropsFile.async('text');
      const titleMatch = coreProps.match(/<dc:title>([^<]*)<\/dc:title>/);
      const authorMatch = coreProps.match(/<dc:creator>([^<]*)<\/dc:creator>/);
      const modifiedMatch = coreProps.match(/<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/);

      const props = [];
      if (titleMatch?.[1]) props.push(`标题: ${titleMatch[1]}`);
      if (authorMatch?.[1]) props.push(`作者: ${authorMatch[1]}`);
      if (modifiedMatch?.[1]) props.push(`修改时间: ${modifiedMatch[1]}`);
      props.push(`幻灯片数: ${slideCount}`);

      if (props.length > 0) {
        presentationInfo = `[演示文稿信息]\n${props.join('\n')}\n`;
      }
    }

    if (slideCount === 0) {
      return {
        success: false,
        output: '',
        error: '无法读取幻灯片内容，文件可能已损坏',
      };
    }

    if (slideFiles.length > maxSlides) {
      outputs.push(`\n... 还有 ${slideFiles.length - maxSlides} 张幻灯片未显示 ...`);
    }

    return {
      success: true,
      output: presentationInfo + outputs.join('\n'),
    };
  }

  /**
   * 从 PPTX XML 中提取文本
   */
  private extractTextFromPPTXml(xml: string): { title: string | null; content: string[]; notes: string | null } {
    const content: string[] = [];
    let title: string | null = null;

    // 提取所有 <a:t> 标签中的文本
    const textMatches = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
    const allTexts: string[] = [];
    for (const match of textMatches) {
      if (match && match[1]) {
        const text = match[1].trim();
        if (text) {
          allTexts.push(text);
        }
      }
    }

    // 第一个非空文本通常是标题
    if (allTexts.length > 0) {
      // 检查是否有标题占位符
      const hasTitlePlaceholder = xml.includes('type="title"') || xml.includes('type="ctrTitle"');
      const firstText = allTexts[0];
      if (hasTitlePlaceholder && firstText) {
        title = firstText;
        content.push(...allTexts.slice(1));
      } else if (firstText) {
        // 没有明确标题，将较短的第一段作为标题
        if (firstText.length < 100) {
          title = firstText;
          content.push(...allTexts.slice(1));
        } else {
          content.push(...allTexts);
        }
      }
    }

    // 合并相邻的短文本（同一段落的多个 <a:t>）
    const mergedContent: string[] = [];
    let currentPara = '';
    for (const text of content) {
      if (text.length < 20 && currentPara.length < 200) {
        currentPara += (currentPara ? ' ' : '') + text;
      } else {
        if (currentPara) {
          mergedContent.push(currentPara);
        }
        currentPara = text;
      }
    }
    if (currentPara) {
      mergedContent.push(currentPara);
    }

    return {
      title,
      content: mergedContent.filter((t) => t.length > 0),
      notes: null, // 备注需要从 notesSlides 目录读取
    };
  }
}
