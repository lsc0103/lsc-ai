/**
 * 撤销工具 - 支持撤销文件修改
 */

import * as fs from 'fs/promises';
import type { Tool, ToolResult } from './types.js';
import { fileTracker, type FileModification } from './fileTracker.js';
import { Errors } from './errors.js';

/**
 * 生成简单的文本 diff
 */
export function generateSimpleDiff(oldContent: string, newContent: string, maxLines: number = 20): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];

  let changes = 0;
  const maxI = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxI && changes < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === newLine) {
      continue;
    }

    if (oldLine !== undefined && newLine !== undefined) {
      // 修改
      diff.push(`@@ 行 ${i + 1} @@`);
      diff.push(`- ${oldLine}`);
      diff.push(`+ ${newLine}`);
      changes++;
    } else if (oldLine !== undefined) {
      // 删除
      diff.push(`@@ 行 ${i + 1} (删除) @@`);
      diff.push(`- ${oldLine}`);
      changes++;
    } else if (newLine !== undefined) {
      // 新增
      diff.push(`@@ 行 ${i + 1} (新增) @@`);
      diff.push(`+ ${newLine}`);
      changes++;
    }
  }

  if (changes >= maxLines) {
    diff.push(`... 还有更多变更 ...`);
  }

  return diff.length > 0 ? diff.join('\n') : '(无变更)';
}

/**
 * 撤销工具 - 撤销最近的文件修改
 */
export class UndoTool implements Tool {
  definition = {
    name: 'undo',
    description: '撤销最近的文件修改。可以指定文件路径撤销特定文件的修改，或不指定则撤销最后一次修改。',
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要撤销修改的文件路径（可选，不指定则撤销最后一次修改）',
        },
        preview: {
          type: 'boolean',
          description: '是否只预览撤销内容而不执行（默认 false）',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string | undefined;
    const previewOnly = args.preview as boolean || false;

    try {
      const undoInfo = fileTracker.getUndoInfo(filePath);

      if (!undoInfo.canUndo || !undoInfo.modification) {
        return {
          success: false,
          output: '',
          error: filePath
            ? `文件 "${filePath}" 没有可撤销的修改`
            : '没有可撤销的修改',
        };
      }

      const mod = undoInfo.modification;

      // 预览模式
      if (previewOnly) {
        let preview = `## 撤销预览\n\n`;
        preview += `**文件**: ${mod.path}\n`;
        preview += `**操作**: ${mod.type === 'create' ? '删除文件' : '恢复内容'}\n`;
        preview += `**修改时间**: ${new Date(mod.timestamp).toLocaleString()}\n\n`;

        if (mod.type === 'edit' && mod.beforeContent && mod.afterContent) {
          preview += `### 将恢复的内容\n\`\`\`\n`;
          preview += generateSimpleDiff(mod.afterContent, mod.beforeContent, 15);
          preview += `\n\`\`\``;
        } else if (mod.type === 'create') {
          preview += `### 操作\n将删除此文件`;
        }

        return {
          success: true,
          output: preview,
        };
      }

      // 执行撤销
      if (mod.type === 'create') {
        // 撤销创建 = 删除文件
        await fs.unlink(mod.path);
        fileTracker.clearFileState(mod.path);
        return {
          success: true,
          output: `已撤销文件创建: ${mod.path}\n文件已删除`,
        };
      }

      if (mod.type === 'edit' && undoInfo.restoreContent !== undefined) {
        // 撤销编辑 = 恢复原内容
        await fs.writeFile(mod.path, undoInfo.restoreContent, 'utf-8');

        // 更新文件追踪状态
        await fileTracker.recordFileState(mod.path, undoInfo.restoreContent);

        return {
          success: true,
          output: `已撤销文件编辑: ${mod.path}\n内容已恢复到修改前的状态`,
        };
      }

      return {
        success: false,
        output: '',
        error: '无法撤销此修改（缺少原始内容）',
      };
    } catch (error) {
      const toolError = Errors.fromError(error as Error);
      return {
        success: false,
        output: '',
        error: toolError.toToolResultError(),
      };
    }
  }
}

/**
 * 修改历史工具 - 查看文件修改历史
 */
export class ModificationHistoryTool implements Tool {
  definition = {
    name: 'history',
    description: '查看文件修改历史。可以查看特定文件的修改记录或所有文件的修改历史。',
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要查看历史的文件路径（可选，不指定则显示所有修改）',
        },
        limit: {
          type: 'number',
          description: '显示的最大记录数（默认 10）',
        },
      },
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string | undefined;
    const limit = (args.limit as number) || 10;

    try {
      const history = fileTracker.getModificationHistory(filePath);

      if (history.length === 0) {
        return {
          success: true,
          output: filePath
            ? `文件 "${filePath}" 没有修改记录`
            : '没有任何修改记录',
        };
      }

      const recent = history.slice(-limit).reverse();
      const lines: string[] = [`## 修改历史${filePath ? ` - ${filePath}` : ''}\n`];

      for (const mod of recent) {
        const time = new Date(mod.timestamp).toLocaleString();
        const typeLabel = { create: '创建', edit: '编辑', delete: '删除' }[mod.type];

        lines.push(`### ${time}`);
        lines.push(`- **操作**: ${typeLabel}`);
        lines.push(`- **文件**: \`${mod.path}\``);

        if (mod.beforeState && mod.afterState) {
          lines.push(`- **大小变化**: ${mod.beforeState.size} → ${mod.afterState.size} 字节`);
        }
        lines.push('');
      }

      // 添加统计
      const stats = fileTracker.getStats();
      lines.push(`---`);
      lines.push(`**总计**: ${stats.totalModifications} 次修改，${stats.trackedFiles} 个文件被追踪`);

      return {
        success: true,
        output: lines.join('\n'),
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `获取修改历史失败: ${(error as Error).message}`,
      };
    }
  }
}
