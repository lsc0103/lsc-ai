/**
 * AI 内容分类器实现
 * 将 AI 流式输出分类为不同类型，实现专业的 UI 展示
 */

import {
  ContentType,
  type ClassifiedContent,
  type ClassificationContext,
  type ClassificationPattern,
  type ClassifierConfig,
  type ClassifierState,
  type IContentClassifier,
} from './types.js';
import { DEFAULT_PATTERNS, THINKING_INDICATORS, CONVERSATION_INDICATORS } from './patterns.js';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<ClassifierConfig> = {
  enableThinkingDetection: true,
  enableToolIntentDetection: true,
  thinkingCollapseThreshold: 5,
  contextWindowSize: 5,
  customPatterns: [],
};

/**
 * 内容分类器
 */
export class ContentClassifier implements IContentClassifier {
  private config: Required<ClassifierConfig>;
  private state: ClassifierState;
  private patterns: ClassificationPattern[];

  constructor(config?: ClassifierConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
    this.patterns = this.buildPatterns();
  }

  /**
   * 创建初始状态
   */
  private createInitialState(): ClassifierState {
    return {
      buffer: '',
      inCodeBlock: false,
      codeLanguage: '',
      inThinkingBlock: false,
      history: [],
      consecutiveThinkingCount: 0,
      currentThinkingContent: '',
    };
  }

  /**
   * 构建分类模式列表
   */
  private buildPatterns(): ClassificationPattern[] {
    // 合并默认模式和自定义模式，按优先级排序
    const allPatterns = [...DEFAULT_PATTERNS, ...this.config.customPatterns];
    return allPatterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 分类单个文本块
   */
  classify(text: string, context?: ClassificationContext): ClassifiedContent {
    // 1. 处理代码块状态
    if (this.state.inCodeBlock) {
      return this.handleCodeBlockContent(text);
    }

    // 2. 处理显式思考块状态
    if (this.state.inThinkingBlock) {
      return this.handleThinkingBlockContent(text);
    }

    // 3. 检测显式思考块开始
    const thinkingBlockStartMatch = text.match(/^<thinking>|^<思考>/i);
    if (thinkingBlockStartMatch) {
      this.state.inThinkingBlock = true;
      this.state.currentThinkingContent = '';
      // 提取开始标签后的内容
      const contentAfterTag = text.replace(/^<thinking>|^<思考>/i, '').trim();
      if (contentAfterTag) {
        this.state.currentThinkingContent = contentAfterTag;
      }
      return {
        type: ContentType.THINKING,
        content: text,
        metadata: {
          isBlockStart: true,
          confidence: 1.0,
        },
      };
    }

    // 4. 检测代码块开始
    const codeBlockStartMatch = text.match(/^```(\w+)?/);
    if (codeBlockStartMatch) {
      this.state.inCodeBlock = true;
      this.state.codeLanguage = codeBlockStartMatch[1] || 'text';
      return {
        type: ContentType.CODE,
        content: text,
        metadata: {
          language: this.state.codeLanguage,
          isBlockStart: true,
        },
      };
    }

    // 5. 模式匹配分类
    const matchedResult = this.matchPattern(text);

    // 4. 上下文增强分类
    const enhancedType = this.enhanceWithContext(matchedResult.type, text, context);

    // 5. 更新连续思考计数
    this.updateThinkingCount(enhancedType);

    // 6. 构建结果
    const result: ClassifiedContent = {
      type: enhancedType,
      content: text,
      metadata: matchedResult.metadata,
    };

    // 7. 添加到历史
    this.state.history.push(result);
    if (this.state.history.length > this.config.contextWindowSize * 2) {
      this.state.history = this.state.history.slice(-this.config.contextWindowSize);
    }

    return result;
  }

  /**
   * 处理代码块内的内容
   */
  private handleCodeBlockContent(text: string): ClassifiedContent {
    // 检测代码块结束
    if (text.trim() === '```') {
      this.state.inCodeBlock = false;
      const language = this.state.codeLanguage;
      this.state.codeLanguage = '';
      return {
        type: ContentType.CODE,
        content: text,
        metadata: {
          language,
          isBlockEnd: true,
        },
      };
    }

    // 代码块内的内容
    return {
      type: ContentType.CODE,
      content: text,
      metadata: {
        language: this.state.codeLanguage,
      },
    };
  }

  /**
   * 处理显式思考块内的内容
   */
  private handleThinkingBlockContent(text: string): ClassifiedContent {
    // 检测思考块结束
    const endMatch = text.match(/<\/thinking>|<\/思考>/i);
    if (endMatch) {
      this.state.inThinkingBlock = false;
      // 提取结束标签前的内容
      const contentBeforeTag = text.replace(/<\/thinking>|<\/思考>/i, '').trim();
      if (contentBeforeTag) {
        this.state.currentThinkingContent += '\n' + contentBeforeTag;
      }
      const thinkingContent = this.state.currentThinkingContent;
      this.state.currentThinkingContent = '';

      return {
        type: ContentType.THINKING,
        content: text,
        metadata: {
          isBlockEnd: true,
          confidence: 1.0,
          summary: this.generateThinkingSummary(thinkingContent),
        },
      };
    }

    // 思考块内的内容
    this.state.currentThinkingContent += '\n' + text;
    this.state.consecutiveThinkingCount++;

    return {
      type: ContentType.THINKING,
      content: text,
      metadata: {
        confidence: 1.0,
      },
    };
  }

  /**
   * 生成思考内容的摘要
   */
  private generateThinkingSummary(content: string): string {
    const lines = content.trim().split('\n').filter(l => l.trim());
    if (lines.length <= 3) {
      return content.trim();
    }

    // 提取关键信息
    const first = lines[0].slice(0, 50);
    const last = lines[lines.length - 1].slice(0, 50);
    return `${first}... [${lines.length} 步思考] ...${last}`;
  }

  /**
   * 模式匹配
   */
  private matchPattern(text: string): { type: ContentType; metadata?: ClassifiedContent['metadata'] } {
    for (const pattern of this.patterns) {
      // 跳过禁用的检测
      if (pattern.type === ContentType.THINKING && !this.config.enableThinkingDetection) {
        continue;
      }
      if (pattern.type === ContentType.TOOL_INTENT && !this.config.enableToolIntentDetection) {
        continue;
      }

      const match = text.match(pattern.pattern);
      if (match) {
        const metadata = pattern.extractMetadata?.(match, text);
        return { type: pattern.type, metadata };
      }
    }

    return { type: ContentType.CONVERSATION };
  }

  /**
   * 上下文增强分类
   */
  private enhanceWithContext(
    baseType: ContentType,
    text: string,
    context?: ClassificationContext
  ): ContentType {
    // 使用内部历史或外部上下文
    const recentChunks = context?.previousChunks || this.state.history.slice(-this.config.contextWindowSize);

    // 规则 1: 如果前面正在进行工具调用，短文本可能是意图的延续
    if (context?.toolCallPending && text.length < 50 && baseType === ContentType.CONVERSATION) {
      return ContentType.TOOL_INTENT;
    }

    // 规则 2: 连续思考块后，类似内容保持为思考
    if (this.state.consecutiveThinkingCount >= 2 && baseType === ContentType.CONVERSATION) {
      if (this.looksLikeThinking(text)) {
        return ContentType.THINKING;
      }
    }

    // 规则 3: 思考后紧跟明确的对话内容，切换为对话
    if (baseType === ContentType.THINKING && this.looksLikeConversation(text)) {
      return ContentType.CONVERSATION;
    }

    // 规则 4: 检查上下文中的代码块状态
    if (context?.inCodeBlock) {
      return ContentType.CODE;
    }

    return baseType;
  }

  /**
   * 判断是否像思考内容
   */
  private looksLikeThinking(text: string): boolean {
    return THINKING_INDICATORS.some(pattern => pattern.test(text));
  }

  /**
   * 判断是否像对话内容
   */
  private looksLikeConversation(text: string): boolean {
    return CONVERSATION_INDICATORS.some(pattern => pattern.test(text));
  }

  /**
   * 更新连续思考计数
   */
  private updateThinkingCount(type: ContentType): void {
    if (type === ContentType.THINKING) {
      this.state.consecutiveThinkingCount++;
    } else if (type === ContentType.CONVERSATION || type === ContentType.TOOL_INTENT) {
      this.state.consecutiveThinkingCount = 0;
    }
  }

  /**
   * 分类流式文本（处理增量输入）
   */
  classifyStream(chunk: string, context?: ClassificationContext): ClassifiedContent[] {
    const results: ClassifiedContent[] = [];

    // 将 chunk 添加到缓冲区
    this.state.buffer += chunk;

    // 按行分割处理
    const lines = this.state.buffer.split('\n');

    // 最后一行可能不完整，保留在缓冲区
    this.state.buffer = lines.pop() || '';

    // 处理完整的行
    for (const line of lines) {
      if (line.length > 0) {
        results.push(this.classify(line + '\n', context));
      }
    }

    // 如果缓冲区有足够长的内容且没有换行符，也进行分类
    // 这处理单行长文本的流式输出
    if (this.state.buffer.length > 100) {
      results.push(this.classify(this.state.buffer, context));
      this.state.buffer = '';
    }

    return results;
  }

  /**
   * 刷新缓冲区（处理剩余内容）
   */
  flush(context?: ClassificationContext): ClassifiedContent | null {
    if (this.state.buffer.length > 0) {
      const result = this.classify(this.state.buffer, context);
      this.state.buffer = '';
      return result;
    }
    return null;
  }

  /**
   * 重置分类器状态
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * 获取当前状态
   */
  getState(): ClassifierState {
    return { ...this.state };
  }

  /**
   * 获取分类历史
   */
  getHistory(): ClassifiedContent[] {
    return [...this.state.history];
  }

  /**
   * 生成思考内容的摘要
   */
  static summarizeThinking(chunks: ClassifiedContent[]): string {
    const thinkingChunks = chunks.filter(c => c.type === ContentType.THINKING);
    if (thinkingChunks.length <= 3) {
      return thinkingChunks.map(c => c.content).join('');
    }

    // 只显示首尾和数量提示
    const first = thinkingChunks[0].content.slice(0, 50);
    const last = thinkingChunks[thinkingChunks.length - 1].content.slice(-50);
    return `${first}... [${thinkingChunks.length} 步思考] ...${last}`;
  }
}
