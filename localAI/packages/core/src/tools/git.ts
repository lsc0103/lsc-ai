import { spawn } from 'child_process';
import * as path from 'path';
import type { Tool, ToolResult } from './types.js';

/**
 * 执行 git 命令
 * 在 Windows 上使用 shell 模式时，需要正确处理包含空格的参数
 */
async function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';

    // 在 Windows shell 模式下，需要为包含空格的参数添加引号
    const processedArgs = isWindows
      ? args.map(arg => arg.includes(' ') ? `"${arg}"` : arg)
      : args;

    const proc = spawn('git', processedArgs, {
      cwd,
      shell: isWindows,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code || 0 });
    });

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, code: 1 });
    });
  });
}

/**
 * Git 状态工具
 */
export class GitStatusTool implements Tool {
  definition = {
    name: 'gitStatus',
    description: '查看 Git 仓库状态，显示已修改、已暂存、未跟踪的文件。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '仓库路径（默认当前目录）',
        },
      },
      required: [],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const repoPath = (args.path as string) || process.cwd();

    try {
      const absolutePath = path.isAbsolute(repoPath)
        ? repoPath
        : path.resolve(process.cwd(), repoPath);

      const result = await execGit(['status', '--porcelain', '-b'], absolutePath);

      if (result.code !== 0) {
        return {
          success: false,
          output: '',
          error: result.stderr || '不是有效的 Git 仓库',
        };
      }

      if (!result.stdout.trim()) {
        return {
          success: true,
          output: '工作区干净，没有待提交的更改',
        };
      }

      // 解析 porcelain 输出
      const lines = result.stdout.trim().split('\n');
      const branchLine = lines[0];
      const fileLines = lines.slice(1);

      let output = `分支: ${branchLine.replace('## ', '')}\n\n`;

      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];

      for (const line of fileLines) {
        const status = line.slice(0, 2);
        const file = line.slice(3);

        if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(`  ${status[0]} ${file}`);
        }
        if (status[1] === 'M' || status[1] === 'D') {
          modified.push(`  ${status[1]} ${file}`);
        }
        if (status === '??') {
          untracked.push(`  ${file}`);
        }
      }

      if (staged.length > 0) {
        output += `已暂存 (${staged.length}):\n${staged.join('\n')}\n\n`;
      }
      if (modified.length > 0) {
        output += `已修改 (${modified.length}):\n${modified.join('\n')}\n\n`;
      }
      if (untracked.length > 0) {
        output += `未跟踪 (${untracked.length}):\n${untracked.join('\n')}\n`;
      }

      return {
        success: true,
        output: output.trim(),
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `获取 Git 状态失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Git Diff 工具
 */
export class GitDiffTool implements Tool {
  definition = {
    name: 'gitDiff',
    description: '查看 Git 差异。可以查看工作区差异、暂存区差异、或比较两个提交。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '仓库路径（默认当前目录）',
        },
        file: {
          type: 'string',
          description: '只查看指定文件的差异',
        },
        staged: {
          type: 'boolean',
          description: '查看暂存区差异（默认查看工作区差异）',
        },
        commit: {
          type: 'string',
          description: '比较的提交 ID 或引用（如 HEAD~1）',
        },
      },
      required: [],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const repoPath = (args.path as string) || process.cwd();
    const file = args.file as string | undefined;
    const staged = args.staged === true;
    const commit = args.commit as string | undefined;

    try {
      const absolutePath = path.isAbsolute(repoPath)
        ? repoPath
        : path.resolve(process.cwd(), repoPath);

      const gitArgs = ['diff', '--stat'];

      if (staged) {
        gitArgs.push('--cached');
      }

      if (commit) {
        gitArgs.push(commit);
      }

      if (file) {
        gitArgs.push('--', file);
      }

      const result = await execGit(gitArgs, absolutePath);

      if (result.code !== 0) {
        return {
          success: false,
          output: '',
          error: result.stderr || 'Git diff 失败',
        };
      }

      if (!result.stdout.trim()) {
        return {
          success: true,
          output: '没有差异',
        };
      }

      // 获取详细 diff（不带 --stat）
      gitArgs.splice(gitArgs.indexOf('--stat'), 1);
      const detailResult = await execGit(gitArgs, absolutePath);

      return {
        success: true,
        output: `统计:\n${result.stdout}\n详细差异:\n${detailResult.stdout}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Git diff 失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Git Log 工具
 */
export class GitLogTool implements Tool {
  definition = {
    name: 'gitLog',
    description: '查看 Git 提交历史。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '仓库路径（默认当前目录）',
        },
        count: {
          type: 'number',
          description: '显示的提交数量（默认 10）',
        },
        oneline: {
          type: 'boolean',
          description: '单行显示（默认 true）',
        },
        file: {
          type: 'string',
          description: '只查看指定文件的历史',
        },
      },
      required: [],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const repoPath = (args.path as string) || process.cwd();
    const count = (args.count as number) || 10;
    const oneline = args.oneline !== false;
    const file = args.file as string | undefined;

    try {
      const absolutePath = path.isAbsolute(repoPath)
        ? repoPath
        : path.resolve(process.cwd(), repoPath);

      const gitArgs = ['log', `-${count}`];

      if (oneline) {
        gitArgs.push('--oneline', '--decorate');
      } else {
        // 在 Windows 上，% 需要转义为 %% 以避免被解释为环境变量
        const format = process.platform === 'win32'
          ? '--format=%%h %%ad | %%s [%%an]'
          : '--format=%h %ad | %s [%an]';
        gitArgs.push(format, '--date=short');
      }

      if (file) {
        gitArgs.push('--', file);
      }

      const result = await execGit(gitArgs, absolutePath);

      if (result.code !== 0) {
        return {
          success: false,
          output: '',
          error: result.stderr || 'Git log 失败',
        };
      }

      return {
        success: true,
        output: result.stdout || '没有提交历史',
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Git log 失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Git Add 工具
 */
export class GitAddTool implements Tool {
  definition = {
    name: 'gitAdd',
    description: '将文件添加到 Git 暂存区。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '仓库路径（默认当前目录）',
        },
        files: {
          type: 'array',
          description: '要添加的文件列表（默认添加所有更改）',
        },
      },
      required: [],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const repoPath = (args.path as string) || process.cwd();
    const files = (args.files as string[]) || ['.'];

    try {
      const absolutePath = path.isAbsolute(repoPath)
        ? repoPath
        : path.resolve(process.cwd(), repoPath);

      const result = await execGit(['add', ...files], absolutePath);

      if (result.code !== 0) {
        return {
          success: false,
          output: '',
          error: result.stderr || 'Git add 失败',
        };
      }

      return {
        success: true,
        output: `已添加到暂存区: ${files.join(', ')}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Git add 失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Git Commit 工具
 */
export class GitCommitTool implements Tool {
  definition = {
    name: 'gitCommit',
    description: '创建 Git 提交。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '仓库路径（默认当前目录）',
        },
        message: {
          type: 'string',
          description: '提交信息',
        },
        all: {
          type: 'boolean',
          description: '自动暂存所有已修改的文件（-a 参数）',
        },
      },
      required: ['message'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const repoPath = (args.path as string) || process.cwd();
    const message = args.message as string;
    const all = args.all === true;

    try {
      const absolutePath = path.isAbsolute(repoPath)
        ? repoPath
        : path.resolve(process.cwd(), repoPath);

      const gitArgs = ['commit', '-m', message];
      if (all) {
        gitArgs.splice(1, 0, '-a');
      }

      const result = await execGit(gitArgs, absolutePath);

      if (result.code !== 0) {
        if (result.stderr.includes('nothing to commit')) {
          return {
            success: true,
            output: '没有内容需要提交',
          };
        }
        return {
          success: false,
          output: '',
          error: result.stderr || 'Git commit 失败',
        };
      }

      return {
        success: true,
        output: result.stdout || '提交成功',
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Git commit 失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * Git Branch 工具
 */
export class GitBranchTool implements Tool {
  definition = {
    name: 'gitBranch',
    description: '管理 Git 分支：列出、创建、删除、切换分支。',
    parameters: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: '仓库路径（默认当前目录）',
        },
        action: {
          type: 'string',
          description: '操作类型: list（列出）、create（创建）、delete（删除）、checkout（切换）',
        },
        name: {
          type: 'string',
          description: '分支名称（create/delete/checkout 时必需）',
        },
      },
      required: [],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const repoPath = (args.path as string) || process.cwd();
    const action = (args.action as string) || 'list';
    const name = args.name as string | undefined;

    try {
      const absolutePath = path.isAbsolute(repoPath)
        ? repoPath
        : path.resolve(process.cwd(), repoPath);

      let gitArgs: string[];

      switch (action) {
        case 'list':
          gitArgs = ['branch', '-a', '-v'];
          break;
        case 'create':
          if (!name) {
            return { success: false, output: '', error: '创建分支需要指定 name' };
          }
          gitArgs = ['branch', name];
          break;
        case 'delete':
          if (!name) {
            return { success: false, output: '', error: '删除分支需要指定 name' };
          }
          gitArgs = ['branch', '-d', name];
          break;
        case 'checkout':
          if (!name) {
            return { success: false, output: '', error: '切换分支需要指定 name' };
          }
          gitArgs = ['checkout', name];
          break;
        default:
          return { success: false, output: '', error: `未知操作: ${action}` };
      }

      const result = await execGit(gitArgs, absolutePath);

      if (result.code !== 0) {
        return {
          success: false,
          output: '',
          error: result.stderr || `Git ${action} 失败`,
        };
      }

      const messages: Record<string, string> = {
        list: result.stdout || '没有分支',
        create: `分支 ${name} 已创建`,
        delete: `分支 ${name} 已删除`,
        checkout: `已切换到分支 ${name}`,
      };

      return {
        success: true,
        output: messages[action] || result.stdout,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Git branch 失败: ${(error as Error).message}`,
      };
    }
  }
}
