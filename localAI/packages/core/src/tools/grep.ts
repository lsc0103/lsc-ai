import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type { Tool, ToolResult } from './types.js';

/**
 * 内容搜索工具
 */
export class GrepTool implements Tool {
  definition = {
    name: 'grep',
    description: '在文件中搜索文本内容。支持正则表达式。默认搜索所有文件类型（包括 .vue, .ts, .js, .tsx, .jsx 等）。',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: '要搜索的文本或正则表达式',
        },
        path: {
          type: 'string',
          description: '搜索的目录路径（可选，默认为当前目录）',
        },
        file_pattern: {
          type: 'string',
          description: '文件过滤模式，如 "*.vue" 或 "*.{ts,vue,js}"（可选，默认搜索所有文件）',
        },
        ignore_case: {
          type: 'boolean',
          description: '是否忽略大小写（可选，默认 false）',
        },
      },
      required: ['pattern'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const searchPattern = args.pattern as string;
    const searchPath = (args.path as string) || process.cwd();
    let filePattern = (args.file_pattern as string) || '**/*';
    const ignoreCase = args.ignore_case as boolean || false;

    // 如果文件模式不以 ** 开头，自动添加以支持递归搜索
    if (filePattern && !filePattern.startsWith('**/') && !filePattern.startsWith('/')) {
      filePattern = `**/${filePattern}`;
    }

    try {
      const regex = new RegExp(searchPattern, ignoreCase ? 'gi' : 'g');

      // 获取所有匹配的文件
      const files = await glob(filePattern, {
        cwd: searchPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/*.min.js', '**/*.min.css'],
        nodir: true,
        absolute: true,
      });

      const results: string[] = [];
      let totalMatches = 0;

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              // 显示相对路径更清晰
              const relativePath = path.relative(searchPath, file);
              results.push(`${relativePath}:${i + 1}: ${lines[i].trim().substring(0, 150)}`);
              totalMatches++;
              // 重置正则状态
              regex.lastIndex = 0;
            }
          }
        } catch {
          // 跳过无法读取的文件（如二进制文件）
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `没有找到匹配 "${searchPattern}" 的内容`,
        };
      }

      // 限制输出行数
      const maxResults = 30;
      const output = results.slice(0, maxResults);
      if (results.length > maxResults) {
        output.push(`\n... 还有 ${results.length - maxResults} 处匹配，请缩小搜索范围`);
      }

      return {
        success: true,
        output: `找到 ${totalMatches} 处匹配:\n${output.join('\n')}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `搜索失败: ${(error as Error).message}`,
      };
    }
  }
}
