import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';

export type LLMProvider = 'deepseek' | 'openai-compatible';

export interface ModelFactoryConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseURL?: string;
}

export class ModelFactory {
  /**
   * 根据配置创建 LLM 模型实例
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static create(config: ModelFactoryConfig): any {
    switch (config.provider) {
      case 'deepseek':
        return createDeepSeek({
          apiKey: config.apiKey,
          ...(config.baseURL && { baseURL: config.baseURL }),
        })(config.model);

      case 'openai-compatible':
        return createOpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          compatibility: 'compatible',
        })(config.model);

      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}
