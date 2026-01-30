/**
 * Jupyter Notebook 编辑工具
 * 支持编辑 .ipynb 文件的单元格
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult } from './types.js';

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
  id?: string;
}

interface NotebookContent {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

export class NotebookEditTool implements Tool {
  definition = {
    name: 'notebookEdit',
    description: '编辑 Jupyter Notebook (.ipynb) 文件的单元格。支持替换、插入、删除单元格。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Notebook 文件路径（.ipynb）',
        },
        cell_index: {
          type: 'number',
          description: '要操作的单元格索引（从 0 开始）',
        },
        action: {
          type: 'string',
          enum: ['replace', 'insert', 'delete'],
          description: '操作类型：replace（替换）、insert（插入）、delete（删除）',
        },
        cell_type: {
          type: 'string',
          enum: ['code', 'markdown'],
          description: '单元格类型（insert/replace 时需要）',
        },
        content: {
          type: 'string',
          description: '单元格内容（insert/replace 时需要）',
        },
      },
      required: ['path', 'cell_index', 'action'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const notebookPath = args.path as string;
    const cellIndex = args.cell_index as number;
    const action = args.action as 'replace' | 'insert' | 'delete';
    const cellType = (args.cell_type as 'code' | 'markdown') || 'code';
    const content = args.content as string | undefined;

    // 验证文件扩展名
    if (!notebookPath.endsWith('.ipynb')) {
      return {
        success: false,
        output: '',
        error: '文件必须是 .ipynb 格式',
      };
    }

    try {
      // 读取 notebook
      const absolutePath = path.isAbsolute(notebookPath)
        ? notebookPath
        : path.resolve(process.cwd(), notebookPath);

      let notebook: NotebookContent;

      try {
        const fileContent = await fs.readFile(absolutePath, 'utf-8');
        notebook = JSON.parse(fileContent);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          // 文件不存在，创建新 notebook
          notebook = {
            cells: [],
            metadata: {
              kernelspec: {
                display_name: 'Python 3',
                language: 'python',
                name: 'python3',
              },
            },
            nbformat: 4,
            nbformat_minor: 5,
          };
        } else {
          throw err;
        }
      }

      // 验证索引
      if (action !== 'insert' && (cellIndex < 0 || cellIndex >= notebook.cells.length)) {
        return {
          success: false,
          output: '',
          error: `单元格索引 ${cellIndex} 超出范围（共 ${notebook.cells.length} 个单元格）`,
        };
      }

      // 执行操作
      let resultMessage = '';

      switch (action) {
        case 'replace':
          if (content === undefined) {
            return { success: false, output: '', error: 'replace 操作需要 content 参数' };
          }
          notebook.cells[cellIndex] = this.createCell(cellType, content);
          resultMessage = `已替换单元格 ${cellIndex}`;
          break;

        case 'insert':
          if (content === undefined) {
            return { success: false, output: '', error: 'insert 操作需要 content 参数' };
          }
          const newCell = this.createCell(cellType, content);
          notebook.cells.splice(cellIndex, 0, newCell);
          resultMessage = `已在位置 ${cellIndex} 插入新单元格`;
          break;

        case 'delete':
          notebook.cells.splice(cellIndex, 1);
          resultMessage = `已删除单元格 ${cellIndex}`;
          break;
      }

      // 写回文件
      await fs.writeFile(absolutePath, JSON.stringify(notebook, null, 2), 'utf-8');

      return {
        success: true,
        output: `${resultMessage}（共 ${notebook.cells.length} 个单元格）`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Notebook 编辑失败: ${(error as Error).message}`,
      };
    }
  }

  private createCell(cellType: 'code' | 'markdown', content: string): NotebookCell {
    const source = content.split('\n').map((line, i, arr) =>
      i < arr.length - 1 ? line + '\n' : line
    );

    const cell: NotebookCell = {
      cell_type: cellType,
      source,
      metadata: {},
    };

    if (cellType === 'code') {
      cell.execution_count = null;
      cell.outputs = [];
    }

    return cell;
  }
}
