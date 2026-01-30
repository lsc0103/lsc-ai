/**
 * AI 内容分类系统 - 类型定义
 * 向 Claude Code 看齐，将 AI 输出分为不同类型
 */

/**
 * 内容类型枚举
 */
export enum ContentType {
  /** 正常对话内容 - 流式打字效果 */
  CONVERSATION = 'conversation',

  /** AI 思考/推理过程 - 可折叠显示 */
  THINKING = 'thinking',

  /** 准备执行操作的意图描述 - 简短状态提示 */
  TOOL_INTENT = 'tool_intent',

  /** 工具调用 - 工具卡片 UI */
  TOOL_CALL = 'tool_call',

  /** 后台任务状态 - 后台任务面板 */
  BACKGROUND = 'background',

  /** 代码块 - 语法高亮 */
  CODE = 'code',

  /** 系统消息 - 灰色提示 */
  SYSTEM = 'system',
}

/**
 * 分类后的内容块
 */
export interface ClassifiedContent {
  /** 内容类型 */
  type: ContentType;

  /** 原始内容 */
  content: string;

  /** 元数据（可选） */
  metadata?: ContentMetadata;
}

/**
 * 内容元数据
 */
export interface ContentMetadata {
  /** 代码语言（CODE 类型） */
  language?: string;

  /** 思考摘要（THINKING 类型） */
  summary?: string;

  /** 工具名称（TOOL_INTENT 类型） */
  toolName?: string;

  /** 后台任务 ID（BACKGROUND 类型） */
  taskId?: string;

  /** 置信度分数 0-1 */
  confidence?: number;

  /** 是否为块的开始 */
  isBlockStart?: boolean;

  /** 是否为块的结束 */
  isBlockEnd?: boolean;
}

/**
 * 分类规则模式
 */
export interface ClassificationPattern {
  /** 目标类型 */
  type: ContentType;

  /** 正则表达式模式 */
  pattern: RegExp;

  /** 优先级（数字越大优先级越高） */
  priority: number;

  /** 是否为块级模式（跨多行） */
  isBlock?: boolean;

  /** 提取元数据的函数 */
  extractMetadata?: (match: RegExpMatchArray, text: string) => ContentMetadata;
}

/**
 * 分类上下文
 */
export interface ClassificationContext {
  /** 之前的内容块 */
  previousChunks?: ClassifiedContent[];

  /** 当前工具调用状态 */
  toolCallPending?: boolean;

  /** 当前是否在代码块中 */
  inCodeBlock?: boolean;

  /** 当前代码语言 */
  codeLanguage?: string;

  /** 当前是否在思考块中 */
  inThinkingBlock?: boolean;
}

/**
 * 分类器内部状态
 */
export interface ClassifierState {
  /** 文本缓冲区 */
  buffer: string;

  /** 是否在代码块中 */
  inCodeBlock: boolean;

  /** 当前代码语言 */
  codeLanguage: string;

  /** 是否在显式思考块中 */
  inThinkingBlock: boolean;

  /** 分类历史 */
  history: ClassifiedContent[];

  /** 连续思考块计数 */
  consecutiveThinkingCount: number;

  /** 当前思考块内容（用于折叠/摘要） */
  currentThinkingContent: string;
}

/**
 * 分类器配置
 */
export interface ClassifierConfig {
  /** 是否启用思考检测 */
  enableThinkingDetection?: boolean;

  /** 是否启用工具意图检测 */
  enableToolIntentDetection?: boolean;

  /** 思考内容的最大显示行数（折叠阈值） */
  thinkingCollapseThreshold?: number;

  /** 上下文窗口大小（用于上下文分析） */
  contextWindowSize?: number;

  /** 自定义分类规则 */
  customPatterns?: ClassificationPattern[];
}

/**
 * 分类器接口
 */
export interface IContentClassifier {
  /** 分类单个文本块 */
  classify(text: string, context?: ClassificationContext): ClassifiedContent;

  /** 分类流式文本（处理增量输入） */
  classifyStream(chunk: string, context?: ClassificationContext): ClassifiedContent[];

  /** 重置分类器状态 */
  reset(): void;

  /** 获取当前状态 */
  getState(): ClassifierState;
}
