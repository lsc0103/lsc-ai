import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: Error) => void;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    this.baseUrl =
      this.configService.get<string>('DEEPSEEK_BASE_URL') ||
      'https://api.deepseek.com';

    if (!this.apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY 未配置');
    }
  }

  /**
   * 普通对话（非流式）
   */
  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<string> {
    const { model = 'deepseek-chat', temperature = 0.7, maxTokens = 2048 } = options;

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API 错误: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('DeepSeek API 调用失败:', error);
      throw error;
    }
  }

  /**
   * 流式对话
   */
  async chatStream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options: ChatOptions = {},
  ): Promise<void> {
    const { model = 'deepseek-chat', temperature = 0.7, maxTokens = 2048 } = options;

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API 错误: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // 处理缓冲区中剩余的数据
          if (buffer.trim()) {
            this.processStreamLine(buffer, callbacks, (content) => {
              fullContent += content;
            });
          }
          callbacks.onDone(fullContent);
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // 按行处理 SSE 数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行

        for (const line of lines) {
          this.processStreamLine(line, callbacks, (content) => {
            fullContent += content;
          });
        }
      }
    } catch (error) {
      this.logger.error('DeepSeek 流式 API 调用失败:', error);
      callbacks.onError(error as Error);
    }
  }

  /**
   * 处理单行 SSE 数据
   */
  private processStreamLine(
    line: string,
    callbacks: StreamCallbacks,
    accumulate: (content: string) => void,
  ): void {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine === 'data: [DONE]') {
      return;
    }

    if (trimmedLine.startsWith('data: ')) {
      try {
        const jsonStr = trimmedLine.slice(6);
        const data = JSON.parse(jsonStr);
        const content = data.choices?.[0]?.delta?.content;

        if (content) {
          callbacks.onChunk(content);
          accumulate(content);
        }
      } catch (e) {
        // 忽略解析错误（可能是不完整的 JSON）
      }
    }
  }

  /**
   * 检查 API 是否可用
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
