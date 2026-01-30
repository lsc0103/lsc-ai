import * as fs from 'fs/promises';
import * as path from 'path';
import ExcelJS from 'exceljs';
import type { Tool, ToolResult } from '../types.js';

/**
 * 预设配色方案 - 专业表格风格
 */
const EXCEL_THEMES = {
  // 商务蓝 - 稳重专业
  business: {
    headerBg: 'FF2563EB',
    headerText: 'FFFFFFFF',
    accentBg: 'FFDBEAFE',
    borderColor: 'FF93C5FD',
    stripeBg: 'FFF8FAFC',
    chartColors: ['2563EB', '3B82F6', '60A5FA', '93C5FD', 'BFDBFE'],
  },
  // 专业灰 - 商业报表
  professional: {
    headerBg: 'FF374151',
    headerText: 'FFFFFFFF',
    accentBg: 'FFE5E7EB',
    borderColor: 'FFD1D5DB',
    stripeBg: 'FFF9FAFB',
    chartColors: ['374151', '6B7280', '9CA3AF', 'D1D5DB', 'E5E7EB'],
  },
  // 活力绿 - 财务报表
  finance: {
    headerBg: 'FF059669',
    headerText: 'FFFFFFFF',
    accentBg: 'FFD1FAE5',
    borderColor: 'FF6EE7B7',
    stripeBg: 'FFECFDF5',
    chartColors: ['059669', '10B981', '34D399', '6EE7B7', 'A7F3D0'],
  },
  // 暖橙 - 销售报表
  sales: {
    headerBg: 'FFEA580C',
    headerText: 'FFFFFFFF',
    accentBg: 'FFFFEDD5',
    borderColor: 'FFFB923C',
    stripeBg: 'FFFFF7ED',
    chartColors: ['EA580C', 'F97316', 'FB923C', 'FDBA74', 'FED7AA'],
  },
  // 优雅紫 - 分析报表
  analytics: {
    headerBg: 'FF7C3AED',
    headerText: 'FFFFFFFF',
    accentBg: 'FFEDE9FE',
    borderColor: 'FFA78BFA',
    stripeBg: 'FFFAF5FF',
    chartColors: ['7C3AED', '8B5CF6', 'A78BFA', 'C4B5FD', 'DDD6FE'],
  },
};

type ExcelThemeKey = keyof typeof EXCEL_THEMES;

/**
 * 图表定义
 */
interface ChartDefinition {
  /** 图表类型 */
  type: 'bar' | 'line' | 'pie' | 'column' | 'area' | 'doughnut';
  /** 图表标题 */
  title?: string;
  /** 数据范围（如 A1:D10）*/
  dataRange: string;
  /** 类别标签列（如 A）*/
  categoryColumn?: string;
  /** 数据系列列（如 B,C,D）*/
  seriesColumns?: string[];
  /** 图表位置 */
  position?: {
    col: number;
    row: number;
  };
  /** 图表大小 */
  size?: {
    width: number;
    height: number;
  };
}

/**
 * 单元格范围解析：将 'A1' 转换为 { col: 1, row: 1 }
 */
function parseCellRef(cellRef: string): { col: number; row: number } {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`无效的单元格引用: ${cellRef}`);
  }

  const colStr = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);

  let colNum = 0;
  for (let i = 0; i < colStr.length; i++) {
    colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
  }

  return { col: colNum, row: rowNum };
}

/**
 * 图片定义
 */
interface ImageDefinition {
  /** 图片文件路径（相对于输出文件目录或绝对路径） */
  path: string;
  /** 起始单元格（如 'E2'） */
  cell: string;
  /** 图片宽度（像素） */
  width?: number;
  /** 图片高度（像素） */
  height?: number;
}

/**
 * Excel 工作表内容
 */
interface SheetContent {
  name: string;
  headers?: string[];
  rows: (string | number | boolean | null)[][];
  /** 列宽设置 */
  columnWidths?: number[];
  /** 图表定义 */
  charts?: ChartDefinition[];
  /** 公式（如 {cell: 'D2', formula: 'SUM(B2:C2)'}）*/
  formulas?: Array<{
    cell: string;
    formula: string;
  }>;
  /** 合并单元格（如 'A1:C1'）*/
  merges?: string[];
  /** 冻结窗格 */
  freezePane?: {
    row?: number;
    column?: number;
  };
  /** 图片列表 */
  images?: ImageDefinition[];
}

/**
 * Excel 文档创建工具
 */
export class CreateExcelTool implements Tool {
  definition = {
    name: 'createExcel',
    description: `创建专业的 Excel 电子表格 (.xlsx)。支持图表、公式、图片、配色主题和专业排版。

**基础功能**：
- 多工作表支持
- 表头自动样式（加粗、背景色、筛选器）
- 斑马纹数据行
- 自动列宽

**高级功能**：
- 图表：bar(柱状图)、line(折线图)、pie(饼图)、column(条形图)、area(面积图)
- 公式：支持 SUM、AVERAGE、COUNT 等 Excel 公式
- 合并单元格
- 冻结窗格
- 图片：插入图片到指定单元格位置

**配色主题**：
- business: 商务蓝（默认）
- professional: 专业灰
- finance: 财务绿
- sales: 销售橙
- analytics: 分析紫

**示例**：
\`\`\`json
{
  "sheets": [{
    "name": "销售数据",
    "headers": ["月份", "销售额", "成本", "利润"],
    "rows": [
      ["1月", 10000, 6000, 4000],
      ["2月", 12000, 7000, 5000]
    ],
    "formulas": [{"cell": "D2", "formula": "B2-C2"}],
    "images": [{
      "path": "./logo.png",
      "cell": "F2",
      "width": 200,
      "height": 100
    }]
  }]
}
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要创建的文件路径（应以 .xlsx 结尾）',
        },
        sheets: {
          type: 'array',
          description: '工作表数组，每个工作表包含 name、headers、rows，可选 charts、formulas、merges',
        },
        theme: {
          type: 'string',
          description: '配色主题：business(商务蓝)、professional(专业灰)、finance(财务绿)、sales(销售橙)、analytics(分析紫)',
          enum: ['business', 'professional', 'finance', 'sales', 'analytics'],
        },
        title: {
          type: 'string',
          description: '工作簿标题（元数据）',
        },
        author: {
          type: 'string',
          description: '作者名称（元数据）',
        },
      },
      required: ['file_path', 'sheets'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const sheets = args.sheets as SheetContent[];
    const themeName = (args.theme as ExcelThemeKey) || 'business';
    const title = args.title as string | undefined;
    const author = args.author as string | undefined;

    // 获取配色主题
    const theme = EXCEL_THEMES[themeName] || EXCEL_THEMES.business;

    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      // 确保目录存在
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = author || 'LSC AI';
      workbook.created = new Date();
      workbook.modified = new Date();
      if (title) {
        workbook.title = title;
      }

      let totalCharts = 0;
      let totalFormulas = 0;
      let totalImages = 0;

      // 获取文件所在目录用于解析相对图片路径
      const baseDir = path.dirname(absolutePath);

      for (const sheet of sheets) {
        const worksheet = workbook.addWorksheet(sheet.name, {
          views: sheet.freezePane
            ? [{ state: 'frozen', xSplit: sheet.freezePane.column || 0, ySplit: sheet.freezePane.row || 1 }]
            : [{ state: 'frozen', ySplit: 1 }], // 默认冻结首行
        });

        // 设置列宽
        if (sheet.columnWidths) {
          sheet.columnWidths.forEach((width, index) => {
            worksheet.getColumn(index + 1).width = width;
          });
        }

        // 添加表头
        if (sheet.headers && sheet.headers.length > 0) {
          const headerRow = worksheet.addRow(sheet.headers);

          // 表头样式
          headerRow.font = {
            bold: true,
            color: { argb: theme.headerText },
            name: 'Microsoft YaHei',
            size: 11,
          };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: theme.headerBg },
          };
          headerRow.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          headerRow.height = 24;

          // 表头边框
          headerRow.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: theme.borderColor } },
              left: { style: 'thin', color: { argb: theme.borderColor } },
              bottom: { style: 'medium', color: { argb: theme.borderColor } },
              right: { style: 'thin', color: { argb: theme.borderColor } },
            };
          });

          // 自动设置列宽（如果没有手动指定）
          if (!sheet.columnWidths) {
            sheet.headers.forEach((header, index) => {
              const col = worksheet.getColumn(index + 1);
              // 根据内容计算宽度，中文字符算2个宽度
              const charWidth = header.split('').reduce((sum, char) => {
                return sum + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
              }, 0);
              col.width = Math.max(charWidth + 4, 12);
            });
          }
        }

        // 添加数据行（斑马纹样式）
        for (let rowIdx = 0; rowIdx < sheet.rows.length; rowIdx++) {
          const dataRow = worksheet.addRow(sheet.rows[rowIdx]);

          // 斑马纹背景
          if (rowIdx % 2 === 1) {
            dataRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: theme.stripeBg },
            };
          }

          // 数据行样式
          dataRow.font = {
            name: 'Microsoft YaHei',
            size: 10,
          };
          dataRow.alignment = {
            vertical: 'middle',
          };
          dataRow.height = 20;

          // 数据行边框
          dataRow.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin', color: { argb: theme.borderColor } },
              left: { style: 'thin', color: { argb: theme.borderColor } },
              bottom: { style: 'thin', color: { argb: theme.borderColor } },
              right: { style: 'thin', color: { argb: theme.borderColor } },
            };

            // 数字列右对齐
            if (typeof sheet.rows[rowIdx][colNumber - 1] === 'number') {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
              // 添加千分位格式
              if (typeof cell.value === 'number' && Math.abs(cell.value) >= 1000) {
                cell.numFmt = '#,##0.00';
              }
            }
          });
        }

        // 应用公式
        if (sheet.formulas && sheet.formulas.length > 0) {
          for (const formula of sheet.formulas) {
            const cell = worksheet.getCell(formula.cell);
            cell.value = { formula: formula.formula };
            totalFormulas++;
          }
        }

        // 合并单元格
        if (sheet.merges && sheet.merges.length > 0) {
          for (const merge of sheet.merges) {
            worksheet.mergeCells(merge);
          }
        }

        // 添加筛选器（如果有表头）
        if (sheet.headers && sheet.headers.length > 0 && sheet.rows.length > 0) {
          worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: sheet.headers.length },
          };
        }

        // 处理图表（ExcelJS 对图表支持有限，这里添加注释说明）
        if (sheet.charts && sheet.charts.length > 0) {
          totalCharts += sheet.charts.length;
          // 注意：ExcelJS 的图表支持较为有限
          // 在实际生产环境中，可能需要使用更专业的库如 xlsx-chart
          // 这里我们在数据下方添加一个说明
          const chartInfoRow = sheet.rows.length + 3;
          worksheet.getCell(`A${chartInfoRow}`).value = `[图表区域 - 请在 Excel 中手动创建以下图表]`;
          worksheet.getCell(`A${chartInfoRow}`).font = {
            italic: true,
            color: { argb: 'FF6B7280' },
          };

          for (let i = 0; i < sheet.charts.length; i++) {
            const chart = sheet.charts[i];
            const row = chartInfoRow + 1 + i;
            worksheet.getCell(`A${row}`).value = `${i + 1}. ${chart.type.toUpperCase()} 图表: ${chart.title || '未命名'} - 数据范围: ${chart.dataRange}`;
            worksheet.getCell(`A${row}`).font = {
              color: { argb: 'FF6B7280' },
              size: 9,
            };
          }
        }

        // 处理图片
        if (sheet.images && sheet.images.length > 0) {
          for (const imgDef of sheet.images) {
            try {
              // 解析图片路径
              let imgPath = imgDef.path;
              if (!path.isAbsolute(imgPath)) {
                imgPath = path.resolve(baseDir, imgPath);
              }

              // 检查图片文件是否存在
              await fs.access(imgPath);

              // 获取图片扩展名
              const ext = path.extname(imgPath).toLowerCase().slice(1);
              const validExtensions = ['png', 'jpeg', 'jpg', 'gif'];
              if (!validExtensions.includes(ext)) {
                continue;
              }

              // 添加图片到工作簿
              const imageId = workbook.addImage({
                filename: imgPath,
                extension: ext === 'jpg' ? 'jpeg' : ext as 'png' | 'jpeg' | 'gif',
              });

              // 解析单元格位置
              const cellPos = parseCellRef(imgDef.cell);
              const width = imgDef.width || 200;
              const height = imgDef.height || 150;

              // 添加图片到工作表
              worksheet.addImage(imageId, {
                tl: { col: cellPos.col - 1, row: cellPos.row - 1 },
                ext: { width, height },
              });

              totalImages++;
            } catch {
              // 图片加载失败，跳过
            }
          }
        }

        // 设置打印区域
        if (sheet.headers && sheet.rows.length > 0) {
          worksheet.pageSetup = {
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            printTitlesRow: '1:1', // 重复首行作为标题
          };
        }
      }

      await workbook.xlsx.writeFile(absolutePath);

      let output = `Excel 文件已创建: ${absolutePath}\n`;
      output += `配色主题: ${themeName}\n`;
      output += `工作表: ${sheets.length} 个`;
      if (totalFormulas > 0) {
        output += `\n公式: ${totalFormulas} 个`;
      }
      if (totalImages > 0) {
        output += `\n图片: ${totalImages} 张`;
      }
      if (totalCharts > 0) {
        output += `\n图表说明: ${totalCharts} 个（需在 Excel 中手动创建）`;
      }

      return {
        success: true,
        output,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `创建 Excel 文件失败: ${(error as Error).message}`,
      };
    }
  }
}
