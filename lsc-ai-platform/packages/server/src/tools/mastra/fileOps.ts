import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolResult } from './types.js';

/**
 * 创建目录工具
 */
export class MkdirTool implements Tool {
  definition = {
    name: 'mkdir',
    description: '创建目录。支持递归创建多级目录。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '要创建的目录路径',
        },
      },
      required: ['path'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = args.path as string;

    try {
      const absolutePath = path.isAbsolute(dirPath)
        ? dirPath
        : path.resolve(process.cwd(), dirPath);

      await fs.mkdir(absolutePath, { recursive: true });

      return {
        success: true,
        output: `目录已创建: ${absolutePath}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `创建目录失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 复制文件/目录工具
 */
export class CopyTool implements Tool {
  definition = {
    name: 'cp',
    description: '复制文件或目录。',
    parameters: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: '源文件或目录路径',
        },
        destination: {
          type: 'string',
          description: '目标路径',
        },
        recursive: {
          type: 'boolean',
          description: '是否递归复制目录（默认 true）',
        },
      },
      required: ['source', 'destination'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const source = args.source as string;
    const destination = args.destination as string;
    const recursive = args.recursive !== false;

    try {
      const srcPath = path.isAbsolute(source)
        ? source
        : path.resolve(process.cwd(), source);
      const destPath = path.isAbsolute(destination)
        ? destination
        : path.resolve(process.cwd(), destination);

      const stats = await fs.stat(srcPath);

      if (stats.isDirectory()) {
        if (!recursive) {
          return {
            success: false,
            output: '',
            error: '源是目录，需要设置 recursive: true',
          };
        }
        await this.copyDir(srcPath, destPath);
      } else {
        // 确保目标目录存在
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }

      return {
        success: true,
        output: `已复制: ${srcPath} -> ${destPath}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `复制失败: ${(error as Error).message}`,
      };
    }
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}

/**
 * 移动/重命名文件工具
 */
export class MoveTool implements Tool {
  definition = {
    name: 'mv',
    description: '移动或重命名文件/目录。',
    parameters: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: '源文件或目录路径',
        },
        destination: {
          type: 'string',
          description: '目标路径',
        },
      },
      required: ['source', 'destination'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const source = args.source as string;
    const destination = args.destination as string;

    try {
      const srcPath = path.isAbsolute(source)
        ? source
        : path.resolve(process.cwd(), source);
      const destPath = path.isAbsolute(destination)
        ? destination
        : path.resolve(process.cwd(), destination);

      // 确保目标目录存在
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.rename(srcPath, destPath);

      return {
        success: true,
        output: `已移动: ${srcPath} -> ${destPath}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `移动失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 删除文件/目录工具
 */
export class RemoveTool implements Tool {
  definition = {
    name: 'rm',
    description: '删除文件或目录。删除目录时需要设置 recursive: true。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '要删除的文件或目录路径',
        },
        recursive: {
          type: 'boolean',
          description: '是否递归删除目录（默认 false，安全考虑）',
        },
      },
      required: ['path'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const targetPath = args.path as string;
    const recursive = args.recursive === true;

    try {
      const absolutePath = path.isAbsolute(targetPath)
        ? targetPath
        : path.resolve(process.cwd(), targetPath);

      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        if (!recursive) {
          return {
            success: false,
            output: '',
            error: '目标是目录，需要设置 recursive: true 才能删除',
          };
        }
        await fs.rm(absolutePath, { recursive: true });
      } else {
        await fs.unlink(absolutePath);
      }

      return {
        success: true,
        output: `已删除: ${absolutePath}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `删除失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 列出目录内容工具
 */
export class ListTool implements Tool {
  definition = {
    name: 'ls',
    description: '列出目录内容，显示文件大小和修改时间。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '目录路径（默认当前目录）',
        },
        all: {
          type: 'boolean',
          description: '是否显示隐藏文件（默认 false）',
        },
      },
      required: [],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = (args.path as string) || '.';
    const showAll = args.all === true;
    const cwd = (args.cwd as string) || process.cwd();

    try {
      const absolutePath = path.isAbsolute(dirPath)
        ? dirPath
        : path.resolve(cwd, dirPath);

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const results: string[] = [];

      for (const entry of entries) {
        // 跳过隐藏文件（除非 showAll）
        if (!showAll && entry.name.startsWith('.')) continue;

        const fullPath = path.join(absolutePath, entry.name);
        try {
          const stats = await fs.stat(fullPath);
          const size = stats.isDirectory()
            ? '<DIR>'
            : this.formatSize(stats.size);
          const mtime = stats.mtime.toISOString().slice(0, 16).replace('T', ' ');
          const type = entry.isDirectory() ? '/' : '';

          results.push(`${mtime}  ${size.padStart(10)}  ${entry.name}${type}`);
        } catch {
          results.push(`${'?'.padStart(16)}  ${'?'.padStart(10)}  ${entry.name}`);
        }
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `目录为空: ${absolutePath}`,
        };
      }

      return {
        success: true,
        output: `${absolutePath}\n${'─'.repeat(50)}\n${results.join('\n')}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `列出目录失败: ${(error as Error).message}`,
      };
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  }
}
