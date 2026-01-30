/**
 * 会话持久化模块
 * 支持保存和恢复对话历史、Agent 状态
 *
 * 参考 Claude Code 的会话恢复能力：
 * - 支持 Agent ID 追踪
 * - 支持完整状态序列化（消息、权限、工具状态）
 * - 支持跨会话恢复
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getHistoryDir, ensureConfigDir, loadConfig } from './index.js';
import type { Message } from '../llm/types.js';

/**
 * Agent 状态快照
 * 用于完整恢复 Agent 的运行状态
 */
export interface AgentSnapshot {
  /** Agent ID（唯一标识符） */
  agentId: string;
  /** 创建时间 */
  createdAt: number;
  /** 已授权的工具列表（始终允许） */
  alwaysAllowedTools: string[];
  /** 语义化权限（如 "run tests", "install dependencies"） */
  allowedPrompts: SemanticPermission[];
  /** 是否高级模型 */
  isAdvancedModel: boolean;
  /** 累计 Token 使用 */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 项目上下文（如果已检测） */
  projectContext?: {
    type: string;
    framework?: string;
    language?: string;
  };
}

/**
 * 语义化权限
 * 类似 Claude Code 的 allowedPrompts 机制
 */
export interface SemanticPermission {
  /** 工具类型 */
  tool: 'bash' | 'write' | 'edit' | 'network';
  /** 语义描述（如 "run tests", "build project"） */
  prompt: string;
  /** 授权时间 */
  grantedAt: number;
  /** 过期时间（可选，默认会话结束） */
  expiresAt?: number;
}

/**
 * 会话元数据
 */
export interface SessionMeta {
  /** 会话 ID */
  id: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 会话标题（从第一条用户消息生成） */
  title: string;
  /** 消息数量 */
  messageCount: number;
  /** 工作目录 */
  cwd: string;
  /** 使用的模型 */
  model?: string;
  /** Agent ID（用于恢复） */
  agentId?: string;
  /** 会话状态 */
  status?: 'active' | 'paused' | 'completed';
}

/**
 * 完整会话数据
 */
export interface Session extends SessionMeta {
  /** 消息历史 */
  messages: Message[];
  /** Agent 状态快照（用于恢复） */
  agentSnapshot?: AgentSnapshot;
}

/**
 * 生成会话 ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * 从消息中提取标题
 */
function extractTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    const content = typeof firstUserMessage.content === 'string'
      ? firstUserMessage.content
      : firstUserMessage.content.map(c => c.type === 'text' ? c.text : '').join(' ');
    // 截取前 50 个字符作为标题
    return content.slice(0, 50) + (content.length > 50 ? '...' : '');
  }
  return '新会话';
}

/**
 * 获取会话文件路径
 */
function getSessionPath(id: string): string {
  return path.join(getHistoryDir(), `${id}.json`);
}

/**
 * 生成 Agent ID（UUID v4 格式）
 */
export function generateAgentId(): string {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // UUID v4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8]; // 8, 9, a, or b
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}

/**
 * 保存会话（增强版）
 * 支持 Agent 状态快照的保存
 */
export async function saveSession(
  messages: Message[],
  options?: {
    id?: string;
    cwd?: string;
    model?: string;
    agentSnapshot?: AgentSnapshot;
    status?: 'active' | 'paused' | 'completed';
  }
): Promise<SessionMeta> {
  await ensureConfigDir();

  const now = Date.now();
  const id = options?.id || generateSessionId();
  const sessionPath = getSessionPath(id);

  // 尝试加载现有会话的创建时间
  let createdAt = now;
  let existingAgentId: string | undefined;
  try {
    const existing = await loadSession(id);
    createdAt = existing.createdAt;
    existingAgentId = existing.agentId;
  } catch {
    // 新会话
  }

  // 使用现有的 agentId 或从快照中获取
  const agentId = options?.agentSnapshot?.agentId || existingAgentId;

  const session: Session = {
    id,
    createdAt,
    updatedAt: now,
    title: extractTitle(messages),
    messageCount: messages.length,
    cwd: options?.cwd || process.cwd(),
    model: options?.model,
    agentId,
    status: options?.status || 'active',
    messages,
    agentSnapshot: options?.agentSnapshot,
  };

  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');

  // 清理旧会话
  await cleanupOldSessions();

  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    title: session.title,
    messageCount: session.messageCount,
    cwd: session.cwd,
    model: session.model,
    agentId: session.agentId,
    status: session.status,
  };
}

/**
 * 加载会话
 */
export async function loadSession(id: string): Promise<Session> {
  const sessionPath = getSessionPath(id);
  const content = await fs.readFile(sessionPath, 'utf-8');
  return JSON.parse(content) as Session;
}

/**
 * 列出所有会话
 */
export async function listSessions(): Promise<SessionMeta[]> {
  await ensureConfigDir();
  const historyDir = getHistoryDir();

  try {
    const files = await fs.readdir(historyDir);
    const sessions: SessionMeta[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(historyDir, file), 'utf-8');
        const session = JSON.parse(content) as Session;
        sessions.push({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          title: session.title,
          messageCount: session.messageCount,
          cwd: session.cwd,
          model: session.model,
          agentId: session.agentId,
          status: session.status,
        });
      } catch {
        // 跳过无法解析的文件
      }
    }

    // 按更新时间倒序排列
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * 删除会话
 */
export async function deleteSession(id: string): Promise<void> {
  const sessionPath = getSessionPath(id);
  try {
    await fs.unlink(sessionPath);
  } catch {
    // 文件可能不存在
  }
}

/**
 * 清除所有会话
 */
export async function clearAllSessions(): Promise<number> {
  const sessions = await listSessions();
  let count = 0;
  for (const session of sessions) {
    try {
      await deleteSession(session.id);
      count++;
    } catch {
      // 忽略删除错误
    }
  }
  return count;
}

/**
 * 清理旧会话（保留最近 N 个）
 */
async function cleanupOldSessions(): Promise<void> {
  const config = await loadConfig();
  const maxSessions = config.maxHistorySessions || 50;

  const sessions = await listSessions();
  if (sessions.length <= maxSessions) return;

  // 删除超出限制的旧会话
  const toDelete = sessions.slice(maxSessions);
  for (const session of toDelete) {
    await deleteSession(session.id);
  }
}

/**
 * 获取最近的会话
 */
export async function getRecentSession(): Promise<Session | null> {
  const sessions = await listSessions();
  if (sessions.length === 0) return null;

  try {
    return await loadSession(sessions[0].id);
  } catch {
    return null;
  }
}

/**
 * 自动保存会话（防抖版本，增强版）
 * 支持 Agent 状态快照的自动保存
 */
export function createAutoSaver(debounceMs: number = 5000) {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingMessages: Message[] | null = null;
  let pendingOptions: {
    id?: string;
    cwd?: string;
    model?: string;
    agentSnapshot?: AgentSnapshot;
    status?: 'active' | 'paused' | 'completed';
  } | undefined;

  return {
    /**
     * 触发自动保存（会被防抖）
     */
    save(
      messages: Message[],
      options?: {
        id?: string;
        cwd?: string;
        model?: string;
        agentSnapshot?: AgentSnapshot;
        status?: 'active' | 'paused' | 'completed';
      }
    ) {
      pendingMessages = messages;
      pendingOptions = options;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        if (pendingMessages && pendingMessages.length > 1) {
          await saveSession(pendingMessages, pendingOptions);
        }
        timeoutId = null;
      }, debounceMs);
    },

    /**
     * 立即保存（不等待防抖）
     */
    async flush() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pendingMessages && pendingMessages.length > 1) {
        await saveSession(pendingMessages, pendingOptions);
      }
    },

    /**
     * 取消待定的保存
     */
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingMessages = null;
      pendingOptions = undefined;
    },
  };
}

/**
 * 根据 Agent ID 查找会话
 */
export async function findSessionByAgentId(agentId: string): Promise<Session | null> {
  const sessions = await listSessions();
  const meta = sessions.find(s => s.agentId === agentId);
  if (!meta) return null;

  try {
    return await loadSession(meta.id);
  } catch {
    return null;
  }
}

/**
 * 获取可恢复的会话列表
 * 只返回状态为 active 或 paused，且有 Agent 快照的会话
 */
export async function getResumableSessions(): Promise<SessionMeta[]> {
  const sessions = await listSessions();
  return sessions.filter(s =>
    s.agentId &&
    (s.status === 'active' || s.status === 'paused')
  );
}

/**
 * 标记会话为已完成
 */
export async function markSessionCompleted(sessionId: string): Promise<void> {
  try {
    const session = await loadSession(sessionId);
    session.status = 'completed';
    session.updatedAt = Date.now();

    const sessionPath = getSessionPath(sessionId);
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
  } catch {
    // 会话可能不存在
  }
}

/**
 * 语义化权限关键词映射
 * 覆盖常见的开发操作场景
 */
const SEMANTIC_KEYWORDS: Record<string, string[]> = {
  // 测试相关
  'run tests': ['test', 'spec', 'jest', 'mocha', 'vitest', 'pytest', 'npm test', 'pnpm test', 'yarn test', 'cargo test', 'go test', 'phpunit', 'rspec', 'unittest'],
  'test': ['test', 'spec', 'jest', 'mocha', 'vitest', 'pytest'],

  // 依赖管理
  'install dependencies': ['install', 'npm install', 'pnpm install', 'yarn add', 'yarn install', 'pip install', 'cargo build', 'go mod', 'composer install', 'bundle install', 'poetry install'],
  'install': ['install', 'add', 'npm i', 'pnpm i', 'yarn add'],
  'update dependencies': ['update', 'upgrade', 'npm update', 'pnpm update', 'yarn upgrade', 'pip install --upgrade'],

  // 构建相关
  'build project': ['build', 'compile', 'npm run build', 'pnpm build', 'yarn build', 'tsc', 'webpack', 'vite build', 'rollup', 'esbuild', 'cargo build', 'go build', 'make', 'gradle build', 'mvn compile'],
  'build': ['build', 'compile', 'tsc', 'webpack', 'vite build'],

  // 开发服务器
  'start server': ['start', 'serve', 'dev', 'npm run dev', 'npm start', 'pnpm dev', 'yarn dev', 'vite', 'next dev', 'nuxt dev', 'flask run', 'uvicorn', 'nodemon', 'ts-node'],
  'dev': ['dev', 'serve', 'start', 'run dev'],

  // 代码质量
  'lint code': ['lint', 'eslint', 'prettier', 'format', 'tslint', 'pylint', 'flake8', 'black', 'rustfmt', 'gofmt', 'rubocop', 'stylelint'],
  'lint': ['lint', 'eslint', 'prettier'],
  'format code': ['format', 'prettier', 'black', 'rustfmt', 'gofmt'],
  'format': ['format', 'prettier', 'fmt'],

  // Git 操作
  'git operations': ['git', 'commit', 'push', 'pull', 'checkout', 'branch', 'merge', 'rebase', 'stash', 'fetch', 'clone', 'reset', 'diff', 'log', 'status'],
  'git read': ['git status', 'git log', 'git diff', 'git branch', 'git show', 'git remote'],
  'git write': ['git add', 'git commit', 'git push', 'git pull', 'git merge', 'git checkout', 'git reset'],
  'commit': ['commit', 'git commit', 'git add'],

  // 数据库操作
  'database operations': ['db', 'sql', 'mysql', 'postgres', 'psql', 'sqlite', 'mongo', 'redis', 'prisma', 'migration', 'seed', 'typeorm'],
  'database read': ['select', 'query', 'find', 'get', 'list', 'show'],
  'database write': ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'migrate'],
  'run migrations': ['migrate', 'migration', 'prisma migrate', 'typeorm migration', 'sequelize db:migrate', 'rails db:migrate'],

  // Docker 操作
  'docker operations': ['docker', 'docker-compose', 'container', 'image', 'dockerfile'],
  'docker read': ['docker ps', 'docker images', 'docker logs', 'docker inspect'],
  'docker write': ['docker run', 'docker build', 'docker push', 'docker pull', 'docker stop', 'docker rm'],

  // 部署相关
  'deploy': ['deploy', 'release', 'publish', 'npm publish', 'vercel', 'netlify', 'heroku', 'aws', 'gcloud', 'azure', 'k8s', 'kubectl'],
  'deployment read': ['kubectl get', 'kubectl describe', 'kubectl logs', 'aws describe', 'gcloud list'],

  // 脚本执行
  'run scripts': ['npm run', 'pnpm run', 'yarn run', 'node', 'python', 'ruby', 'bash', 'sh', 'script'],
  'execute': ['run', 'exec', 'execute', 'node', 'python', 'bash'],

  // 清理操作
  'clean': ['clean', 'clear', 'rm -rf node_modules', 'rm -rf dist', 'rm -rf build', 'cache clean', 'prune'],

  // 类型检查
  'type check': ['tsc --noEmit', 'typecheck', 'type-check', 'mypy', 'pyright'],

  // 文档生成
  'generate docs': ['docs', 'documentation', 'typedoc', 'jsdoc', 'sphinx', 'mkdocs'],

  // API 相关
  'api calls': ['curl', 'wget', 'fetch', 'http', 'api', 'request'],

  // 包管理
  'package management': ['npm', 'pnpm', 'yarn', 'pip', 'cargo', 'go mod', 'composer', 'bundle', 'gem'],

  // 环境管理
  'environment': ['env', 'dotenv', 'export', 'source', 'nvm', 'pyenv', 'rbenv'],

  // 进程管理
  'process management': ['pm2', 'forever', 'supervisor', 'systemctl', 'service'],
};

/**
 * 命令模式匹配规则
 * 用于更精确地匹配特定命令格式
 */
const COMMAND_PATTERNS: Array<{ prompt: string; pattern: RegExp }> = [
  // npm/pnpm/yarn 命令
  { prompt: 'run tests', pattern: /^(npm|pnpm|yarn)\s+(run\s+)?(test|spec)/i },
  { prompt: 'build project', pattern: /^(npm|pnpm|yarn)\s+(run\s+)?build/i },
  { prompt: 'install dependencies', pattern: /^(npm|pnpm|yarn)\s+(install|add|i)\b/i },
  { prompt: 'start server', pattern: /^(npm|pnpm|yarn)\s+(run\s+)?(start|dev|serve)/i },
  { prompt: 'lint code', pattern: /^(npm|pnpm|yarn)\s+(run\s+)?(lint|format)/i },

  // Git 命令
  { prompt: 'git read', pattern: /^git\s+(status|log|diff|branch|show|remote|config\s+--get)/i },
  { prompt: 'git write', pattern: /^git\s+(add|commit|push|pull|merge|checkout|reset|rebase)/i },

  // Docker 命令
  { prompt: 'docker read', pattern: /^docker\s+(ps|images|logs|inspect|stats)/i },
  { prompt: 'docker write', pattern: /^docker\s+(run|build|push|pull|stop|rm|rmi)/i },

  // 数据库命令
  { prompt: 'database read', pattern: /^(mysql|psql|sqlite3?|mongo)\s+.*(-e\s+['"]?select|--eval.*find)/i },
  { prompt: 'run migrations', pattern: /(migrate|migration|db:migrate|prisma\s+migrate)/i },

  // Python 命令
  { prompt: 'run tests', pattern: /^(pytest|python\s+-m\s+pytest|python\s+-m\s+unittest)/i },
  { prompt: 'install dependencies', pattern: /^pip\s+install/i },
  { prompt: 'lint code', pattern: /^(pylint|flake8|black|mypy|ruff)/i },

  // Go 命令
  { prompt: 'run tests', pattern: /^go\s+test/i },
  { prompt: 'build project', pattern: /^go\s+build/i },
  { prompt: 'lint code', pattern: /^(golint|golangci-lint)/i },

  // Rust 命令
  { prompt: 'run tests', pattern: /^cargo\s+test/i },
  { prompt: 'build project', pattern: /^cargo\s+build/i },
  { prompt: 'lint code', pattern: /^cargo\s+(clippy|fmt)/i },

  // kubectl 命令
  { prompt: 'deployment read', pattern: /^kubectl\s+(get|describe|logs)/i },
  { prompt: 'deploy', pattern: /^kubectl\s+(apply|create|delete|rollout)/i },

  // 通用只读命令
  { prompt: 'read operations', pattern: /^(cat|head|tail|less|more|grep|find|ls|dir|pwd|echo|which|type)\b/i },
];

/**
 * 验证语义化权限是否匹配
 * 用于检查某个操作是否已被授权
 *
 * 匹配策略（按优先级）：
 * 1. 精确匹配：action 包含 prompt
 * 2. 命令模式匹配：使用正则表达式匹配命令格式
 * 3. 关键词匹配：prompt 对应的关键词在 action 中出现
 * 4. 模糊匹配：action 中的词与 prompt 的词有交集
 */
export function matchSemanticPermission(
  permissions: SemanticPermission[],
  tool: SemanticPermission['tool'],
  action: string
): SemanticPermission | undefined {
  const now = Date.now();
  const actionLower = action.toLowerCase().trim();
  const actionWords = new Set(actionLower.split(/\s+/));

  for (const perm of permissions) {
    // 检查工具类型
    if (perm.tool !== tool) continue;

    // 检查是否过期
    if (perm.expiresAt && perm.expiresAt < now) continue;

    const promptLower = perm.prompt.toLowerCase().trim();

    // 策略1：精确匹配
    if (actionLower.includes(promptLower) || promptLower.includes(actionLower)) {
      return perm;
    }

    // 策略2：命令模式匹配
    for (const { prompt, pattern } of COMMAND_PATTERNS) {
      if (prompt.toLowerCase() === promptLower && pattern.test(action)) {
        return perm;
      }
    }

    // 策略3：关键词匹配
    const keywords = SEMANTIC_KEYWORDS[promptLower];
    if (keywords) {
      if (keywords.some(kw => actionLower.includes(kw.toLowerCase()))) {
        return perm;
      }
    }

    // 策略4：模糊匹配 - 检查词的交集
    const promptWords = new Set(promptLower.split(/\s+/));
    const intersection = [...promptWords].filter(w => actionWords.has(w) && w.length > 2);
    if (intersection.length >= Math.min(2, promptWords.size)) {
      return perm;
    }

    // 策略5：同义词匹配
    if (areSynonymous(promptLower, actionLower)) {
      return perm;
    }
  }

  return undefined;
}

/**
 * 检查两个操作描述是否同义
 */
function areSynonymous(prompt: string, action: string): boolean {
  const synonymGroups = [
    ['test', 'spec', 'unittest', 'pytest', 'jest'],
    ['build', 'compile', 'make', 'bundle'],
    ['install', 'add', 'setup'],
    ['start', 'run', 'serve', 'launch', 'dev'],
    ['lint', 'check', 'validate', 'format'],
    ['deploy', 'publish', 'release', 'ship'],
    ['clean', 'clear', 'purge', 'prune'],
    ['update', 'upgrade', 'refresh'],
    ['read', 'get', 'list', 'show', 'view', 'describe'],
    ['write', 'set', 'put', 'create', 'modify', 'edit'],
    ['delete', 'remove', 'rm', 'drop', 'destroy'],
  ];

  for (const group of synonymGroups) {
    const promptMatch = group.some(word => prompt.includes(word));
    const actionMatch = group.some(word => action.includes(word));
    if (promptMatch && actionMatch) {
      return true;
    }
  }

  return false;
}

/**
 * 获取某个 prompt 的所有关联关键词
 * 用于 UI 显示或调试
 */
export function getKeywordsForPrompt(prompt: string): string[] {
  const promptLower = prompt.toLowerCase();
  return SEMANTIC_KEYWORDS[promptLower] || [];
}

/**
 * 检查一个命令是否匹配某个语义描述
 * 用于预检查，不需要实际的权限列表
 */
export function commandMatchesPrompt(command: string, prompt: string): boolean {
  const promptLower = prompt.toLowerCase();

  // 命令模式匹配
  for (const { prompt: p, pattern } of COMMAND_PATTERNS) {
    if (p.toLowerCase() === promptLower && pattern.test(command)) {
      return true;
    }
  }

  // 关键词匹配
  const keywords = SEMANTIC_KEYWORDS[promptLower];
  if (keywords) {
    const commandLower = command.toLowerCase();
    return keywords.some(kw => commandLower.includes(kw.toLowerCase()));
  }

  return false;
}
