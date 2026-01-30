import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Tool, ToolResult, DiffPreview } from './types.js';
import { fileTracker } from './fileTracker.js';
import { diffLines, formatUnifiedDiff, quickDiffStats } from '../utils/diff.js';

/**
 * 原子写入文件（先写临时文件，再重命名）
 * 解决 VSCode 打开文件时的写入冲突问题
 */
async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tempFileName = `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tempPath = path.join(dir, tempFileName);

  try {
    // 写入临时文件
    await fs.writeFile(tempPath, content, 'utf-8');
    // 重命名为目标文件（原子操作）
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // 清理临时文件
    try {
      await fs.unlink(tempPath);
    } catch {
      // 忽略清理错误
    }
    throw error;
  }
}

/**
 * 文件写入工具
 */
export class WriteTool implements Tool {
  definition = {
    name: 'write',
    description: '写入文件内容。如果文件不存在则创建，如果存在则覆盖。会自动创建父目录。',
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要写入的文件的绝对路径',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
      },
      required: ['file_path', 'content'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const content = args.content as string;

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      const dir = path.dirname(absolutePath);

      // 检查文件是否已存在，记录原内容用于撤销
      let beforeContent: string | undefined;
      let isCreate = true;
      try {
        beforeContent = await fs.readFile(absolutePath, 'utf-8');
        isCreate = false;
      } catch {
        // 文件不存在，是新创建
      }

      // 确保目录存在
      await fs.mkdir(dir, { recursive: true });

      // 原子写入文件
      await atomicWriteFile(absolutePath, content);

      // 记录修改历史（支持撤销）
      if (isCreate) {
        await fileTracker.recordModification(absolutePath, 'create', {
          afterContent: content,
        });
      } else {
        await fileTracker.recordModification(absolutePath, 'edit', {
          beforeContent,
          afterContent: content,
        });
      }

      return {
        success: true,
        output: `文件已成功写入: ${absolutePath}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `无法写入文件: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取写入预览（Diff 预览确认机制）
   * 在实际执行前生成预览，供用户确认
   */
  async getPreview(args: Record<string, unknown>): Promise<DiffPreview | null> {
    const filePath = args.file_path as string;
    const content = args.content as string;

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      // 检查文件是否存在
      let beforeContent: string | undefined;
      let operation: 'create' | 'edit' = 'create';

      try {
        beforeContent = await fs.readFile(absolutePath, 'utf-8');
        operation = 'edit';
      } catch {
        // 文件不存在，是新建操作
      }

      // 生成 diff 输出
      let diffOutput: string;
      let stats: { additions: number; deletions: number };

      if (operation === 'create') {
        // 新建文件：显示所有内容为新增
        const lines = content.split('\n');
        diffOutput = `--- /dev/null\n+++ b/${absolutePath}\n@@ -0,0 +1,${lines.length} @@\n` +
          lines.map(line => `+${line}`).join('\n');
        stats = { additions: lines.length, deletions: 0 };
      } else {
        // 编辑文件：使用专业 diff 算法显示差异
        diffOutput = generateWriteDiff(beforeContent || '', content, absolutePath);
        stats = calculateWriteDiffStats(beforeContent || '', content);
      }

      return {
        filePath: absolutePath,
        operation,
        beforeContent,
        afterContent: content,
        diffOutput,
        stats,
      };
    } catch {
      return null;
    }
  }
}

/**
 * 生成写入操作的 diff 输出
 * 使用专业的 LCS diff 算法
 */
function generateWriteDiff(oldContent: string, newContent: string, filePath?: string): string {
  const diff = diffLines(oldContent, newContent);

  if (diff.hunks.length === 0) {
    return '无变更';
  }

  // 使用标准 unified diff 格式
  const output = formatUnifiedDiff(diff, {
    oldFileName: filePath ? `a/${filePath}` : 'a/file',
    newFileName: filePath ? `b/${filePath}` : 'b/file',
    showLineNumbers: false,
  });

  // 限制输出长度
  const lines = output.split('\n');
  const maxLines = 100;
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') +
      `\n... 还有 ${lines.length - maxLines} 行 (+${diff.stats.additions}/-${diff.stats.deletions})`;
  }

  return output;
}

/**
 * 计算写入操作的 diff 统计
 * 使用专业的 LCS 算法进行精确统计
 */
function calculateWriteDiffStats(oldContent: string, newContent: string): { additions: number; deletions: number } {
  return quickDiffStats(oldContent, newContent);
}
