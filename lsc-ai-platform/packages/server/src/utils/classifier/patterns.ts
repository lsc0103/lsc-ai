/**
 * AI 内容分类模式定义
 */

import { ContentType, type ClassificationPattern, type ContentMetadata } from './types.js';

/**
 * 默认分类模式
 * 优先级说明：数字越大优先级越高
 * - 100: 结构性模式（代码块）
 * - 80: 工具意图
 * - 70: 后台任务
 * - 60: 思考过程
 * - 0: 默认对话
 */
export const DEFAULT_PATTERNS: ClassificationPattern[] = [
  // ==================== 显式思考块标记 (优先级 110) ====================
  // 支持 <thinking>...</thinking> 和 <思考>...</思考> 格式
  {
    type: ContentType.THINKING,
    pattern: /^<thinking>|^<思考>/i,
    priority: 110,
    isBlock: true,
    extractMetadata: (): ContentMetadata => ({
      isBlockStart: true,
      confidence: 1.0,
    }),
  },
  {
    type: ContentType.THINKING,
    pattern: /<\/thinking>$|<\/思考>$/i,
    priority: 110,
    isBlock: true,
    extractMetadata: (): ContentMetadata => ({
      isBlockEnd: true,
      confidence: 1.0,
    }),
  },
  // 单行思考块 <thinking>内容</thinking>
  {
    type: ContentType.THINKING,
    pattern: /^<thinking>.*<\/thinking>$|^<思考>.*<\/思考>$/i,
    priority: 110,
    extractMetadata: (): ContentMetadata => ({
      confidence: 1.0,
    }),
  },

  // ==================== 代码块检测 (优先级 100) ====================
  {
    type: ContentType.CODE,
    pattern: /^```(\w+)?$/m,
    priority: 100,
    isBlock: true,
    extractMetadata: (match): ContentMetadata => ({
      language: match[1] || 'text',
      isBlockStart: true,
    }),
  },
  {
    type: ContentType.CODE,
    pattern: /^```$/m,
    priority: 100,
    isBlock: true,
    extractMetadata: (): ContentMetadata => ({
      isBlockEnd: true,
    }),
  },

  // ==================== 工具意图检测 (优先级 80) ====================
  // 中文模式
  {
    type: ContentType.TOOL_INTENT,
    pattern: /^(我将|我要|正在|准备|开始)(执行|读取|写入|运行|创建|删除|修改|搜索|查找)/,
    priority: 80,
    extractMetadata: (_match, text): ContentMetadata => ({
      toolName: extractToolNameFromIntent(text),
      confidence: 0.9,
    }),
  },
  {
    type: ContentType.TOOL_INTENT,
    pattern: /^(执行命令|读取文件|写入文件|搜索文件|运行脚本)/,
    priority: 80,
  },
  // 英文模式
  {
    type: ContentType.TOOL_INTENT,
    pattern: /^(I'll|I will|I'm going to|Let me|Going to)\s+(run|execute|read|write|create|delete|search|find|modify)/i,
    priority: 80,
    extractMetadata: (_match, text): ContentMetadata => ({
      toolName: extractToolNameFromIntent(text),
      confidence: 0.9,
    }),
  },
  {
    type: ContentType.TOOL_INTENT,
    pattern: /^(Running|Executing|Reading|Writing|Creating|Deleting|Searching)\s/i,
    priority: 80,
  },

  // ==================== 后台任务检测 (优先级 70) ====================
  {
    type: ContentType.BACKGROUND,
    pattern: /^\[后台任务[:\s]/,
    priority: 70,
    extractMetadata: (_match, text): ContentMetadata => {
      const taskIdMatch = text.match(/#(\d+)/);
      return {
        taskId: taskIdMatch?.[1],
        confidence: 0.95,
      };
    },
  },
  {
    type: ContentType.BACKGROUND,
    pattern: /^(Background task|Task #\d+|Running in background)/i,
    priority: 70,
    extractMetadata: (_match, text): ContentMetadata => {
      const taskIdMatch = text.match(/#(\d+)/);
      return {
        taskId: taskIdMatch?.[1],
        confidence: 0.95,
      };
    },
  },
  {
    type: ContentType.BACKGROUND,
    pattern: /^\[Agent:/i,
    priority: 70,
  },

  // ==================== 思考过程检测 (优先级 60) ====================
  // 中文思考模式
  {
    type: ContentType.THINKING,
    pattern: /^(让我|我需要|首先|然后|接下来|我来|我会|考虑一下|分析一下|检查一下|查看一下|理解一下|思考一下)/,
    priority: 60,
    extractMetadata: (): ContentMetadata => ({
      confidence: 0.7,
    }),
  },
  {
    type: ContentType.THINKING,
    pattern: /^(看起来|似乎|可能|应该|需要|好的，|嗯，|那么，)/,
    priority: 55,
    extractMetadata: (): ContentMetadata => ({
      confidence: 0.6,
    }),
  },
  // 英文思考模式
  {
    type: ContentType.THINKING,
    pattern: /^(Let me|I need to|First|Then|Next|I'll|I will|Consider|Analyze|Check|Look at|Understand|Think about)/i,
    priority: 60,
    extractMetadata: (): ContentMetadata => ({
      confidence: 0.7,
    }),
  },
  {
    type: ContentType.THINKING,
    pattern: /^(It looks like|It seems|This appears|I see that|Looking at)/i,
    priority: 55,
    extractMetadata: (): ContentMetadata => ({
      confidence: 0.6,
    }),
  },

  // ==================== 列表/步骤模式 (可能是思考) (优先级 50) ====================
  {
    type: ContentType.THINKING,
    pattern: /^[-•*]\s+/,
    priority: 50,
    extractMetadata: (): ContentMetadata => ({
      confidence: 0.5,
    }),
  },
  {
    type: ContentType.THINKING,
    pattern: /^\d+\.\s+/,
    priority: 50,
    extractMetadata: (): ContentMetadata => ({
      confidence: 0.5,
    }),
  },

  // ==================== 默认对话 (优先级 0) ====================
  {
    type: ContentType.CONVERSATION,
    pattern: /.*/,
    priority: 0,
    extractMetadata: (): ContentMetadata => ({
      confidence: 1.0,
    }),
  },
];

/**
 * 从意图文本中提取工具名称
 */
function extractToolNameFromIntent(text: string): string | undefined {
  const toolPatterns: Record<string, RegExp> = {
    read: /(读取|read|cat|查看文件)/i,
    write: /(写入|write|创建文件|create file)/i,
    edit: /(编辑|修改|edit|modify)/i,
    bash: /(执行|运行|命令|run|execute|command|bash|shell)/i,
    glob: /(搜索文件|查找文件|find file|search file|glob)/i,
    grep: /(搜索内容|查找内容|search content|grep)/i,
  };

  for (const [toolName, pattern] of Object.entries(toolPatterns)) {
    if (pattern.test(text)) {
      return toolName;
    }
  }

  return undefined;
}

/**
 * 思考内容的额外指示词
 * 用于上下文增强分类
 */
export const THINKING_INDICATORS: RegExp[] = [
  /\?$/, // 问号结尾
  /:\s*$/, // 冒号结尾
  /\.{3}$/, // 省略号结尾
  /(因为|所以|但是|however|because|therefore|but)/i,
  /(我认为|我觉得|I think|I believe)/i,
];

/**
 * 对话内容的指示词
 * 用于区分思考和对话
 */
export const CONVERSATION_INDICATORS: RegExp[] = [
  /^(好的|完成|已经|Done|Finished|Complete)/i,
  /^(这是|这里是|Here is|Here's|The result)/i,
  /^(文件|代码|结果|File|Code|Result)/i,
  /！$/, // 感叹号结尾（通常是对话）
  /^(您|你|I've|I have|We|Our)/i,
];
