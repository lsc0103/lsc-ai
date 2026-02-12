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
  private static _cachedModel: ReturnType<typeof ModelFactory.create> | null = null;
  private static _cachedConfigKey: string = '';

  /**
   * 从环境变量创建 LLM 模型实例（带缓存，相同配置复用实例）
   */
  static createFromEnv() {
    const provider = (process.env.LLM_DEFAULT_PROVIDER || 'deepseek') as LLMProvider;
    const model = process.env.LLM_DEFAULT_MODEL || 'deepseek-chat';
    const apiKey = process.env.LLM_DEFAULT_API_KEY || process.env.DEEPSEEK_API_KEY || '';
    const baseURL = process.env.LLM_DEFAULT_BASE_URL || undefined;

    const configKey = `${provider}:${model}:${apiKey}:${baseURL}`;
    if (ModelFactory._cachedModel && ModelFactory._cachedConfigKey === configKey) {
      return ModelFactory._cachedModel;
    }

    const instance = ModelFactory.create({ provider, model, apiKey, baseURL });
    ModelFactory._cachedModel = instance;
    ModelFactory._cachedConfigKey = configKey;
    return instance;
  }

  /**
   * 根据配置创建 LLM 模型实例
   */
  static create(config: ModelFactoryConfig) {
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

  /**
   * 获取当前配置信息（用于启动日志，不暴露 API Key）
   */
  static getConfigInfo(): string {
    const provider = process.env.LLM_DEFAULT_PROVIDER || 'deepseek';
    const model = process.env.LLM_DEFAULT_MODEL || 'deepseek-chat';
    const baseURL = process.env.LLM_DEFAULT_BASE_URL || '(default)';
    const hasKey = !!(process.env.LLM_DEFAULT_API_KEY || process.env.DEEPSEEK_API_KEY);
    return `Provider: ${provider}, Model: ${model}, BaseURL: ${baseURL}, API Key: ${hasKey ? 'set' : 'missing'}`;
  }
}
