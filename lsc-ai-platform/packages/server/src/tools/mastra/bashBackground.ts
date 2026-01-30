/**
 * 后台 Bash 管理工具
 * 支持后台运行命令、获取输出、终止进程
 */

import { spawn, ChildProcess } from 'child_process';
import type { Tool, ToolResult } from './types.js';
import { isWindows } from '../../utils/pathUtils.js';

export interface BackgroundShell {
  id: string;
  command: string;
  process: ChildProcess;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startTime: number;
  isRunning: boolean;
}

/**
 * 后台 Shell 管理器
 */
export class BackgroundShellManager {
  private shells: Map<string, BackgroundShell> = new Map();

  /**
   * 启动后台命令
   */
  startBackground(command: string, cwd?: string): BackgroundShell {
    const id = `shell_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const processedCwd = cwd || process.cwd();

    // Windows 上使用 cmd.exe，其他系统使用 bash
    const shellCmd = isWindows ? 'cmd.exe' : 'bash';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const child = spawn(shellCmd, shellArgs, {
      cwd: processedCwd,
      env: process.env,
      detached: false,
    });

    const shell: BackgroundShell = {
      id,
      command,
      process: child,
      stdout: '',
      stderr: '',
      exitCode: null,
      startTime: Date.now(),
      isRunning: true,
    };

    child.stdout.on('data', (data) => {
      shell.stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      shell.stderr += data.toString();
    });

    child.on('close', (code) => {
      shell.exitCode = code;
      shell.isRunning = false;
    });

    child.on('error', (error) => {
      shell.stderr += `\nError: ${error.message}`;
      shell.isRunning = false;
    });

    this.shells.set(id, shell);
    return shell;
  }

  /**
   * 获取 shell 状态和输出
   */
  getShell(id: string): BackgroundShell | undefined {
    return this.shells.get(id);
  }

  /**
   * 终止 shell
   */
  killShell(id: string): boolean {
    const shell = this.shells.get(id);
    if (!shell) return false;

    if (shell.isRunning) {
      shell.process.kill('SIGTERM');
      shell.isRunning = false;
    }
    return true;
  }

  /**
   * 列出所有 shell
   */
  listShells(): BackgroundShell[] {
    return Array.from(this.shells.values());
  }

  /**
   * 清理已完成的 shell
   */
  cleanup(): number {
    let cleaned = 0;
    for (const [id, shell] of this.shells) {
      if (!shell.isRunning) {
        this.shells.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// 全局后台 shell 管理器实例
export const backgroundShellManager = new BackgroundShellManager();

/**
 * BashOutput 工具 - 获取后台命令输出
 */
export class BashOutputTool implements Tool {
  private manager: BackgroundShellManager;

  constructor(manager?: BackgroundShellManager) {
    this.manager = manager || backgroundShellManager;
  }

  definition = {
    name: 'bashOutput',
    description: '获取后台运行的 bash 命令的输出。需要提供 shell ID。',
    parameters: {
      type: 'object' as const,
      properties: {
        shell_id: {
          type: 'string',
          description: '后台 shell 的 ID',
        },
        wait: {
          type: 'boolean',
          description: '是否等待命令完成（默认 false）',
        },
        timeout: {
          type: 'number',
          description: '等待超时时间，毫秒（默认 30000）',
        },
      },
      required: ['shell_id'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const shellId = args.shell_id as string;
    const wait = (args.wait as boolean) || false;
    const timeout = (args.timeout as number) || 30000;

    const shell = this.manager.getShell(shellId);
    if (!shell) {
      return {
        success: false,
        output: '',
        error: `未找到 shell: ${shellId}`,
      };
    }

    // 如果需要等待完成
    if (wait && shell.isRunning) {
      const startWait = Date.now();
      while (shell.isRunning && Date.now() - startWait < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const status = shell.isRunning ? '运行中' : `已完成 (退出码: ${shell.exitCode})`;
    const duration = ((Date.now() - shell.startTime) / 1000).toFixed(1);

    let output = `Shell: ${shell.id}\n`;
    output += `命令: ${shell.command}\n`;
    output += `状态: ${status}\n`;
    output += `运行时间: ${duration}s\n`;
    output += `---\n`;
    output += shell.stdout || '(无输出)';

    if (shell.stderr) {
      output += `\n--- stderr ---\n${shell.stderr}`;
    }

    return {
      success: true,
      output,
    };
  }
}

/**
 * KillShell 工具 - 终止后台命令
 */
export class KillShellTool implements Tool {
  private manager: BackgroundShellManager;

  constructor(manager?: BackgroundShellManager) {
    this.manager = manager || backgroundShellManager;
  }

  definition = {
    name: 'killShell',
    description: '终止后台运行的 bash 命令。',
    parameters: {
      type: 'object' as const,
      properties: {
        shell_id: {
          type: 'string',
          description: '要终止的 shell ID',
        },
      },
      required: ['shell_id'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const shellId = args.shell_id as string;

    const shell = this.manager.getShell(shellId);
    if (!shell) {
      return {
        success: false,
        output: '',
        error: `未找到 shell: ${shellId}`,
      };
    }

    if (!shell.isRunning) {
      return {
        success: true,
        output: `Shell ${shellId} 已经停止运行`,
      };
    }

    const killed = this.manager.killShell(shellId);
    if (killed) {
      return {
        success: true,
        output: `已终止 shell: ${shellId}\n命令: ${shell.command}`,
      };
    }

    return {
      success: false,
      output: '',
      error: `终止 shell 失败: ${shellId}`,
    };
  }
}

/**
 * ListShells 工具 - 列出所有后台命令
 */
export class ListShellsTool implements Tool {
  private manager: BackgroundShellManager;

  constructor(manager?: BackgroundShellManager) {
    this.manager = manager || backgroundShellManager;
  }

  definition = {
    name: 'listShells',
    description: '列出所有后台运行的 bash 命令。',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  };

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const shells = this.manager.listShells();

    if (shells.length === 0) {
      return {
        success: true,
        output: '当前没有后台运行的命令',
      };
    }

    const list = shells.map(shell => {
      const status = shell.isRunning ? '🟢 运行中' : `⚫ 已停止 (${shell.exitCode})`;
      const duration = ((Date.now() - shell.startTime) / 1000).toFixed(1);
      return `${status} [${shell.id}] ${shell.command} (${duration}s)`;
    }).join('\n');

    return {
      success: true,
      output: `后台命令 (${shells.length} 个):\n${list}`,
    };
  }
}
