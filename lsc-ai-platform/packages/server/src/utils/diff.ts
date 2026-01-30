/**
 * 专业的 Diff 工具模块
 * 实现 Myers diff 算法的简化版本，生成高质量的差异输出
 */

/**
 * Diff 操作类型
 */
export type DiffOperation = 'equal' | 'insert' | 'delete';

/**
 * Diff 片段
 */
export interface DiffSegment {
  type: DiffOperation;
  value: string;
  oldStart?: number;
  oldEnd?: number;
  newStart?: number;
  newEnd?: number;
}

/**
 * Diff Hunk（差异块）
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{
    type: 'context' | 'add' | 'remove';
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
  }>;
}

/**
 * Unified Diff 输出
 */
export interface UnifiedDiff {
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

/**
 * 计算两个字符串数组的最长公共子序列（LCS）
 * 使用动态规划实现
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = (dp[i - 1]?.[j - 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]?.[j] ?? 0, dp[i]?.[j - 1] ?? 0);
      }
    }
  }

  return dp;
}

/**
 * 通过 LCS 矩阵回溯得到差异
 */
function backtrackDiff(
  oldLines: string[],
  newLines: string[],
  dp: number[][]
): Array<{ type: 'equal' | 'insert' | 'delete'; oldIdx?: number; newIdx?: number }> {
  const result: Array<{ type: 'equal' | 'insert' | 'delete'; oldIdx?: number; newIdx?: number }> = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'equal', oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || (dp[i]?.[j - 1] ?? 0) >= (dp[i - 1]?.[j] ?? 0))) {
      result.unshift({ type: 'insert', newIdx: j - 1 });
      j--;
    } else {
      result.unshift({ type: 'delete', oldIdx: i - 1 });
      i--;
    }
  }

  return result;
}

/**
 * 计算行级别的差异
 */
export function diffLines(oldText: string, newText: string): UnifiedDiff {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const dp = computeLCS(oldLines, newLines);
  const changes = backtrackDiff(oldLines, newLines, dp);

  // 统计
  let additions = 0;
  let deletions = 0;

  // 将变化分组为 hunks
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  const contextLines = 3; // 上下文行数

  for (let idx = 0; idx < changes.length; idx++) {
    const change = changes[idx];
    if (!change) continue;

    const isChange = change.type !== 'equal';

    if (isChange) {
      // 需要开始或继续一个 hunk
      if (!currentHunk) {
        // 开始新的 hunk，包含之前的上下文
        const contextStart = Math.max(0, idx - contextLines);
        currentHunk = {
          oldStart: -1,
          oldLines: 0,
          newStart: -1,
          newLines: 0,
          lines: [],
        };

        // 添加之前的上下文行
        for (let c = contextStart; c < idx; c++) {
          const ctx = changes[c];
          if (ctx && ctx.type === 'equal' && ctx.oldIdx !== undefined && ctx.newIdx !== undefined) {
            const oldLine = oldLines[ctx.oldIdx];
            if (oldLine !== undefined) {
              if (currentHunk.oldStart === -1) {
                currentHunk.oldStart = ctx.oldIdx + 1;
                currentHunk.newStart = ctx.newIdx + 1;
              }
              currentHunk.lines.push({
                type: 'context',
                content: oldLine,
                oldLineNum: ctx.oldIdx + 1,
                newLineNum: ctx.newIdx + 1,
              });
              currentHunk.oldLines++;
              currentHunk.newLines++;
            }
          }
        }
      }

      // 添加变更行
      if (change.type === 'delete' && change.oldIdx !== undefined) {
        const oldLine = oldLines[change.oldIdx];
        if (oldLine !== undefined) {
          if (currentHunk.oldStart === -1) {
            currentHunk.oldStart = change.oldIdx + 1;
            currentHunk.newStart = (changes[idx + 1]?.newIdx ?? change.oldIdx) + 1;
          }
          currentHunk.lines.push({
            type: 'remove',
            content: oldLine,
            oldLineNum: change.oldIdx + 1,
          });
          currentHunk.oldLines++;
          deletions++;
        }
      } else if (change.type === 'insert' && change.newIdx !== undefined) {
        const newLine = newLines[change.newIdx];
        if (newLine !== undefined) {
          if (currentHunk.oldStart === -1) {
            currentHunk.oldStart = (changes[idx - 1]?.oldIdx ?? 0) + 1;
            currentHunk.newStart = change.newIdx + 1;
          }
          currentHunk.lines.push({
            type: 'add',
            content: newLine,
            newLineNum: change.newIdx + 1,
          });
          currentHunk.newLines++;
          additions++;
        }
      }
    } else if (currentHunk) {
      // 在 hunk 中添加上下文
      // 检查是否应该结束当前 hunk
      let nextChangeIdx = -1;
      for (let n = idx + 1; n < changes.length && n <= idx + contextLines * 2; n++) {
        const nextChange = changes[n];
        if (nextChange && nextChange.type !== 'equal') {
          nextChangeIdx = n;
          break;
        }
      }

      if (nextChangeIdx === -1 || nextChangeIdx - idx > contextLines * 2) {
        // 结束当前 hunk，添加尾部上下文
        const endContext = Math.min(idx + contextLines, changes.length);
        for (let c = idx; c < endContext; c++) {
          const ctx = changes[c];
          if (ctx && ctx.type === 'equal' && ctx.oldIdx !== undefined && ctx.newIdx !== undefined) {
            const oldLine = oldLines[ctx.oldIdx];
            if (oldLine !== undefined) {
              currentHunk.lines.push({
                type: 'context',
                content: oldLine,
                oldLineNum: ctx.oldIdx + 1,
                newLineNum: ctx.newIdx + 1,
              });
              currentHunk.oldLines++;
              currentHunk.newLines++;
            }
          }
        }
        hunks.push(currentHunk);
        currentHunk = null;
      } else if (change && change.oldIdx !== undefined && change.newIdx !== undefined) {
        // 继续 hunk
        const oldLine = oldLines[change.oldIdx];
        if (oldLine !== undefined) {
          currentHunk.lines.push({
            type: 'context',
            content: oldLine,
            oldLineNum: change.oldIdx + 1,
            newLineNum: change.newIdx + 1,
          });
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      }
    }
  }

  // 处理最后一个 hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return {
    hunks,
    stats: {
      additions,
      deletions,
      changes: additions + deletions,
    },
  };
}

/**
 * 格式化为 Unified Diff 字符串
 */
export function formatUnifiedDiff(
  diff: UnifiedDiff,
  options?: {
    oldFileName?: string;
    newFileName?: string;
    showLineNumbers?: boolean;
    colorize?: boolean;
  }
): string {
  const { oldFileName = 'a', newFileName = 'b' } = options || {};
  const lines: string[] = [];

  // 文件头
  lines.push(`--- ${oldFileName}`);
  lines.push(`+++ ${newFileName}`);

  for (const hunk of diff.hunks) {
    // Hunk 头
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

    for (const line of hunk.lines) {
      let prefix: string;

      switch (line.type) {
        case 'add':
          prefix = '+';
          break;
        case 'remove':
          prefix = '-';
          break;
        default:
          prefix = ' ';
      }

      lines.push(`${prefix}${line.content}`);
    }
  }

  return lines.join('\n');
}

/**
 * 生成简洁的差异摘要
 */
export function formatDiffSummary(diff: UnifiedDiff): string {
  const { additions, deletions } = diff.stats;
  const parts: string[] = [];

  if (additions > 0) {
    parts.push(`+${additions}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }

  if (parts.length === 0) {
    return '无变更';
  }

  return parts.join(', ');
}

/**
 * 计算两个字符串的简单差异（用于行内对比）
 */
export function diffWords(oldStr: string, newStr: string): DiffSegment[] {
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  const dp = computeLCS(oldWords, newWords);
  const changes = backtrackDiff(oldWords, newWords, dp);

  const result: DiffSegment[] = [];
  let current: DiffSegment | null = null;

  for (const change of changes) {
    const type = change.type;
    const value = type === 'delete' && change.oldIdx !== undefined
      ? oldWords[change.oldIdx] ?? ''
      : type === 'insert' && change.newIdx !== undefined
        ? newWords[change.newIdx] ?? ''
        : change.oldIdx !== undefined
          ? oldWords[change.oldIdx] ?? ''
          : '';

    if (current && current.type === type) {
      current.value += value;
    } else {
      if (current) result.push(current);
      current = { type, value };
    }
  }

  if (current) result.push(current);

  return result;
}

/**
 * 检查两个文本是否相同
 */
export function areTextsEqual(oldText: string, newText: string): boolean {
  return oldText === newText;
}

/**
 * 快速计算变更统计（不生成完整 diff）
 */
export function quickDiffStats(oldText: string, newText: string): { additions: number; deletions: number } {
  if (oldText === newText) {
    return { additions: 0, deletions: 0 };
  }

  const oldLines = new Set(oldText.split('\n'));
  const newLines = new Set(newText.split('\n'));

  let additions = 0;
  let deletions = 0;

  for (const line of newText.split('\n')) {
    if (!oldLines.has(line)) additions++;
  }
  for (const line of oldText.split('\n')) {
    if (!newLines.has(line)) deletions++;
  }

  return { additions, deletions };
}
