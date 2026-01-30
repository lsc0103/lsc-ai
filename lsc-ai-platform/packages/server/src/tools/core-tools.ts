/**
 * @lsc-ai/core 工具转换为 Mastra 格式
 *
 * 策略：保留原有业务逻辑，只改变接口格式
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// 模块级工具实例缓存，避免每次调用都 dynamic import + new
const _cache: Record<string, any> = {};

// ============================================================================
// 文件读取工具
// ============================================================================

export const readFileTool = createTool({
  id: 'read',
  description: `读取文件内容。支持文本文件（返回带行号的内容）和图片文件（返回图片数据供视觉分析）。

支持的图片格式：jpg、png、gif、webp、bmp、svg。
支持 PDF 文件的文本提取。`,
  inputSchema: z.object({
    file_path: z.string().describe('要读取的文件的绝对路径'),
    offset: z.number().optional().describe('从第几行开始读取（可选，默认从第1行开始，仅对文本文件有效）'),
    limit: z.number().optional().describe('读取的行数限制（可选，默认读取全部，仅对文本文件有效）'),
  }),
  execute: async ({ file_path, offset = 0, limit }) => {
    try {
      if (!_cache.read) {
        const { ReadTool } = await import('./mastra/read.js');
        _cache.read = new ReadTool();
      }
      const result = await _cache.read.execute({ file_path, offset, limit });
      return result;
    } catch (error) {
      throw new Error(`读取文件失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 文件写入工具
// ============================================================================

export const writeFileTool = createTool({
  id: 'write',
  description: `写入文件内容。如果文件已存在会被覆盖。会自动创建必要的父目录。`,
  inputSchema: z.object({
    file_path: z.string().describe('要写入的文件的绝对路径'),
    content: z.string().describe('要写入的文件内容'),
  }),
  execute: async ({ file_path, content }) => {
    try {
      if (!_cache.write) {
        const { WriteTool } = await import('./mastra/write.js');
        _cache.write = new WriteTool();
      }
      const result = await _cache.write.execute({ file_path, content });
      return result;
    } catch (error) {
      throw new Error(`写入文件失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 文件编辑工具
// ============================================================================

export const editFileTool = createTool({
  id: 'edit',
  description: `编辑文件内容。使用精确的字符串替换。`,
  inputSchema: z.object({
    file_path: z.string().describe('要编辑的文件的绝对路径'),
    old_string: z.string().describe('要替换的旧字符串（必须完全匹配）'),
    new_string: z.string().describe('新的字符串内容'),
    replace_all: z.boolean().optional().describe('是否替换所有匹配（默认 false，只替换第一个）'),
  }),
  execute: async ({ file_path, old_string, new_string, replace_all = false }) => {
    try {
      if (!_cache.edit) {
        const { EditTool } = await import('./mastra/edit.js');
        _cache.edit = new EditTool();
      }
      const result = await _cache.edit.execute({ file_path, old_string, new_string, replace_all });
      return result;
    } catch (error) {
      throw new Error(`编辑文件失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Bash 命令执行工具
// ============================================================================

export const bashTool = createTool({
  id: 'bash',
  description: `执行 bash 命令。支持所有标准 shell 命令。`,
  inputSchema: z.object({
    command: z.string().describe('要执行的 bash 命令'),
    timeout: z.number().optional().describe('超时时间（毫秒），默认 120000（2分钟）'),
    description: z.string().optional().describe('命令描述'),
  }),
  execute: async ({ command, timeout, description }) => {
    try {
      if (!_cache.bash) {
        const { BashTool } = await import('./mastra/bash.js');
        _cache.bash = new BashTool();
      }
      const result = await _cache.bash.execute({ command, timeout, description });
      return result;
    } catch (error) {
      throw new Error(`执行命令失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 文件搜索工具（Glob）
// ============================================================================

export const globTool = createTool({
  id: 'glob',
  description: `使用 glob 模式搜索文件。例如：**/*.ts 查找所有 TypeScript 文件。`,
  inputSchema: z.object({
    pattern: z.string().describe('Glob 模式，例如 **/*.ts'),
    path: z.string().optional().describe('搜索路径（可选，默认当前目录）'),
  }),
  execute: async ({ pattern, path: searchPath }) => {
    try {
      if (!_cache.glob) {
        const { GlobTool } = await import('./mastra/glob.js');
        _cache.glob = new GlobTool();
      }
      const result = await _cache.glob.execute({ pattern, path: searchPath });
      return result;
    } catch (error) {
      throw new Error(`文件搜索失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 内容搜索工具（Grep）
// ============================================================================

export const grepTool = createTool({
  id: 'grep',
  description: `在文件中搜索文本内容。支持正则表达式。`,
  inputSchema: z.object({
    pattern: z.string().describe('搜索模式（支持正则表达式）'),
    path: z.string().optional().describe('搜索路径（可选，默认当前目录）'),
    glob: z.string().optional().describe('文件过滤模式，例如 *.ts'),
    output_mode: z.enum(['content', 'files_with_matches', 'count']).optional().describe('输出模式'),
    '-i': z.boolean().optional().describe('忽略大小写'),
  }),
  execute: async (input) => {
    try {
      if (!_cache.grep) {
        const { GrepTool } = await import('./mastra/grep.js');
        _cache.grep = new GrepTool();
      }
      const result = await _cache.grep.execute(input);
      return result;
    } catch (error) {
      throw new Error(`内容搜索失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// Git 工具
// ============================================================================

export const gitStatusTool = createTool({
  id: 'git_status',
  description: `查看 Git 仓库状态。`,
  inputSchema: z.object({
    path: z.string().optional().describe('仓库路径（可选，默认当前目录）'),
  }),
  execute: async ({ path: repoPath }) => {
    try {
      if (!_cache.gitStatus) {
        const { GitStatusTool } = await import('./mastra/git.js');
        _cache.gitStatus = new GitStatusTool();
      }
      const result = await _cache.gitStatus.execute({ path: repoPath });
      return result;
    } catch (error) {
      throw new Error(`Git 状态查询失败: ${(error as Error).message}`);
    }
  },
});

export const gitDiffTool = createTool({
  id: 'git_diff',
  description: `查看 Git 文件差异。`,
  inputSchema: z.object({
    path: z.string().optional().describe('仓库路径（可选，默认当前目录）'),
    staged: z.boolean().optional().describe('是否查看暂存区差异'),
  }),
  execute: async ({ path: repoPath, staged }) => {
    try {
      if (!_cache.gitDiff) {
        const { GitDiffTool } = await import('./mastra/git.js');
        _cache.gitDiff = new GitDiffTool();
      }
      const result = await _cache.gitDiff.execute({ path: repoPath, staged });
      return result;
    } catch (error) {
      throw new Error(`Git 差异查询失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 文件操作工具
// ============================================================================

export const mkdirTool = createTool({
  id: 'mkdir',
  description: `创建目录。支持递归创建多级目录。`,
  inputSchema: z.object({
    path: z.string().describe('要创建的目录路径'),
  }),
  execute: async ({ path: dirPath }) => {
    try {
      if (!_cache.mkdir) {
        const { MkdirTool } = await import('./mastra/fileOps.js');
        _cache.mkdir = new MkdirTool();
      }
      const result = await _cache.mkdir.execute({ path: dirPath });
      return result;
    } catch (error) {
      throw new Error(`创建目录失败: ${(error as Error).message}`);
    }
  },
});

export const copyTool = createTool({
  id: 'cp',
  description: `复制文件或目录。`,
  inputSchema: z.object({
    source: z.string().describe('源文件或目录路径'),
    destination: z.string().describe('目标路径'),
  }),
  execute: async ({ source, destination }) => {
    try {
      if (!_cache.cp) {
        const { CopyTool } = await import('./mastra/fileOps.js');
        _cache.cp = new CopyTool();
      }
      const result = await _cache.cp.execute({ source, destination });
      return result;
    } catch (error) {
      throw new Error(`复制失败: ${(error as Error).message}`);
    }
  },
});

export const moveTool = createTool({
  id: 'mv',
  description: `移动或重命名文件/目录。`,
  inputSchema: z.object({
    source: z.string().describe('源文件或目录路径'),
    destination: z.string().describe('目标路径'),
  }),
  execute: async ({ source, destination }) => {
    try {
      if (!_cache.mv) {
        const { MoveTool } = await import('./mastra/fileOps.js');
        _cache.mv = new MoveTool();
      }
      const result = await _cache.mv.execute({ source, destination });
      return result;
    } catch (error) {
      throw new Error(`移动失败: ${(error as Error).message}`);
    }
  },
});

export const removeTool = createTool({
  id: 'rm',
  description: `删除文件或目录。`,
  inputSchema: z.object({
    path: z.string().describe('要删除的文件或目录路径'),
    recursive: z.boolean().optional().describe('是否递归删除目录'),
  }),
  execute: async ({ path: targetPath, recursive }) => {
    try {
      if (!_cache.rm) {
        const { RemoveTool } = await import('./mastra/fileOps.js');
        _cache.rm = new RemoveTool();
      }
      const result = await _cache.rm.execute({ path: targetPath, recursive });
      return result;
    } catch (error) {
      throw new Error(`删除失败: ${(error as Error).message}`);
    }
  },
});

export const listTool = createTool({
  id: 'ls',
  description: `列出目录内容。`,
  inputSchema: z.object({
    path: z.string().describe('要列出的目录路径'),
    recursive: z.boolean().optional().describe('是否递归列出子目录'),
  }),
  execute: async ({ path: dirPath, recursive }) => {
    try {
      if (!_cache.ls) {
        const { ListTool } = await import('./mastra/fileOps.js');
        _cache.ls = new ListTool();
      }
      const result = await _cache.ls.execute({ path: dirPath, recursive });
      return result;
    } catch (error) {
      throw new Error(`列出目录失败: ${(error as Error).message}`);
    }
  },
});

// ============================================================================
// 导出所有核心工具
// ============================================================================

export const coreTools = {
  // 文件操作
  read: readFileTool,
  write: writeFileTool,
  edit: editFileTool,

  // 文件系统
  mkdir: mkdirTool,
  cp: copyTool,
  mv: moveTool,
  rm: removeTool,
  ls: listTool,

  // Shell
  bash: bashTool,

  // 搜索
  glob: globTool,
  grep: grepTool,

  // Git
  git_status: gitStatusTool,
  git_diff: gitDiffTool,
};
