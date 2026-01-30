import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Tool, ToolResult, DiffPreview } from './types.js';
import { fileTracker } from './fileTracker.js';
import { Errors } from './errors.js';
import { diffLines, formatUnifiedDiff, quickDiffStats } from '../../utils/diff.js';

/**
 * 生成精简的 diff 预览（用于执行结果展示）
 * 使用专业的 LCS diff 算法
 */
function generateDiffPreview(oldContent: string, newContent: string, maxLines: number = 10): string {
  const diff = diffLines(oldContent, newContent);

  if (diff.hunks.length === 0) {
    return '无变更';
  }

  const lines: string[] = [];
  let lineCount = 0;

  for (const hunk of diff.hunks) {
    if (lineCount >= maxLines) break;

    // 添加 hunk 头
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    lineCount++;

    for (const line of hunk.lines) {
      if (lineCount >= maxLines) break;

      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      const content = line.content.length > 80
        ? line.content.slice(0, 77) + '...'
        : line.content;
      lines.push(`${prefix}${content}`);
      lineCount++;
    }
  }

  if (lineCount >= maxLines) {
    lines.push(`... 还有更多变更 (+${diff.stats.additions}/-${diff.stats.deletions})`);
  }

  return lines.join('\n');
}

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
 * 计算两个字符串的相似度（Levenshtein 距离的归一化版本）
 */
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  // 简化版：基于公共子串
  const lowerLonger = longer.toLowerCase();
  const lowerShorter = shorter.toLowerCase();

  if (lowerLonger.includes(lowerShorter)) {
    return shorter.length / longer.length;
  }

  // 计算公共字符比例
  let matches = 0;
  const chars = new Set(lowerShorter.split(''));
  for (const char of lowerLonger) {
    if (chars.has(char)) matches++;
  }

  return matches / longer.length;
}

/**
 * 查找文件中与目标文本相似的行
 */
function findSimilarLines(content: string, target: string, maxResults = 3): Array<{lineNum: number; line: string; similarity: number}> {
  const lines = content.split('\n');
  const targetFirstLine = target.split('\n')[0]?.trim() || '';

  const results: Array<{lineNum: number; line: string; similarity: number}> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const similarity = stringSimilarity(line.trim(), targetFirstLine);

    if (similarity > 0.3) {
      results.push({ lineNum: i + 1, line: line.substring(0, 100), similarity });
    }
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * 精准编辑工具 - 基于字符串替换实现精准修改
 */
export class EditTool implements Tool {
  definition = {
    name: 'edit',
    description: '编辑文件。支持两种模式：1）字符串匹配模式：指定 old_string 和 new_string 进行精确替换；2）行号模式：指定 start_line（和可选的 end_line）直接替换指定行。如果字符串匹配失败，会显示相似的行帮助定位。',
    parameters: {
      type: 'object' as const,
      properties: {
        file_path: {
          type: 'string',
          description: '要编辑的文件的绝对路径',
        },
        old_string: {
          type: 'string',
          description: '要被替换的原始文本（必须精确匹配，包括空格和换行符）。如果使用行号模式则可省略。',
        },
        new_string: {
          type: 'string',
          description: '替换后的新文本',
        },
        replace_all: {
          type: 'boolean',
          description: '是否替换所有匹配项（默认false，只替换第一个）',
        },
        start_line: {
          type: 'number',
          description: '（行号模式）起始行号（从1开始）。使用行号模式时，将替换从 start_line 到 end_line 的内容。',
        },
        end_line: {
          type: 'number',
          description: '（行号模式）结束行号（包含该行）。如果省略，则只替换 start_line 那一行。',
        },
      },
      required: ['file_path', 'new_string'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = args.file_path as string;
    const oldString = args.old_string as string | undefined;
    const newString = args.new_string as string;
    const replaceAll = args.replace_all as boolean || false;
    const startLine = args.start_line as number | undefined;
    const endLine = args.end_line as number | undefined;

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      // 检查文件是否被外部修改（冲突检测）
      const conflictCheck = await fileTracker.checkConflict(absolutePath);
      if (conflictCheck.hasConflict) {
        const error = Errors.conflict(
          `文件已被外部${conflictCheck.conflictType === 'deleted' ? '删除' : '修改'}，无法安全编辑`,
          {
            path: absolutePath,
            expected: conflictCheck.recordedState?.hash.substring(0, 8),
            actual: conflictCheck.currentState?.hash.substring(0, 8),
          }
        );
        return {
          success: false,
          output: '',
          error: error.toToolResultError(),
        };
      }

      // 读取文件内容
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          return {
            success: false,
            output: '',
            error: Errors.notFound(`文件不存在: ${absolutePath}`, absolutePath).toToolResultError(),
          };
        }
        if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
          return {
            success: false,
            output: '',
            error: Errors.permission(`没有权限读取文件: ${absolutePath}`, absolutePath).toToolResultError(),
          };
        }
        throw error;
      }

      // 保存修改前的内容用于历史记录
      const beforeContent = content;

      // 行号模式
      if (startLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine - 1; // 转换为0索引
        const end = endLine !== undefined ? endLine : startLine; // 默认只替换一行

        if (start < 0 || start >= lines.length) {
          return {
            success: false,
            output: '',
            error: `起始行号 ${startLine} 超出范围（文件共 ${lines.length} 行）`,
          };
        }

        if (end < start || end > lines.length) {
          return {
            success: false,
            output: '',
            error: `结束行号 ${endLine} 无效（应在 ${startLine} 到 ${lines.length} 之间）`,
          };
        }

        // 替换指定行
        const newLines = newString.split('\n');
        lines.splice(start, end - start, ...newLines);

        const newContent = lines.join('\n');
        await atomicWriteFile(absolutePath, newContent);

        // 记录修改历史
        await fileTracker.recordModification(absolutePath, 'edit', {
          beforeContent,
          afterContent: newContent,
        });

        return {
          success: true,
          output: `文件已修改: ${absolutePath}\n替换了第 ${startLine}${endLine && endLine !== startLine ? `-${endLine}` : ''} 行`,
        };
      }

      // 字符串匹配模式（需要 old_string）
      if (!oldString) {
        return {
          success: false,
          output: '',
          error: '必须提供 old_string 或使用行号模式（start_line）',
        };
      }

      // 检查是否找到匹配
      const matchCount = content.split(oldString).length - 1;

      if (matchCount === 0) {
        // 查找相似的行来帮助调试
        const similarLines = findSimilarLines(content, oldString);
        let hint = '';

        if (similarLines.length > 0) {
          hint = '\n\n可能相似的行:\n' + similarLines
            .map(l => `  第${l.lineNum}行: ${l.line}${l.line.length >= 100 ? '...' : ''}`)
            .join('\n');
          hint += '\n\n提示: 请确保 old_string 与文件内容完全一致（包括空格、缩进、换行符）';
        }

        return {
          success: false,
          output: '',
          error: `未找到匹配的文本: "${oldString.substring(0, 80)}${oldString.length > 80 ? '...' : ''}"${hint}`,
        };
      }

      if (matchCount > 1 && !replaceAll) {
        return {
          success: false,
          output: '',
          error: `找到 ${matchCount} 处匹配，请提供更精确的匹配文本或设置 replace_all: true`,
        };
      }

      // 执行替换
      let newContent: string;
      if (replaceAll) {
        newContent = content.split(oldString).join(newString);
      } else {
        newContent = content.replace(oldString, newString);
      }

      // 原子写入文件
      await atomicWriteFile(absolutePath, newContent);

      // 记录修改历史
      await fileTracker.recordModification(absolutePath, 'edit', {
        beforeContent,
        afterContent: newContent,
      });

      // 生成 diff 预览
      const replacedCount = replaceAll ? matchCount : 1;
      const diffPreview = generateDiffPreview(beforeContent, newContent, 8);

      return {
        success: true,
        output: `文件已修改: ${absolutePath}\n替换了 ${replacedCount} 处\n\n**变更预览:**\n\`\`\`diff\n${diffPreview}\n\`\`\``,
      };
    } catch (error) {
      // 使用错误分类系统处理异常
      const toolError = Errors.fromError(error as Error);
      return {
        success: false,
        output: '',
        error: toolError.toToolResultError(),
      };
    }
  }

  /**
   * 获取编辑预览（Diff 预览确认机制）
   * 在实际执行前生成预览，供用户确认
   */
  async getPreview(args: Record<string, unknown>): Promise<DiffPreview | null> {
    const filePath = args.file_path as string;
    const oldString = args.old_string as string | undefined;
    const newString = args.new_string as string;
    const replaceAll = args.replace_all as boolean || false;
    const startLine = args.start_line as number | undefined;
    const endLine = args.end_line as number | undefined;

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      // 读取原文件内容
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        return null; // 文件不存在，无法预览
      }

      let newContent: string;

      // 行号模式
      if (startLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine - 1;
        const end = endLine !== undefined ? endLine : startLine;

        if (start < 0 || start >= lines.length || end < start || end > lines.length) {
          return null;
        }

        const newLines = newString.split('\n');
        lines.splice(start, end - start, ...newLines);
        newContent = lines.join('\n');
      } else if (oldString) {
        // 字符串匹配模式
        const matchCount = content.split(oldString).length - 1;
        if (matchCount === 0) return null;

        if (replaceAll) {
          newContent = content.split(oldString).join(newString);
        } else {
          newContent = content.replace(oldString, newString);
        }
      } else {
        return null;
      }

      // 使用专业 diff 算法计算变更统计
      const stats = calculateDiffStats(content, newContent);

      return {
        filePath: absolutePath,
        operation: 'edit',
        beforeContent: content,
        afterContent: newContent,
        diffOutput: generateFullDiff(content, newContent, absolutePath),
        stats,
      };
    } catch {
      return null;
    }
  }
}

/**
 * 生成完整的 diff 输出（统一 diff 格式）
 * 使用专业的 LCS diff 算法生成标准 unified diff
 */
function generateFullDiff(oldContent: string, newContent: string, filePath?: string): string {
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
 * 计算 diff 统计信息
 * 使用专业的 LCS 算法进行精确统计
 */
function calculateDiffStats(oldContent: string, newContent: string): { additions: number; deletions: number } {
  return quickDiffStats(oldContent, newContent);
}
