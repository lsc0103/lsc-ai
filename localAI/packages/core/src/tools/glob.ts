import { glob } from 'glob';
import * as path from 'path';
import type { Tool, ToolResult } from './types.js';

/**
 * 文件搜索工具
 */
export class GlobTool implements Tool {
  definition = {
    name: 'glob',
    description: '使用 glob 模式搜索文件。支持 **/*.ts、src/**/*.js 等模式。',
    parameters: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'glob 匹配模式，如 "**/*.ts" 或 "src/**/*.js"',
        },
        cwd: {
          type: 'string',
          description: '搜索的根目录（可选，默认为当前目录）',
        },
      },
      required: ['pattern'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = args.pattern as string;
    const cwd = (args.cwd as string) || process.cwd();

    try {
      const files = await glob(pattern, {
        cwd,
        ignore: ['**/node_modules/**', '**/.git/**'],
        nodir: true,
      });

      if (files.length === 0) {
        return {
          success: true,
          output: '没有找到匹配的文件',
        };
      }

      // 返回完整路径
      const fullPaths = files.map(f => path.join(cwd, f));

      return {
        success: true,
        output: `找到 ${files.length} 个文件:\n${fullPaths.join('\n')}`,
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
