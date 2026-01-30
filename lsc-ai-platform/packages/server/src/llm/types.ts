/**
 * 文本内容
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * 图片内容
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string; // 可以是 base64 data URL 或 http URL
    detail?: 'low' | 'high' | 'auto';
  };
}

/**
 * 多模态内容
 */
export type MessageContent = string | (TextContent | ImageContent)[];

/**
 * LLM 消息类型
 */
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: MessageContent;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  /** 输入 tokens */
  promptTokens: number;
  /** 输出 tokens */
  completionTokens: number;
  /** 总 tokens */
  totalTokens: number;
}

/**
 * LLM 响应
 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  done: boolean;
  /** Token 使用统计（如果可用） */
  usage?: TokenUsage;
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'thinking';
  content?: string;
  toolCall?: ToolCall;
  /** Token 使用统计（通常在 done 时返回） */
  usage?: TokenUsage;
}

/**
 * LLM 响应（扩展）
 */
export interface LLMResponseExtended extends LLMResponse {
  /** DeepSeek R1 的思考内容 */
  thinking?: string;
}

/**
 * LLM 请求选项
 */
export interface LLMRequestOptions {
  /** 用于中断请求的 AbortSignal */
  signal?: AbortSignal;
}

/**
 * LLM Provider 接口
 */
export interface LLMProvider {
  chat(messages: Message[], tools?: ToolDefinition[], options?: LLMRequestOptions): Promise<LLMResponse>;
  chatStream(messages: Message[], tools?: ToolDefinition[], options?: LLMRequestOptions): AsyncIterable<StreamChunk>;
}
