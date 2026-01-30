import * as fs from 'fs/promises';
import * as path from 'path';
import ExcelJS from 'exceljs';
import type { Tool, ToolResult } from '../types.js';

/**
 * 单元格范围解析：将 'A1' 转换为 { col: 1, row: 1 }
 */
function parseCellRef(cellRef: string): { col: number; row: number } {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/i);
  if (!match || !match[1] || !match[2]) {
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
 * Excel 编辑工具 - 修改现有 Excel 文件
 */
export class EditExcelTool implements Tool {
  definition = {
    name: 'editExcel',
    description: `编辑现有的 Excel 文件 (.xlsx)。支持修改单元格、追加行、删除行、应用公式、添加工作表、插入图片。

**支持的操作**：
- setCells: 修改指定单元格的值
- addRows: 在末尾追加数据行
- insertRows: 在指定位置插入数据行
- deleteRows: 删除指定行
- applyFormulas: 为单元格设置公式
- addSheet: 添加新工作表
- insertImage: 在指定位置插入图片

**示例**：
\`\`\`json
{
  "file_path": "data.xlsx",
  "operations": [
    {
      "type": "setCells",
      "sheet": "Sheet1",
      "cells": [
        { "cell": "A1", "value": "新标题" },
        { "cell": "B2", "value": 12345 }
      ]
    },
    {
      "type": "addRows",
      "sheet": "Sheet1",
      "rows": [
        ["新行1", 100, 200],
        ["新行2", 150, 250]
      ]
    },
    {
      "type": "insertImage",
      "sheet": "Sheet1",
      "image": {
        "path": "./logo.png",
        "cell": "E2",
        "width": 200,
        "height": 100
      }
    }
  ]
}
\`\`\``,
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要编辑的 Excel 文件路径',
        },
        operations: {
          type: 'array',
          description: '要执行的操作列表',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['setCells', 'addRows', 'insertRows', 'deleteRows', 'applyFormulas', 'addSheet', 'insertImage'],
                description: '操作类型',
              },
              sheet: {
                type: 'string',
                description: '目标工作表名称（可选，默认第一个工作表）',
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

      // 读取现有工作簿
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(absolutePath);

      const results: string[] = [];
      const baseDir = path.dirname(absolutePath);

      for (const operation of operations) {
        const opType = operation.type as string;
        const sheetName = operation.sheet as string | undefined;

        // 获取目标工作表
        let worksheet = sheetName
          ? workbook.getWorksheet(sheetName)
          : workbook.worksheets[0];

        if (!worksheet && opType !== 'addSheet') {
          return {
            success: false,
            output: '',
            error: `工作表不存在: ${sheetName || '(默认)'}`,
          };
        }

        switch (opType) {
          case 'setCells': {
            const cells = operation.cells as Array<{
              cell: string;
              value: string | number | boolean | null;
              formula?: string;
            }>;

            for (const cellDef of cells) {
              const cell = worksheet!.getCell(cellDef.cell);
              if (cellDef.formula) {
                cell.value = { formula: cellDef.formula };
              } else {
                cell.value = cellDef.value;
              }
            }
            results.push(`setCells: 修改了 ${cells.length} 个单元格`);
            break;
          }

          case 'addRows': {
            const rows = operation.rows as Array<Array<string | number | boolean | null>>;
            for (const row of rows) {
              worksheet!.addRow(row);
            }
            results.push(`addRows: 追加了 ${rows.length} 行`);
            break;
          }

          case 'insertRows': {
            const startRow = operation.startRow as number;
            const rows = operation.rows as Array<Array<string | number | boolean | null>>;

            // ExcelJS 的 insertRows 方法
            worksheet!.insertRows(startRow, rows);
            results.push(`insertRows: 在第 ${startRow} 行插入了 ${rows.length} 行`);
            break;
          }

          case 'deleteRows': {
            const startRow = operation.startRow as number;
            const count = (operation.count as number) || 1;

            // 从后往前删除以保持行号正确
            for (let i = 0; i < count; i++) {
              worksheet!.spliceRows(startRow, 1);
            }
            results.push(`deleteRows: 删除了从第 ${startRow} 行开始的 ${count} 行`);
            break;
          }

          case 'applyFormulas': {
            const formulas = operation.formulas as Array<{
              cell: string;
              formula: string;
            }>;

            for (const formulaDef of formulas) {
              const cell = worksheet!.getCell(formulaDef.cell);
              cell.value = { formula: formulaDef.formula };
            }
            results.push(`applyFormulas: 应用了 ${formulas.length} 个公式`);
            break;
          }

          case 'addSheet': {
            const newSheetName = operation.name as string;
            const headers = operation.headers as string[] | undefined;
            const rows = operation.rows as Array<Array<string | number | boolean | null>> | undefined;

            const newWorksheet = workbook.addWorksheet(newSheetName);

            if (headers) {
              newWorksheet.addRow(headers);
              // 设置表头样式
              const headerRow = newWorksheet.getRow(1);
              headerRow.font = { bold: true };
              headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' },
              };
              headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            }

            if (rows) {
              for (const row of rows) {
                newWorksheet.addRow(row);
              }
            }

            results.push(`addSheet: 创建了工作表 "${newSheetName}"`);
            break;
          }

          case 'insertImage': {
            const imageDef = operation.image as {
              path: string;
              cell: string;
              width?: number;
              height?: number;
            };

            // 解析图片路径
            let imgPath = imageDef.path;
            if (!path.isAbsolute(imgPath)) {
              imgPath = path.resolve(baseDir, imgPath);
            }

            // 检查图片文件是否存在
            try {
              await fs.access(imgPath);
            } catch {
              results.push(`insertImage: 图片文件不存在 - ${imageDef.path}`);
              break;
            }

            // 获取图片扩展名
            const ext = path.extname(imgPath).toLowerCase().slice(1);
            const validExtensions = ['png', 'jpeg', 'jpg', 'gif'];
            if (!validExtensions.includes(ext)) {
              results.push(`insertImage: 不支持的图片格式 - ${ext}`);
              break;
            }

            // 添加图片到工作簿
            const imageId = workbook.addImage({
              filename: imgPath,
              extension: ext === 'jpg' ? 'jpeg' : ext as 'png' | 'jpeg' | 'gif',
            });

            // 解析单元格位置
            const cellPos = parseCellRef(imageDef.cell);
            const width = imageDef.width || 200;
            const height = imageDef.height || 150;

            // 添加图片到工作表
            worksheet!.addImage(imageId, {
              tl: { col: cellPos.col - 1, row: cellPos.row - 1 },
              ext: { width, height },
            });

            results.push(`insertImage: 在 ${imageDef.cell} 插入了图片`);
            break;
          }

          default:
            results.push(`未知操作类型: ${opType}`);
        }
      }

      // 保存文件
      await workbook.xlsx.writeFile(absolutePath);

      return {
        success: true,
        output: `Excel 文件已更新: ${absolutePath}\n\n操作结果:\n${results.map((r) => `- ${r}`).join('\n')}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `编辑 Excel 文件失败: ${(error as Error).message}`,
      };
    }
  }
}
