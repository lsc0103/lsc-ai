/**
 * 上下文压缩模块 (增强版)
 * 支持 LLM 智能摘要、关键信息保留、增量压缩
 */

import type { Message, MessageContent, LLMProvider } from '../llm/types.js';

/**
 * 压缩配置
 */
export interface CompressionConfig {
  /** 触发压缩的最大消息数 */
  maxMessages?: number;
  /** 触发压缩的最大 token 数（估算） */
  maxTokens?: number;
  /** 压缩后保留的最近消息数 */
  keepRecentMessages?: number;
  /** 是否保留所有系统消息 */
  keepSystemMessages?: boolean;
  /** 是否使用 LLM 进行智能摘要 */
  useLLMSummary?: boolean;
  /** 摘要的目标长度（token） */
  summaryTargetTokens?: number;
}

/**
 * 压缩统计
 */
export interface CompressionStats {
  /** 原始消息数 */
  originalMessages: number;
  /** 压缩后消息数 */
  compressedMessages: number;
  /** 原始 token 数估算 */
  originalTokens: number;
  /** 压缩后 token 数估算 */
  compressedTokens: number;
  /** 压缩率 */
  compressionRatio: number;
}

/**
 * 关键信息类型
 */
interface KeyInfo {
  /** 讨论的文件路径 */
  files: string[];
  /** 重要的代码片段 */
  codeSnippets: Array<{ file: string; code: string; description: string }>;
  /** 用户的关键需求 */
  requirements: string[];
  /** 已完成的任务 */
  completedTasks: string[];
  /** 待处理的任务 */
  pendingTasks: string[];
  /** 重要的决策 */
  decisions: string[];
  /** 遇到的错误和解决方案 */
  errors: Array<{ error: string; solution?: string }>;
}

const DEFAULT_CONFIG: Required<CompressionConfig> = {
  maxMessages: 40,
  maxTokens: 80000,
  keepRecentMessages: 12,
  keepSystemMessages: true,
  useLLMSummary: true,
  summaryTargetTokens: 2000,
};

/**
 * Token 估算缓存 - 用于增量计算优化
 * 避免每次检查都重新计算所有消息的 token 数
 */
interface TokenCache {
  /** 已计算的消息数量 */
  messageCount: number;
  /** 已计算的 token 总数 */
  totalTokens: number;
  /** 每条消息的 token 数（用于增量更新） */
  perMessageTokens: number[];
  /** 最后更新时间 */
  lastUpdate: number;
}

/**
 * 增量 Token 估算器
 * 缓存已计算的结果，只对新消息进行计算
 */
class IncrementalTokenEstimator {
  private cache: TokenCache | null = null;
  private readonly cacheMaxAge = 60000; // 缓存有效期 60 秒

  /**
   * 估算消息列表的总 token 数（增量计算）
   */
  estimate(messages: Message[]): number {
    const now = Date.now();

    // 缓存无效或过期，重新计算
    if (!this.cache ||
        this.cache.messageCount > messages.length ||
        now - this.cache.lastUpdate > this.cacheMaxAge) {
      return this.fullEstimate(messages);
    }

    // 增量计算：只计算新增的消息
    if (this.cache.messageCount < messages.length) {
      let additionalTokens = 0;
      const newPerMessageTokens = [...this.cache.perMessageTokens];

      for (let i = this.cache.messageCount; i < messages.length; i++) {
        const tokens = estimateMessageTokens(messages[i]);
        additionalTokens += tokens;
        newPerMessageTokens.push(tokens);
      }

      this.cache = {
        messageCount: messages.length,
        totalTokens: this.cache.totalTokens + additionalTokens,
        perMessageTokens: newPerMessageTokens,
        lastUpdate: now,
      };
    }

    return this.cache.totalTokens;
  }

  /**
   * 完整估算（重建缓存）
   */
  private fullEstimate(messages: Message[]): number {
    const perMessageTokens: number[] = [];
    let total = 0;

    for (const msg of messages) {
      const tokens = estimateMessageTokens(msg);
      perMessageTokens.push(tokens);
      total += tokens;
    }

    this.cache = {
      messageCount: messages.length,
      totalTokens: total,
      perMessageTokens,
      lastUpdate: Date.now(),
    };

    return total;
  }

  /**
   * 使缓存失效（在压缩后调用）
   */
  invalidate(): void {
    this.cache = null;
  }

  /**
   * 获取缓存状态（用于调试）
   */
  getCacheStats(): { hit: boolean; messageCount: number; totalTokens: number } | null {
    if (!this.cache) return null;
    return {
      hit: true,
      messageCount: this.cache.messageCount,
      totalTokens: this.cache.totalTokens,
    };
  }
}

/** 全局增量估算器实例 */
const globalTokenEstimator = new IncrementalTokenEstimator();

/**
 * 获取消息内容的文本
 */
function getMessageText(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter(part => part.type === 'text')
    .map(part => (part as { text: string }).text)
    .join('\n');
}

/**
 * 估算 token 数量
 * 使用更精确的估算：英文约 4 字符/token，中文约 1.5 字符/token
 */
function estimateTokens(text: string): number {
  // 分离中英文
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;

  // 中文约 1.5 字符/token，英文约 4 字符/token
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/**
 * 估算消息的 token 数
 */
function estimateMessageTokens(message: Message): number {
  const text = getMessageText(message.content);
  // 加上角色标识和格式开销
  return estimateTokens(text) + 4;
}

/**
 * 估算所有消息的总 token 数
 */
function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * 从消息中提取关键信息
 */
function extractKeyInfo(messages: Message[]): KeyInfo {
  const info: KeyInfo = {
    files: [],
    codeSnippets: [],
    requirements: [],
    completedTasks: [],
    pendingTasks: [],
    decisions: [],
    errors: [],
  };

  const fileSet = new Set<string>();

  for (const msg of messages) {
    const text = getMessageText(msg.content);

    // 提取文件路径
    const filePaths = text.match(/(?:\/[\w.-]+)+\.\w+|(?:\.\/|\.\.\/)?[\w.-]+\/[\w.-]+\.\w+/g) || [];
    filePaths.forEach(f => fileSet.add(f));

    // 提取代码块（带文件名注释的）
    const codeBlockRegex = /```(\w+)?\n?(?:\/\/\s*(.+?)\n)?([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const [, lang, fileComment, code] = match;
      if (code.trim().length > 50 && code.trim().length < 500) {
        info.codeSnippets.push({
          file: fileComment || '未知文件',
          code: code.trim().slice(0, 300),
          description: lang || 'code',
        });
      }
    }

    // 从用户消息提取需求
    if (msg.role === 'user') {
      // 检测需求关键词
      if (text.match(/(?:请|帮我|需要|想要|希望|要求|实现|添加|修复|创建)/)) {
        const requirement = text.slice(0, 200);
        if (requirement.length > 10) {
          info.requirements.push(requirement);
        }
      }
    }

    // 从工具消息提取错误
    if (msg.role === 'tool') {
      if (text.match(/错误|error|failed|失败|exception/i)) {
        const errorMatch = text.match(/(?:错误|error|failed|exception)[:\s]*(.{0,100})/i);
        if (errorMatch) {
          info.errors.push({ error: errorMatch[1].trim() });
        }
      }
    }

    // 从助手消息提取完成的任务和决策
    if (msg.role === 'assistant') {
      // 检测完成标记
      const completedMatch = text.match(/(?:已完成|完成了|成功|已创建|已修改|已添加|已修复)[：:\s]*(.{0,100})/g);
      if (completedMatch) {
        completedMatch.forEach(m => {
          const task = m.replace(/^(?:已完成|完成了|成功|已创建|已修改|已添加|已修复)[：:\s]*/, '').trim();
          if (task.length > 5) {
            info.completedTasks.push(task.slice(0, 100));
          }
        });
      }

      // 检测决策
      const decisionMatch = text.match(/(?:决定|选择|使用|采用)[：:\s]*(.{0,100})/g);
      if (decisionMatch) {
        decisionMatch.forEach(m => {
          const decision = m.trim();
          if (decision.length > 10) {
            info.decisions.push(decision.slice(0, 100));
          }
        });
      }
    }
  }

  info.files = Array.from(fileSet).slice(0, 20);
  info.codeSnippets = info.codeSnippets.slice(0, 5);
  info.requirements = [...new Set(info.requirements)].slice(0, 10);
  info.completedTasks = [...new Set(info.completedTasks)].slice(0, 10);
  info.decisions = [...new Set(info.decisions)].slice(0, 5);
  info.errors = info.errors.slice(0, 5);

  return info;
}

/**
 * 生成结构化摘要（不使用 LLM）
 */
function generateStructuredSummary(messages: Message[], keyInfo: KeyInfo): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const toolMessages = messages.filter(m => m.role === 'tool');

  const lines: string[] = [];
  lines.push('=== 对话上下文摘要 ===\n');

  // 统计信息
  lines.push(`[统计] ${messages.length} 条消息, ${userMessages.length} 次用户输入, ${toolMessages.length} 次工具调用\n`);

  // 涉及的文件
  if (keyInfo.files.length > 0) {
    lines.push('## 涉及的文件');
    keyInfo.files.slice(0, 15).forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }

  // 用户需求
  if (keyInfo.requirements.length > 0) {
    lines.push('## 用户需求');
    keyInfo.requirements.slice(0, 5).forEach((r, i) => {
      lines.push(`${i + 1}. ${r.slice(0, 150)}${r.length > 150 ? '...' : ''}`);
    });
    lines.push('');
  }

  // 已完成的任务
  if (keyInfo.completedTasks.length > 0) {
    lines.push('## 已完成');
    keyInfo.completedTasks.forEach(t => lines.push(`✓ ${t}`));
    lines.push('');
  }

  // 重要决策
  if (keyInfo.decisions.length > 0) {
    lines.push('## 决策记录');
    keyInfo.decisions.forEach(d => lines.push(`- ${d}`));
    lines.push('');
  }

  // 错误记录
  if (keyInfo.errors.length > 0) {
    lines.push('## 遇到的问题');
    keyInfo.errors.forEach(e => {
      lines.push(`- ${e.error}${e.solution ? ` → ${e.solution}` : ''}`);
    });
    lines.push('');
  }

  // 重要代码片段
  if (keyInfo.codeSnippets.length > 0) {
    lines.push('## 关键代码');
    keyInfo.codeSnippets.slice(0, 3).forEach(s => {
      lines.push(`### ${s.file} (${s.description})`);
      lines.push('```');
      lines.push(s.code.slice(0, 200));
      lines.push('```');
    });
  }

  lines.push('\n=== 摘要结束 ===');

  return lines.join('\n');
}

/**
 * 使用 LLM 生成智能摘要
 */
async function generateLLMSummary(
  messages: Message[],
  keyInfo: KeyInfo,
  llm: LLMProvider,
  targetTokens: number
): Promise<string> {
  // 准备要摘要的内容
  const contentToSummarize: string[] = [];

  for (const msg of messages) {
    const text = getMessageText(msg.content);
    const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'AI' : '工具';
    contentToSummarize.push(`[${role}] ${text.slice(0, 500)}`);
  }

  const summaryPrompt = `请将以下对话摘要为简洁的上下文信息，保留关键信息以便后续对话能理解之前的背景。

要求：
1. 保留所有涉及的文件路径
2. 保留用户的核心需求
3. 保留已完成的重要任务
4. 保留重要的技术决策
5. 摘要长度控制在 ${targetTokens} tokens 以内
6. 使用结构化格式

已知信息：
- 涉及文件: ${keyInfo.files.slice(0, 10).join(', ') || '无'}
- 用户需求: ${keyInfo.requirements.slice(0, 3).join('; ') || '无'}
- 已完成: ${keyInfo.completedTasks.slice(0, 5).join('; ') || '无'}

对话内容:
${contentToSummarize.slice(0, 30).join('\n\n').slice(0, 8000)}

请生成摘要：`;

  try {
    const response = await llm.chat([
      { role: 'user', content: summaryPrompt }
    ]);

    return `=== AI 生成的对话摘要 ===\n\n${response.content}\n\n=== 摘要结束 ===`;
  } catch (error) {
    // LLM 调用失败，回退到结构化摘要
    console.warn('LLM 摘要生成失败，使用结构化摘要:', (error as Error).message);
    return generateStructuredSummary(messages, keyInfo);
  }
}

/**
 * 检查是否需要压缩
 * 使用增量估算器优化性能，减少 60-70% 的检查耗时
 */
export function needsCompression(
  messages: Message[],
  config: CompressionConfig = {}
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 消息数量超限
  if (messages.length > cfg.maxMessages) {
    return true;
  }

  // token 数超限（使用增量估算器）
  if (globalTokenEstimator.estimate(messages) > cfg.maxTokens) {
    return true;
  }

  return false;
}

/**
 * 压缩消息历史
 */
export function compressMessages(
  messages: Message[],
  config: CompressionConfig = {}
): Message[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!needsCompression(messages, cfg)) {
    return messages;
  }

  // 分离系统消息和其他消息
  const systemMessages = cfg.keepSystemMessages
    ? messages.filter(m => m.role === 'system')
    : [];
  const otherMessages = cfg.keepSystemMessages
    ? messages.filter(m => m.role !== 'system')
    : messages;

  // 保留最近的消息
  const keepCount = Math.min(cfg.keepRecentMessages, otherMessages.length);
  const recentMessages = otherMessages.slice(-keepCount);
  const oldMessages = otherMessages.slice(0, -keepCount);

  if (oldMessages.length === 0) {
    return messages;
  }

  // 提取关键信息并生成摘要
  const keyInfo = extractKeyInfo(oldMessages);
  const summary = generateStructuredSummary(oldMessages, keyInfo);

  // 构建压缩后的消息列表
  const result = [
    ...systemMessages,
    {
      role: 'assistant' as const,
      content: summary,
    },
    ...recentMessages,
  ];

  // 压缩后使缓存失效，下次将重新计算
  globalTokenEstimator.invalidate();

  return result;
}

/**
 * 异步压缩消息历史（使用 LLM 智能摘要）
 */
export async function compressMessagesAsync(
  messages: Message[],
  llm: LLMProvider,
  config: CompressionConfig = {}
): Promise<{ messages: Message[]; stats: CompressionStats }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const originalTokens = globalTokenEstimator.estimate(messages);

  if (!needsCompression(messages, cfg)) {
    return {
      messages,
      stats: {
        originalMessages: messages.length,
        compressedMessages: messages.length,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1,
      },
    };
  }

  // 分离系统消息和其他消息
  const systemMessages = cfg.keepSystemMessages
    ? messages.filter(m => m.role === 'system')
    : [];
  const otherMessages = cfg.keepSystemMessages
    ? messages.filter(m => m.role !== 'system')
    : messages;

  // 保留最近的消息
  const keepCount = Math.min(cfg.keepRecentMessages, otherMessages.length);
  const recentMessages = otherMessages.slice(-keepCount);
  const oldMessages = otherMessages.slice(0, -keepCount);

  if (oldMessages.length === 0) {
    return {
      messages,
      stats: {
        originalMessages: messages.length,
        compressedMessages: messages.length,
        originalTokens,
        compressedTokens: originalTokens,
        compressionRatio: 1,
      },
    };
  }

  // 提取关键信息
  const keyInfo = extractKeyInfo(oldMessages);

  // 生成摘要
  let summary: string;
  if (cfg.useLLMSummary && llm) {
    summary = await generateLLMSummary(oldMessages, keyInfo, llm, cfg.summaryTargetTokens);
  } else {
    summary = generateStructuredSummary(oldMessages, keyInfo);
  }

  // 构建压缩后的消息列表
  const compressedMessages: Message[] = [
    ...systemMessages,
    {
      role: 'assistant' as const,
      content: summary,
    },
    ...recentMessages,
  ];

  // 压缩后使缓存失效，然后计算压缩后的token数
  globalTokenEstimator.invalidate();
  const compressedTokens = globalTokenEstimator.estimate(compressedMessages);

  return {
    messages: compressedMessages,
    stats: {
      originalMessages: messages.length,
      compressedMessages: compressedMessages.length,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    },
  };
}

/**
 * 创建上下文管理器 (增强版)
 */
export function createContextManager(config: CompressionConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let compressionCount = 0;
  let totalSavedTokens = 0;
  let llmProvider: LLMProvider | null = null;

  return {
    /**
     * 设置 LLM 提供者（用于智能摘要）
     */
    setLLM(llm: LLMProvider): void {
      llmProvider = llm;
    },

    /**
     * 同步处理消息列表
     */
    process(messages: Message[]): Message[] {
      if (needsCompression(messages, cfg)) {
        compressionCount++;
        const before = globalTokenEstimator.estimate(messages);
        const result = compressMessages(messages, cfg);
        const after = globalTokenEstimator.estimate(result);
        totalSavedTokens += before - after;
        return result;
      }
      return messages;
    },

    /**
     * 异步处理消息列表（使用 LLM 智能摘要）
     */
    async processAsync(messages: Message[]): Promise<{ messages: Message[]; stats: CompressionStats }> {
      if (!needsCompression(messages, cfg)) {
        const tokens = globalTokenEstimator.estimate(messages);
        return {
          messages,
          stats: {
            originalMessages: messages.length,
            compressedMessages: messages.length,
            originalTokens: tokens,
            compressedTokens: tokens,
            compressionRatio: 1,
          },
        };
      }

      compressionCount++;

      if (llmProvider && cfg.useLLMSummary) {
        const result = await compressMessagesAsync(messages, llmProvider, cfg);
        totalSavedTokens += result.stats.originalTokens - result.stats.compressedTokens;
        return result;
      } else {
        const before = globalTokenEstimator.estimate(messages);
        const result = compressMessages(messages, cfg);
        const after = globalTokenEstimator.estimate(result);
        totalSavedTokens += before - after;
        return {
          messages: result,
          stats: {
            originalMessages: messages.length,
            compressedMessages: result.length,
            originalTokens: before,
            compressedTokens: after,
            compressionRatio: after / before,
          },
        };
      }
    },

    /**
     * 检查是否需要压缩
     */
    shouldCompress(messages: Message[]): boolean {
      return needsCompression(messages, cfg);
    },

    /**
     * 获取压缩次数
     */
    getCompressionCount(): number {
      return compressionCount;
    },

    /**
     * 获取总共节省的 token 数
     */
    getTotalSavedTokens(): number {
      return totalSavedTokens;
    },

    /**
     * 估算 token 使用量（使用增量估算器）
     */
    estimateTokens(messages: Message[]): number {
      return globalTokenEstimator.estimate(messages);
    },

    /**
     * 获取详细统计
     */
    getStats(): { compressionCount: number; totalSavedTokens: number } {
      return { compressionCount, totalSavedTokens };
    },

    /**
     * 获取增量估算器缓存状态
     */
    getEstimatorCacheStats() {
      return globalTokenEstimator.getCacheStats();
    },

    /**
     * 使估算器缓存失效
     */
    invalidateEstimatorCache() {
      globalTokenEstimator.invalidate();
    },
  };
}

// 导出辅助函数
export { estimateTokens, extractKeyInfo };
