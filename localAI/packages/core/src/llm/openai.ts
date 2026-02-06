import type { LLMProvider, Message, ToolDefinition, LLMResponse, StreamChunk, ToolCall, LLMRequestOptions, MessageContent } from './types.js';

/**
 * API 错误类型
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'APIError';
  }

  static fromResponse(status: number, body: string): APIError {
    let message = `API 请求失败: ${status}`;
    let code: string | undefined;
    let retryable = false;
    let retryAfter: number | undefined;

    try {
      const parsed = JSON.parse(body);
      message = parsed.error?.message || parsed.message || message;
      code = parsed.error?.code || parsed.code;
    } catch {
      message = body || message;
    }

    // 判断是否可重试
    if (status === 429) {
      retryable = true;
      code = 'rate_limit';
      // 尝试解析 Retry-After
      const match = body.match(/retry.?after[:\s]+(\d+)/i);
      if (match) {
        retryAfter = parseInt(match[1], 10) * 1000;
      }
    } else if (status >= 500 && status < 600) {
      retryable = true;
      code = 'server_error';
    } else if (status === 408 || status === 504) {
      retryable = true;
      code = 'timeout';
    }

    return new APIError(message, status, code, retryable, retryAfter);
  }
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数（默认 3） */
  maxRetries: number;
  /** 初始延迟毫秒（默认 1000） */
  initialDelayMs: number;
  /** 最大延迟毫秒（默认 30000） */
  maxDelayMs: number;
  /** 退避乘数（默认 2） */
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * OpenAI Provider 配置选项
 */
export interface OpenAIProviderOptions {
  baseURL: string;
  apiKey: string;
  model: string;
  /** 是否在请求中发送 model 参数 */
  sendModelParam?: boolean;
  /** 是否使用原生 Function Calling（默认 true） */
  useNativeFunctionCalling?: boolean;
  /** 请求超时毫秒（默认 120000） */
  timeoutMs?: number;
  /** 重试配置 */
  retryConfig?: Partial<RetryConfig>;
}

/**
 * 远程模型配置
 */
export interface RemoteModelConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  sendModelParam?: boolean;
  useNativeFunctionCalling?: boolean;
}

/**
 * 预定义的远程模型列表
 */
export const REMOTE_MODELS: RemoteModelConfig[] = [
  // DeepSeek 官方 API（支持 Function Calling）
  {
    name: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com',
    apiKey: '', // 从配置读取
    model: 'deepseek-chat',
    useNativeFunctionCalling: true,
  },
  {
    name: 'deepseek-reasoner',
    baseURL: 'https://api.deepseek.com',
    apiKey: '', // 从配置读取
    model: 'deepseek-reasoner',
    useNativeFunctionCalling: true,
  },
  // 公司部署的 API（已确认支持 Function Calling）
  {
    name: 'DeepSeek-R1',
    baseURL: 'http://10.18.55.233:30069/deepseek_r1/chi/v1',
    apiKey: process.env.DEEPSEEK_R1_API_KEY || 'your-internal-api-key-here',
    model: 'DeepSeek-R1',
    useNativeFunctionCalling: true,
  },
  {
    name: 'DeepSeek-V3',
    baseURL: 'http://10.18.55.233:30069/deepseek_v3/chi/v1',
    apiKey: process.env.DEEPSEEK_API_KEY || 'your-internal-api-key-here',
    model: 'DeepSeek-V3',
    useNativeFunctionCalling: true,
  },
  {
    name: 'DeepSeek-R1-Distill-Qwen-32B',
    baseURL: 'http://10.18.55.233:30069/deepSeek-r1-distill-qwen-32b/chi/v1',
    apiKey: process.env.DEEPSEEK_R1_DISTILL_API_KEY || 'your-internal-api-key-here',
    model: 'DeepSeek-R1-Distill-Qwen-32B',
    useNativeFunctionCalling: true,
  },
  {
    name: 'Qwen2.5-72B-Instruct',
    baseURL: 'http://10.18.55.233:30069/qwen2.5-72b-instruct/chi/v1',
    apiKey: process.env.QWEN_72B_API_KEY || 'your-internal-api-key-here',
    model: 'Qwen2.5-72B-Instruct',
    useNativeFunctionCalling: true,
  },
  {
    name: 'Qwen2.5-VL-32B-Instruct',
    baseURL: 'http://10.18.55.233:30069/qwen2.5-vl-32b-instruct/chi/v1',
    apiKey: process.env.QWEN_VL_API_KEY || 'your-internal-api-key-here',
    model: 'Qwen2.5-VL-32B-Instruct',
    useNativeFunctionCalling: true,
  },
];

// ============================================================
// Thinking Mode 解析（DeepSeek R1 的 <think> 标签）
// ============================================================

/**
 * 解析并分离 thinking 内容
 */
function parseThinkingContent(text: string): { thinking: string; content: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let thinking = '';
  let content = text;

  let match;
  while ((match = thinkRegex.exec(text)) !== null) {
    thinking += match[1].trim() + '\n';
  }

  // 移除 thinking 标签
  content = text.replace(thinkRegex, '').trim();

  return { thinking: thinking.trim(), content };
}

// ============================================================
// 文本解析 Fallback（当不支持原生 Function Calling 时使用）
// ============================================================

/**
 * 从文本中解析工具调用（Fallback 模式）
 */
function parseToolCallsFromText(text: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  let callIndex = 0;

  // 匹配 ```json ... ``` 代码块中的工具调用
  const jsonBlockRegex = /```(?:json)?\s*\n?\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*\n?\s*```/g;
  let match;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool && typeof parsed.tool === 'string') {
        toolCalls.push({
          id: `call_${Date.now()}_${callIndex++}`,
          name: parsed.tool,
          arguments: parsed.args || {},
        });
      }
    } catch {
      // JSON 解析失败，继续
    }
  }

  // 如果没找到代码块格式，尝试行内 JSON
  if (toolCalls.length === 0) {
    const inlineRegex = /\{"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]*\})\s*\}/g;
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        toolCalls.push({
          id: `call_${Date.now()}_${callIndex++}`,
          name: match[1],
          arguments: args,
        });
      } catch {
        // 解析失败，继续
      }
    }
  }

  return toolCalls;
}

/**
 * 生成工具使用的提示词（Fallback 模式）
 */
function generateToolPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools.map(tool => {
    const params = Object.entries(tool.parameters.properties)
      .map(([name, prop]) => `    - ${name}: ${prop.description}${tool.parameters.required?.includes(name) ? ' (必需)' : ' (可选)'}`)
      .join('\n');
    return `- **${tool.name}**: ${tool.description}\n  参数:\n${params}`;
  }).join('\n\n');

  return `

# 可用工具

${toolDescriptions}

# 工具调用格式

当需要使用工具时，输出 JSON 代码块：

\`\`\`json
{"tool": "工具名", "args": {"参数名": "参数值"}}
\`\`\`

# 并行工具调用

当多个工具调用**互相独立**时，可以在一次响应中同时调用多个工具：

\`\`\`json
{"tool": "read", "args": {"file_path": "package.json"}}
\`\`\`

\`\`\`json
{"tool": "read", "args": {"file_path": "tsconfig.json"}}
\`\`\``;
}

// ============================================================
// OpenAI 兼容 Provider
// ============================================================

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算重试延迟（指数退避 + 抖动）
 */
function calculateRetryDelay(attempt: number, config: RetryConfig, retryAfter?: number): number {
  if (retryAfter) {
    return Math.min(retryAfter, config.maxDelayMs);
  }

  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% 抖动
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // 合并现有的 signal
  const existingSignal = options.signal;
  if (existingSignal) {
    existingSignal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * OpenAI 兼容的 LLM Provider
 * 支持 DeepSeek、Qwen 等兼容 OpenAI API 的模型
 *
 * 特性：
 * - 原生 Function Calling 支持
 * - Thinking Mode 解析
 * - 自动重试（指数退避）
 * - 请求超时控制
 * - Rate Limiting 处理
 */
export class OpenAIProvider implements LLMProvider {
  private baseURL: string;
  private apiKey: string;
  private model: string;
  private sendModelParam: boolean;
  private useNativeFunctionCalling: boolean;
  private timeoutMs: number;
  private retryConfig: RetryConfig;

  constructor(options: OpenAIProviderOptions) {
    this.baseURL = options.baseURL.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.sendModelParam = options.sendModelParam ?? true;
    this.useNativeFunctionCalling = options.useNativeFunctionCalling ?? true;
    this.timeoutMs = options.timeoutMs ?? 120000; // 默认 2 分钟超时
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  }

  getModel(): string {
    return this.model;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * 设置是否使用原生 Function Calling
   */
  setUseNativeFunctionCalling(use: boolean): void {
    this.useNativeFunctionCalling = use;
  }

  /**
   * 将内部消息格式转换为 OpenAI 格式
   */
  private formatMessages(messages: Message[], tools?: ToolDefinition[]) {
    const formatted: any[] = [];

    for (const msg of messages) {
      const formatContent = (content: MessageContent): any => {
        if (typeof content === 'string') {
          return content;
        }
        return content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image_url') {
            return {
              type: 'image_url',
              image_url: {
                url: part.image_url.url,
                detail: part.image_url.detail || 'auto',
              },
            };
          }
          return { type: 'text', text: '' };
        });
      };

      if (msg.role === 'tool') {
        if (this.useNativeFunctionCalling) {
          // 原生模式：使用标准 tool 消息格式
          formatted.push({
            role: 'tool',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            tool_call_id: msg.toolCallId,
          });
        } else {
          // Fallback 模式：转换为 user 消息
          const content = msg.content;
          if (typeof content === 'string') {
            formatted.push({
              role: 'user',
              content: `[工具 ${msg.toolCallId} 的结果]:\n${content}`,
            });
          } else {
            formatted.push({
              role: 'user',
              content: [
                { type: 'text', text: `[工具 ${msg.toolCallId} 的结果]:` },
                ...formatContent(content),
              ],
            });
          }
        }
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        if (this.useNativeFunctionCalling) {
          // 原生模式：包含 tool_calls
          formatted.push({
            role: 'assistant',
            content: typeof msg.content === 'string' ? msg.content : null,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          });
        } else {
          // Fallback 模式：普通 assistant 消息
          formatted.push({
            role: 'assistant',
            content: formatContent(msg.content),
          });
        }
      } else {
        formatted.push({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: formatContent(msg.content),
        });
      }
    }

    // Fallback 模式：在系统消息中添加工具说明
    if (!this.useNativeFunctionCalling && tools && tools.length > 0 && formatted.length > 0 && formatted[0].role === 'system') {
      const systemContent = formatted[0].content;
      if (typeof systemContent === 'string') {
        formatted[0].content = systemContent + generateToolPrompt(tools);
      }
    }

    return formatted;
  }

  /**
   * 构建 tools 参数（原生 Function Calling 模式）
   */
  private formatTools(tools?: ToolDefinition[]): any[] | undefined {
    if (!this.useNativeFunctionCalling || !tools || tools.length === 0) {
      return undefined;
    }

    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * 非流式对话（带重试）
   */
  async chat(messages: Message[], tools?: ToolDefinition[], options?: LLMRequestOptions): Promise<LLMResponse> {
    const formattedTools = this.formatTools(tools);

    const body: any = {
      ...(this.sendModelParam ? { model: this.model } : {}),
      messages: this.formatMessages(messages, tools),
      stream: false,
    };

    if (formattedTools) {
      body.tools = formattedTools;
      body.tool_choice = 'auto';
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // 检查是否已中断
        if (options?.signal?.aborted) {
          throw new DOMException('请求已中断', 'AbortError');
        }

        const response = await fetchWithTimeout(
          `${this.baseURL}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: options?.signal,
          },
          this.timeoutMs
        );

        if (!response.ok) {
          const errorBody = await response.text();
          const apiError = APIError.fromResponse(response.status, errorBody);

          // 如果不可重试或已达最大重试次数，抛出错误
          if (!apiError.retryable || attempt >= this.retryConfig.maxRetries) {
            throw apiError;
          }

          // 计算重试延迟
          const delay = calculateRetryDelay(attempt, this.retryConfig, apiError.retryAfter);
          lastError = apiError;
          await sleep(delay);
          continue;
        }

        const data = await response.json() as any;
        const message = data.choices?.[0]?.message;
        let content = message?.content || '';

        // 解析 Thinking 内容
        const { thinking, content: mainContent } = parseThinkingContent(content);
        content = mainContent;

        // 处理工具调用
        let toolCalls: ToolCall[] = [];

        if (this.useNativeFunctionCalling && message?.tool_calls) {
          // 原生 Function Calling
          toolCalls = message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
          }));
        } else if (tools) {
          // Fallback：从文本解析
          toolCalls = parseToolCallsFromText(content);
        }

        return {
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          done: true,
          ...(thinking ? { thinking } : {}),
        } as LLMResponse;

      } catch (error) {
        // AbortError 不重试
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }

        // 超时错误，可能重试
        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError = new APIError('请求超时', 408, 'timeout', true);
          if (attempt >= this.retryConfig.maxRetries) {
            throw timeoutError;
          }
          lastError = timeoutError;
          const delay = calculateRetryDelay(attempt, this.retryConfig);
          await sleep(delay);
          continue;
        }

        // 其他错误
        lastError = error as Error;
        if (attempt >= this.retryConfig.maxRetries) {
          throw error;
        }

        // 网络错误可能重试
        if ((error as any).code === 'ECONNRESET' || (error as any).code === 'ENOTFOUND') {
          const delay = calculateRetryDelay(attempt, this.retryConfig);
          await sleep(delay);
          continue;
        }

        throw error;
      }
    }

    // 所有重试都失败
    throw lastError || new Error('请求失败');
  }

  /**
   * 流式对话（支持实时工具调用识别）
   *
   * 关键特性：
   * - 文本内容实时流式输出
   * - 工具调用在参数完整时立即发送（不等流结束）
   * - 支持 Thinking Mode 的实时解析
   * - 支持并行工具调用
   * - 请求超时控制
   *
   * 注意：流式请求不支持自动重试（因为可能已经输出了部分内容）
   */
  async *chatStream(messages: Message[], tools?: ToolDefinition[], options?: LLMRequestOptions): AsyncIterable<StreamChunk> {
    const formattedTools = this.formatTools(tools);

    const body: any = {
      ...(this.sendModelParam ? { model: this.model } : {}),
      messages: this.formatMessages(messages, tools),
      stream: true,
    };

    if (formattedTools) {
      body.tools = formattedTools;
      body.tool_choice = 'auto';
    }

    // 使用带超时的 fetch
    const response = await fetchWithTimeout(
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: options?.signal,
      },
      this.timeoutMs
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw APIError.fromResponse(response.status, errorBody);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    // 用于流式工具调用的累积器
    const toolCallAccumulators: Map<number, {
      id: string;
      name: string;
      arguments: string;
      emitted: boolean;  // 是否已发送
    }> = new Map();

    // Thinking 状态追踪
    let inThinkingBlock = false;
    let thinkingBuffer = '';

    // 尝试解析并发送工具调用（如果参数完整）
    const tryEmitToolCall = function* (index: number): Generator<StreamChunk> {
      const acc = toolCallAccumulators.get(index);
      if (!acc || acc.emitted || !acc.name) return;

      // 只有当 arguments 看起来像完整的 JSON 对象时才尝试解析
      // 避免空字符串被 fallback 成 '{}' 导致过早发送
      const argsStr = acc.arguments.trim();
      if (!argsStr || !argsStr.startsWith('{') || !argsStr.endsWith('}')) {
        return; // 参数还不完整，继续等待
      }

      // 尝试解析 JSON 参数
      try {
        const args = JSON.parse(argsStr);
        acc.emitted = true;
        yield {
          type: 'tool_call',
          toolCall: {
            id: acc.id,
            name: acc.name,
            arguments: args,
          }
        };
      } catch {
        // JSON 不完整（比如嵌套对象未闭合），继续等待更多数据
      }
    };

    try {
      while (true) {
        if (options?.signal?.aborted) {
          throw new DOMException('请求已中断', 'AbortError');
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;

            // 处理文本内容
            if (delta?.content) {
              let content = delta.content;
              fullContent += content;

              // 处理 Thinking 标签
              if (content.includes('<think>')) {
                inThinkingBlock = true;
                const parts = content.split('<think>');
                if (parts[0]) {
                  yield { type: 'text', content: parts[0] };
                }
                thinkingBuffer = parts[1] || '';
                continue;
              }

              if (inThinkingBlock) {
                if (content.includes('</think>')) {
                  inThinkingBlock = false;
                  const parts = content.split('</think>');
                  thinkingBuffer += parts[0];
                  yield { type: 'thinking' as any, content: thinkingBuffer };
                  thinkingBuffer = '';
                  if (parts[1]) {
                    yield { type: 'text', content: parts[1] };
                  }
                } else {
                  thinkingBuffer += content;
                }
                continue;
              }

              yield { type: 'text', content };
            }

            // 处理流式工具调用（原生 Function Calling）
            if (this.useNativeFunctionCalling && delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index ?? 0;

                if (!toolCallAccumulators.has(index)) {
                  toolCallAccumulators.set(index, {
                    id: tc.id || `call_${Date.now()}_${index}`,
                    name: tc.function?.name || '',
                    arguments: '',
                    emitted: false,
                  });
                }

                const acc = toolCallAccumulators.get(index)!;
                if (tc.id) {
                  acc.id = tc.id;
                }
                if (tc.function?.name) {
                  acc.name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  acc.arguments += tc.function.arguments;
                }

                // 实时尝试发送工具调用
                yield* tryEmitToolCall(index);
              }
            }

            // 处理 finish_reason: 当收到 tool_calls 完成信号时，确保发送所有未发送的工具调用
            const finishReason = data.choices?.[0]?.finish_reason;
            if (finishReason === 'tool_calls' || finishReason === 'stop') {
              for (const [idx] of toolCallAccumulators) {
                yield* tryEmitToolCall(idx);
              }
            }
          } catch {
            // JSON 解析失败，跳过
          }
        }
      }

      // 流结束后，发送所有未发送的工具调用
      if (this.useNativeFunctionCalling) {
        for (const [, acc] of toolCallAccumulators) {
          if (acc.emitted) continue;
          if (!acc.name) continue; // 没有工具名，跳过

          const argsStr = acc.arguments.trim();
          let args: Record<string, unknown> = {};

          // 尝试解析参数
          if (argsStr && argsStr.startsWith('{')) {
            try {
              args = JSON.parse(argsStr);
            } catch {
              // 解析失败，使用空对象
              console.warn(`工具调用参数解析失败: ${acc.name}, arguments: ${argsStr.slice(0, 100)}`);
            }
          }

          yield {
            type: 'tool_call',
            toolCall: {
              id: acc.id,
              name: acc.name,
              arguments: args,
            }
          };
        }
      } else if (tools) {
        // Fallback 模式：从文本解析
        const toolCalls = parseToolCallsFromText(fullContent);
        for (const toolCall of toolCalls) {
          yield { type: 'tool_call', toolCall };
        }
      }

      yield { type: 'done' };
    } finally {
      reader.releaseLock();
    }
  }
}

/**
 * 根据模型名称创建 OpenAI Provider
 */
export function createOpenAIProvider(modelName: string, apiKey?: string): OpenAIProvider | null {
  const config = REMOTE_MODELS.find(m => m.name === modelName);
  if (!config) return null;

  return new OpenAIProvider({
    ...config,
    apiKey: apiKey || config.apiKey,
  });
}

/**
 * 创建 DeepSeek 官方 API Provider
 */
export function createDeepSeekProvider(apiKey: string, model: 'deepseek-chat' | 'deepseek-reasoner' = 'deepseek-chat'): OpenAIProvider {
  return new OpenAIProvider({
    baseURL: 'https://api.deepseek.com',
    apiKey,
    model,
    useNativeFunctionCalling: true,
  });
}

/**
 * 获取可用的远程模型列表
 */
export function getRemoteModelNames(): string[] {
  return REMOTE_MODELS.map(m => m.name);
}
