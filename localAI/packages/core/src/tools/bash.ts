import { spawn, execSync } from 'child_process';
import type { Tool, ToolResult } from './types.js';
import { backgroundShellManager } from './bashBackground.js';
import { isWindows, convertPathsInCommand } from '../utils/pathUtils.js';

/**
 * 检测 Git Bash 路径（Windows）
 * 优先使用 Git Bash 因为它与 bash 语法兼容
 */
let gitBashPath: string | null = null;
let gitBashChecked = false;

function findGitBash(): string | null {
  if (gitBashChecked) return gitBashPath;
  gitBashChecked = true;

  if (!isWindows) return null;

  try {
    // 尝试通过 where 命令找到 bash
    const result = execSync('where bash', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const paths = result.trim().split('\n').map(p => p.trim());

    // 查找 Git 目录下的 bash
    for (const p of paths) {
      if (p.toLowerCase().includes('git') && p.toLowerCase().endsWith('bash.exe')) {
        gitBashPath = p;
        return gitBashPath;
      }
    }

    // 如果没找到 Git 的 bash，尝试常见路径
    const commonPaths = [
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\usr\\bin\\bash.exe',
      'D:\\Git\\usr\\bin\\bash.exe',
    ];

    for (const p of commonPaths) {
      try {
        execSync(`"${p}" --version`, { stdio: ['pipe', 'pipe', 'pipe'] });
        gitBashPath = p;
        return gitBashPath;
      } catch {
        // 继续尝试下一个
      }
    }
  } catch {
    // where 命令失败
  }

  return null;
}

/**
 * 危险命令模式 - 这些命令可能导致系统损坏或数据丢失
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; description: string; block: boolean }> = [
  // 极度危险 - 直接阻止执行
  { pattern: /rm\s+(-[rf]+\s+)*\/($|\s|;)/, description: '删除根目录', block: true },
  { pattern: /rm\s+(-[rf]+\s+)*\/\*/, description: '删除根目录所有文件', block: true },
  { pattern: /dd\s+.*of=\/dev\/[sh]d[a-z]($|\s)/, description: '覆写磁盘', block: true },
  { pattern: /mkfs\.?\w*\s+\/dev\//, description: '格式化磁盘', block: true },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;?\s*:/, description: 'Fork 炸弹', block: true },
  { pattern: />\s*\/etc\/(passwd|shadow|sudoers)/, description: '覆写系统关键文件', block: true },
  { pattern: /chmod\s+(-R\s+)?[0-7]*777\s+\/($|\s)/, description: '修改根目录权限', block: true },

  // 危险 - 警告但允许执行
  { pattern: /rm\s+-rf?\s+~/, description: '删除用户主目录', block: false },
  { pattern: /rm\s+-rf?\s+\$HOME/, description: '删除用户主目录', block: false },
  { pattern: /(curl|wget).*\|\s*(ba)?sh/, description: '从网络下载并执行脚本', block: false },
  { pattern: /sudo\s+rm\s+-rf/, description: '以 root 权限删除文件', block: false },
  { pattern: /shutdown|reboot|halt|poweroff/, description: '系统关机/重启', block: false },
  { pattern: /systemctl\s+(stop|disable)\s+(sshd|network|firewall)/, description: '停止关键系统服务', block: false },
];

/**
 * 场景触发器：检测可能的耗时命令
 * 当检测到耗时命令但未使用 background 模式时，返回提示信息
 */
const LONG_RUNNING_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /npm\s+(install|ci|i)\b/, hint: 'npm install 可能耗时较长' },
  { pattern: /npm\s+run\s+(build|test|e2e)/, hint: 'npm run build/test 可能耗时较长' },
  { pattern: /npm\s+test/, hint: 'npm test 可能耗时较长' },
  { pattern: /yarn\s+(install|add)\b/, hint: 'yarn install 可能耗时较长' },
  { pattern: /pip\s+install/, hint: 'pip install 可能耗时较长' },
  { pattern: /cargo\s+(build|test)/, hint: 'cargo build/test 可能耗时较长' },
  { pattern: /go\s+(build|test)/, hint: 'go build/test 可能耗时较长' },
  { pattern: /mvn\s+(install|package|test)/, hint: 'maven 构建可能耗时较长' },
  { pattern: /gradle\s+(build|test)/, hint: 'gradle 构建可能耗时较长' },
  { pattern: /docker\s+(build|pull)/, hint: 'docker 操作可能耗时较长' },
  { pattern: /pytest/, hint: 'pytest 可能耗时较长' },
  { pattern: /jest/, hint: 'jest 测试可能耗时较长' },
];

function detectLongRunningCommand(command: string, isBackground: boolean): string | null {
  // 如果已经使用后台模式，不需要提示
  if (isBackground) return null;

  for (const { pattern, hint } of LONG_RUNNING_PATTERNS) {
    if (pattern.test(command)) {
      return `💡 提示：${hint}，建议使用 background=true 并用 bashOutput 获取结果。`;
    }
  }
  return null;
}

/**
 * 检查命令安全性
 */
function checkCommandSafety(command: string): { safe: boolean; blocked: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let blocked = false;

  for (const { pattern, description, block } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      if (block) {
        blocked = true;
        warnings.push(`[阻止] ${description}`);
      } else {
        warnings.push(`[警告] ${description}`);
      }
    }
  }

  return {
    safe: warnings.length === 0,
    blocked,
    warnings,
  };
}

/**
 * Bash 命令执行工具
 */
export class BashTool implements Tool {
  definition = {
    name: 'bash',
    description: `执行 bash 命令。可以运行任何 shell 命令，如 git、npm、ls 等。

【重要】耗时命令必须使用后台模式：
- npm install / npm ci / yarn install → 使用 background=true
- npm run build / npm test → 使用 background=true
- pip install / cargo build / go build → 使用 background=true
- 任何可能超过 10 秒的命令 → 使用 background=true

后台模式使用流程：
1. bash({ command: "npm install", background: true }) → 返回 shell_id
2. bashOutput({ shell_id: "xxx", wait: true }) → 获取执行结果`,
    parameters: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: '要执行的 bash 命令',
        },
        cwd: {
          type: 'string',
          description: '工作目录（可选，默认为当前目录）',
        },
        timeout: {
          type: 'number',
          description: '超时时间，毫秒（可选，默认 60000）',
        },
        background: {
          type: 'boolean',
          description: '是否后台运行。【强烈建议】对于 npm install、npm test、npm run build、pip install、cargo build 等耗时命令设为 true，然后用 bashOutput 获取结果。',
        },
      },
      required: ['command'],
    },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const command = args.command as string;
    const cwd = (args.cwd as string) || process.cwd();
    const timeout = (args.timeout as number) || 60000;
    const background = (args.background as boolean) || false;

    // 验证 command 参数
    if (!command || typeof command !== 'string') {
      return {
        success: false,
        output: '',
        error: '命令参数无效或为空',
      };
    }

    // 安全检查
    const safety = checkCommandSafety(command);
    if (safety.blocked) {
      return {
        success: false,
        output: '',
        error: `命令被安全策略阻止:\n${safety.warnings.join('\n')}\n\n如果确实需要执行此类操作，请直接在终端中手动执行。`,
      };
    }

    // 场景触发器：检测耗时命令但未使用后台模式
    const longRunningHint = detectLongRunningCommand(command, background);

    // 警告前缀
    const warningPrefix = safety.warnings.length > 0
      ? `⚠️ 安全警告:\n${safety.warnings.join('\n')}\n\n---\n`
      : '';

    // 后台运行模式
    if (background) {
      const shell = backgroundShellManager.startBackground(command, cwd);
      return {
        success: true,
        output: `${warningPrefix}命令已在后台启动\nShell ID: ${shell.id}\n命令: ${command}\n\n使用 bashOutput 工具获取输出，或使用 killShell 终止。`,
      };
    }

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      // 确定使用的 shell 和参数
      let shellCmd: string;
      let shellArgs: string[];
      let processedCommand = command;

      if (isWindows) {
        // Windows 上优先使用 Git Bash（与 bash 语法兼容）
        const bashPath = findGitBash();
        if (bashPath) {
          shellCmd = bashPath;
          // 转换 Windows 路径为 Unix 风格
          processedCommand = convertPathsInCommand(command);
          shellArgs = ['-c', processedCommand];
        } else {
          // 没有 Git Bash，使用 cmd.exe
          shellCmd = 'cmd.exe';
          shellArgs = ['/c', command];
        }
      } else {
        // Unix/Linux/MacOS 使用 bash
        shellCmd = 'bash';
        shellArgs = ['-c', command];
      }

      const child = spawn(shellCmd, shellArgs, {
        cwd,
        env: process.env,
        shell: false, // 已经使用 shell 作为命令，不需要再嵌套
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          output: warningPrefix + stdout,
          error: `命令执行超时 (${timeout}ms)`,
        });
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);

        // 构建输出后缀（场景触发器提示）
        const hintSuffix = longRunningHint ? `\n\n${longRunningHint}` : '';

        if (code === 0) {
          resolve({
            success: true,
            output: warningPrefix + (stdout || '命令执行成功（无输出）') + hintSuffix,
          });
        } else {
          resolve({
            success: false,
            output: warningPrefix + stdout + hintSuffix,
            error: stderr || `命令退出码: ${code}`,
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: '',
          error: `命令执行失败: ${error.message}`,
        });
      });
    });
  }
}
